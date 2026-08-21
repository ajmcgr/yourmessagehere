import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { SiteNav } from "@/components/SiteNav";
import { formatUsd, functionsUrl } from "@/lib/ymh";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Auction admin — Your Message Here" },
      { name: "description", content: "Internal auction integrity console." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Admin,
});

type AdminBid = {
  id: string;
  auction_id: string;
  bidder_name: string;
  bidder_email: string;
  advertiser: string;
  website: string | null;
  amount_cents: number;
  status: string;
  payment_status: string;
  payment_failure_reason: string | null;
  payment_method_verified_at: string | null;
  terms_accepted_at: string | null;
  disqualified_at: string | null;
  disqualified_reason: string | null;
  stripe_customer_id: string | null;
  stripe_payment_method_id: string | null;
  stripe_setup_intent_id: string | null;
  stripe_payment_intent_id: string | null;
  created_at: string;
};

type AdminAuction = {
  id: string;
  status: string;
  ends_at: string;
  week_end: string;
  current_bid_cents: number | null;
};

const STORAGE_KEY = "ymh_admin_secret";

const statusTone: Record<string, string> = {
  active: "bg-money/15 text-money",
  outbid: "bg-foreground/5 text-muted-foreground",
  pending_verification: "bg-amber-500/15 text-amber-700",
  provisional_winner: "bg-money/15 text-money",
  winner_paid: "bg-money/15 text-money",
  payment_failed: "bg-red-500/15 text-red-700",
  payment_expired: "bg-red-500/10 text-red-700",
  disqualified: "bg-red-500/15 text-red-700",
};

