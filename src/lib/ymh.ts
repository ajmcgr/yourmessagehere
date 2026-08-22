import { supabase, isSupabaseConfigured, functionsUrl } from "./supabase";

export type Auction = {
  id: string;
  status: "open" | "closed" | "awaiting_payment" | "paid" | "expired";
  ends_at: string;
  week_start: string;
  week_end: string;
  starting_bid_cents: number;
  min_increment_cents: number;
  current_bid_cents: number | null;
};

export type Bid = {
  id: string;
  auction_id: string;
  bidder_name: string;
  advertiser: string;
  website: string | null;
  amount_cents: number;
  created_at: string;
};

export type Billboard = {
  id: string;
  auction_id: string;
  image_url: string | null;
  click_url: string | null;
  headline: string | null;
  advertiser: string | null;
  week_start: string;
  week_end: string;
  status: "pending" | "approved" | "rejected";
};

export const DEFAULT_STARTING_BID_CENTS = 500;
export const DEFAULT_INCREMENT_CENTS = 1000;

export const formatUsd = (cents: number) =>
  (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

/** Next Friday 10:00 PM America/New_York, as a UTC Date. */
export function nextAuctionEnd(from: Date = new Date()): Date {
  const offsetMs = (d: Date) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(d);
    const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
    const asUtc = Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour") % 24,
      get("minute"),
      get("second"),
    );
    return asUtc - d.getTime();
  };

  // Local NY wall-clock representation of `from`
  const nyNow = new Date(from.getTime() + offsetMs(from));
  const day = nyNow.getUTCDay(); // 5 = Friday
  let delta = (5 - day + 7) % 7;
  const candidate = new Date(
    Date.UTC(nyNow.getUTCFullYear(), nyNow.getUTCMonth(), nyNow.getUTCDate() + delta, 22, 0, 0),
  );
  if (candidate.getTime() <= nyNow.getTime()) {
    delta += 7;
    candidate.setUTCDate(candidate.getUTCDate() + 7);
  }
  // Convert NY wall clock back to a real UTC instant
  const guess = new Date(candidate.getTime() - offsetMs(from));
  return new Date(candidate.getTime() - offsetMs(guess));
}

/**
 * The single active auction. Server-side source of truth: the RPC closes any
 * expired auction and opens the next one (idempotently) before returning, so a
 * visitor arriving after Friday 10:00 PM ET never sees an ended auction.
 */
export async function fetchCurrentAuction(): Promise<Auction | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data, error } = await supabase.rpc("ymh_current_auction");
  if (!error && data) {
    const row = (Array.isArray(data) ? data[0] : data) as Auction | undefined;
    if (row?.id) return row;
  }

  // Fallback for projects where migration 0007 has not been applied yet.
  const { data: fallback, error: fallbackError } = await supabase
    .from("ymh_auctions")
    .select("*")
    .eq("status", "open")
    .order("ends_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (fallbackError) return null;
  return (fallback as Auction) ?? null;
}


export async function fetchTopBids(auctionId?: string): Promise<Bid[]> {
  if (!isSupabaseConfigured || !supabase || !auctionId) return [];
  const { data, error } = await supabase
    .from("ymh_bids_public")
    .select("*")
    .eq("auction_id", auctionId)
    .order("amount_cents", { ascending: false })
    .limit(100);
  if (error) return [];
  return (data as Bid[]) ?? [];
}

export async function fetchLiveBillboard(): Promise<Billboard | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from("ymh_billboards")
    .select("*")
    .eq("status", "approved")
    .lte("week_start", new Date().toISOString())
    .gte("week_end", new Date().toISOString())
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return (data as Billboard) ?? null;
}

export type StartBidInput = {
  name: string;
  email: string;
  advertiser: string;
  website?: string;
  amount_cents: number;
  terms_accepted: true;
};

export type StartBidResult = {
  bid_id: string;
  amount_cents: number;
  /** Hosted Stripe Checkout URL (setup mode) — the bidder is redirected here. */
  checkout_url: string;
  checkout_session_id: string;
};

/** Reads the JSON error body an Edge Function returns alongside a 4xx status. */
async function invoke<T>(
  name: string,
  body: Record<string, unknown>,
  fallback: string,
): Promise<T> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Bidding is not available yet — Supabase is not configured.");
  }
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    const res = (error as { context?: Response }).context;
    if (res && typeof res.json === "function") {
      try {
        const parsed = (await res.clone().json()) as { error?: string };
        if (parsed?.error) throw new Error(parsed.error);
      } catch (e) {
        if (e instanceof Error && e.message && !/json/i.test(e.message)) throw e;
      }
    }
    throw new Error(error.message || fallback);
  }
  if (data && (data as { error?: string }).error) {
    throw new Error((data as { error: string }).error);
  }
  return data as T;
}

/**
 * Step 1 — validate the amount, open a PENDING bid, and get a hosted Stripe
 * Checkout URL (setup mode). The bid is not public and does not move the
 * current bid at this point.
 */
export async function startBid(input: StartBidInput) {
  return invoke<StartBidResult>(
    "ymh-start-bid",
    {
      ...input,
      return_origin: typeof window === "undefined" ? "" : window.location.origin,
    },
    "Your bid could not be started.",
  );
}

/**
 * Step 2 — the bidder returned from hosted Checkout. The server re-checks the
 * session, its SetupIntent and the auction, then activates the bid. Only now
 * is it public.
 */
export async function confirmBid(bidId: string, checkoutSessionId: string) {
  return invoke<{ ok: true; amount_cents: number }>(
    "ymh-confirm-bid",
    { bid_id: bidId, checkout_session_id: checkoutSessionId },
    "Your bid could not be verified.",
  );
}

export { functionsUrl };

/** Every past billboard that ran, newest first. */
export async function fetchArchivedBillboards(): Promise<Billboard[]> {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from("ymh_billboards")
    .select("*")
    .eq("status", "approved")
    .lt("week_end", new Date().toISOString())
    .order("week_start", { ascending: false })
    .limit(200);
  if (error) return [];
  return (data as Billboard[]) ?? [];
}

/** "Week ending Aug 28, 2026" — the seven-day run the current auction is for. */
export function weekEndingLabel(
  auction: Auction | null,
  endsAt: Date,
  opts: { short?: boolean } = {},
): string {
  const end = auction?.week_end
    ? new Date(auction.week_end)
    : new Date(endsAt.getTime() + 7 * 24 * 60 * 60 * 1000);
  return `Week ending ${end.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    ...(opts.short ? {} : { year: "numeric" as const }),
  })}`;
}

/** Total site page views since launch. Increments once per page load. */
export async function recordPageView(): Promise<number | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase.rpc("ymh_increment_page_view");
  if (error) return null;
  return typeof data === "number" ? data : Number(data ?? 0) || null;
}

export type ArchivedWeek = {
  auction: Auction;
  billboard: Billboard | null;
  bids: Bid[];
};

/** Past auction weeks with their winning creative and full bid history. */
export async function fetchArchivedWeeks(): Promise<ArchivedWeek[]> {
  if (!isSupabaseConfigured || !supabase) return [];
  const nowIso = new Date().toISOString();

  const { data: auctionRows, error } = await supabase
    .from("ymh_auctions")
    .select("*")
    .lt("week_end", nowIso)
    .order("week_start", { ascending: false })
    .limit(100);
  if (error || !auctionRows?.length) return [];

  const auctions = auctionRows as Auction[];
  const ids = auctions.map((a) => a.id);

  const [{ data: boardRows }, { data: bidRows }] = await Promise.all([
    supabase.from("ymh_billboards").select("*").in("auction_id", ids),
    supabase
      .from("ymh_bids_public")
      .select("*")
      .in("auction_id", ids)
      .order("amount_cents", { ascending: false }),
  ]);

  const boards = (boardRows as Billboard[] | null) ?? [];
  const bids = (bidRows as Bid[] | null) ?? [];

  return auctions.map((auction) => ({
    auction,
    billboard: boards.find((b) => b.auction_id === auction.id) ?? null,
    bids: bids.filter((b) => b.auction_id === auction.id),
  }));
}

/** Self-serve signup for the weekly "new window is open" reminder email. */
export async function subscribeToAlerts(email: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;
  const { error } = await supabase.rpc("ymh_subscribe_email", { p_email: email });
  return !error;
}