function Admin() {
  const [secret, setSecret] = useState("");
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [auctions, setAuctions] = useState<AdminAuction[]>([]);
  const [bids, setBids] = useState<AdminBid[]>([]);

  const call = useCallback(
    async (payload: Record<string, unknown>, key: string) => {
      const res = await fetch(functionsUrl("ymh-admin"), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ymh-admin-secret": key },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok) throw new Error(String(data['error'] ?? "Request failed"));
      return data;
    },
    [],
  );

  const load = useCallback(
    async (key: string) => {
      setLoading(true);
      try {
        const data = await call({ action: "list" }, key);
        setAuctions((data['auctions'] as AdminAuction[]) ?? []);
        setBids((data['bids'] as AdminBid[]) ?? []);
        setAuthed(true);
        sessionStorage.setItem(STORAGE_KEY, key);
      } catch (err) {
        setAuthed(false);
        toast.error(err instanceof Error ? err.message : "Could not load the auction.");
      } finally {
        setLoading(false);
      }
    },
    [call],
  );

  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      setSecret(saved);
      void load(saved);
    }
  }, [load]);

  const act = async (action: "disqualify" | "restore", bid: AdminBid) => {
    if (
      action === "disqualify" &&
      !window.confirm(
        `Disqualify ${bid.advertiser}'s ${formatUsd(bid.amount_cents)} bid? It is removed from the public leaderboard and the current bid falls back to the next verified bid.`,
      )
    ) {
      return;
    }
    try {
      await call(
        action === "disqualify"
          ? { action, bid_id: bid.id, reason: "Disqualified by admin" }
          : { action, bid_id: bid.id },
        secret,
      );
      toast.success(action === "disqualify" ? "Bid disqualified." : "Bid restored.");
      await load(secret);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That action failed.");
    }
  };

  const dt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York" }) : "—";

  if (!authed) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteNav />
        <main className="mx-auto max-w-md px-6 py-16">
          <h1 className="text-2xl font-medium tracking-tight">Auction admin</h1>
          <form
            className="mt-8 space-y-6"
            onSubmit={(e) => {
              e.preventDefault();
              void load(secret);
            }}
          >
            <input
              type="password"
              required
              placeholder="Admin secret"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              className="w-full border-0 border-b border-foreground/20 bg-transparent py-3 text-base outline-none focus:border-foreground"
            />
            <button type="submit" disabled={loading} className="btn-cta w-full">
              {loading ? "Checking…" : "Sign in"}
            </button>
          </form>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />
      <main className="mx-auto max-w-6xl px-6 pb-24">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-medium tracking-tight">Auction admin</h1>
          <button
            type="button"
            onClick={() => void load(secret)}
            className="rounded border border-foreground/15 px-3 py-1.5 text-sm hover:bg-foreground/5"
          >
            Refresh
          </button>
        </div>

        {auctions.map((auction) => {
          const rows = bids.filter((b) => b.auction_id === auction.id);
          if (rows.length === 0) return null;
          return (
            <section key={auction.id} className="mt-12">
              <h2 className="text-sm font-bold">
                {auction.status.toUpperCase()} · ends {dt(auction.ends_at)} · current bid{" "}
                {auction.current_bid_cents === null
                  ? "none"
                  : formatUsd(auction.current_bid_cents)}
              </h2>
              <div className="mt-4 overflow-x-auto border-t border-foreground/10">
                <table className="w-full min-w-[70rem] text-sm">
                  <thead>
                    <tr className="text-left text-xs font-bold">
                      <th className="py-3 pr-4">Bid</th>
                      <th className="py-3 pr-4">Bidder</th>
                      <th className="py-3 pr-4">Bid status</th>
                      <th className="py-3 pr-4">Card verified</th>
                      <th className="py-3 pr-4">Terms</th>
                      <th className="py-3 pr-4">Payment</th>
                      <th className="py-3 pr-4">Stripe</th>
                      <th className="py-3 pr-4"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((b) => (
                      <tr key={b.id} className="border-t border-foreground/10 align-top">
                        <td className="py-4 pr-4 font-bold tabular-nums text-money whitespace-nowrap">
                          {formatUsd(b.amount_cents)}
                        </td>
                        <td className="py-4 pr-4">
                          <div className="font-bold">{b.advertiser}</div>
                          <div className="text-xs text-muted-foreground">
                            {b.bidder_name} · {b.bidder_email}
                          </div>
                          <div className="text-xs text-muted-foreground">{dt(b.created_at)}</div>
                        </td>
                        <td className="py-4 pr-4">
                          <span
                            className={`inline-block rounded px-2 py-1 text-xs font-bold ${
                              statusTone[b.status] ?? "bg-foreground/5"
                            }`}
                          >
                            {b.status}
                          </span>
                          {b.disqualified_at && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              {b.disqualified_reason} · {dt(b.disqualified_at)}
                            </div>
                          )}
                        </td>
                        <td className="py-4 pr-4 text-xs">
                          {b.payment_method_verified_at ? (
                            <>
                              <span className="font-bold text-money">Verified</span>
                              <div className="text-muted-foreground">
                                {dt(b.payment_method_verified_at)}
                              </div>
                            </>
                          ) : (
                            <span className="font-bold text-red-700">Not verified</span>
                          )}
                        </td>
                        <td className="py-4 pr-4 text-xs text-muted-foreground">
                          {b.terms_accepted_at ? dt(b.terms_accepted_at) : "—"}
                        </td>
                        <td className="py-4 pr-4 text-xs">
                          <div className="font-bold">{b.payment_status}</div>
                          {b.payment_failure_reason && (
                            <div className="text-red-700">{b.payment_failure_reason}</div>
                          )}
                        </td>
                        <td className="py-4 pr-4 text-xs text-muted-foreground">
                          <div className="truncate">{b.stripe_customer_id ?? "—"}</div>
                          <div className="truncate">{b.stripe_setup_intent_id ?? "—"}</div>
                          <div className="truncate">{b.stripe_payment_intent_id ?? "—"}</div>
                        </td>
                        <td className="py-4 pr-4 whitespace-nowrap">
                          {b.status === "disqualified" ? (
                            <button
                              type="button"
                              onClick={() => void act("restore", b)}
                              className="rounded border border-foreground/15 px-3 py-1.5 text-xs hover:bg-foreground/5"
                            >
                              Restore
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void act("disqualify", b)}
                              className="rounded border border-red-500/40 px-3 py-1.5 text-xs text-red-700 hover:bg-red-500/10"
                            >
                              Disqualify
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
