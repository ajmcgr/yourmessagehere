import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Billboard } from "@/components/Billboard";
import { Countdown } from "@/components/Countdown";
import { useAuction } from "@/hooks/useAuction";
import { useSiteDescriptions } from "@/hooks/useSiteDescriptions";
import {
  confirmBid,
  formatUsd,
  recordPageView,
  startBid,
  weekEndingLabel,
} from "@/lib/ymh";

import { isSupabaseConfigured } from "@/lib/supabase";
import { SiteFooter, SiteLinks, SiteNav } from "@/components/SiteNav";
import { Skeleton } from "@/components/ui/skeleton";

const PAGE_SIZE = 50;



export const Route = createFileRoute("/buy")({
  head: () => ({
    meta: [
      { title: "Bid on the billboard — Your Message Here" },
      {
        name: "description",
        content:
          "Place a bid to own the internet's only billboard for seven days. No account needed. Auction closes Friday 10:00 PM New York time.",
      },
      { property: "og:title", content: "Bid on the billboard — Your Message Here" },
      {
        property: "og:description",
        content: "No account, no payment to bid. Highest bid at Friday 10:00 PM ET wins the week.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Buy,
});

function Buy() {
  const {
    auction,
    billboard,
    bids,
    currentBidCents,
    minBidCents,
    incrementCents,
    endsAt,
    loading,
    reload,
  } = useAuction();
  const descriptions = useSiteDescriptions(bids.map((b) => b.website));
  const [views, setViews] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(0);

  const pageCount = Math.max(1, Math.ceil(bids.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pagedBids = bids.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  useEffect(() => {
    void recordPageView().then(setViews);
  }, []);

  const [form, setForm] = useState({
    name: "",
    email: "",
    advertiser: "",
    website: "",
    amount: "",
  });
  const [terms, setTerms] = useState(false);
  const [pending, setPending] = useState<StartBidResult | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountCents = Math.round(Number(form.amount) * 100);
    if (!Number.isFinite(amountCents) || amountCents < minBidCents) {
      toast.error(`Minimum bid is ${formatUsd(minBidCents)}.`);
      return;
    }
    if (!terms) {
      toast.error("Please accept the payment authorization to bid.");
      return;
    }
    setSubmitting(true);
    try {
      const raw = form.website.trim();
      const website = raw && !/^https?:\/\//i.test(raw) ? `https://${raw}` : raw;
      const started = await startBid({
        name: form.name.trim(),
        email: form.email.trim(),
        advertiser: form.advertiser.trim(),
        amount_cents: amountCents,
        terms_accepted: true,
        ...(website ? { website } : {}),
      });
      setPending(started);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Your bid could not be started.");
    } finally {
      setSubmitting(false);
    }
  };


  const timeAgo = (iso: string) => {
    const secs = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    const mins = Math.floor(secs / 60);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  };

  const field =
    "w-full border-0 border-b border-foreground/20 bg-transparent py-3 text-base outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground";


  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />


      <main className="mx-auto max-w-3xl px-6 pb-32">
        <section>
          <Billboard billboard={billboard} loading={loading} />
          <dl className="mt-10 space-y-6">
            <div>
              <dt className="text-xs uppercase tracking-widest text-muted-foreground">
                Current bid
              </dt>
              {loading ? (
                <dd className="mt-2">
                  <Skeleton className="h-10 w-56 md:h-14" />
                </dd>
              ) : (
                <dd className="text-4xl font-medium tracking-tight tabular-nums md:text-6xl">
                  <span className="marker-highlight">
                    {currentBidCents === null ? "No bids yet" : formatUsd(currentBidCents)}
                  </span>
                </dd>
              )}
            </div>

            <div>
              <dt className="text-xs uppercase tracking-widest text-muted-foreground">
                Auction ends in
              </dt>
              {loading ? (
                <>
                  <dd className="mt-2">
                    <Skeleton className="h-10 w-64 md:h-14" />
                  </dd>
                  <dd className="mt-2">
                    <Skeleton className="h-4 w-40" />
                  </dd>
                </>
              ) : (
                <>
                  <dd>
                    <Countdown target={endsAt} size="lg" />
                  </dd>
                  <dd className="mt-2 text-sm text-muted-foreground">
                    {weekEndingLabel(auction, endsAt)}
                  </dd>
                </>
              )}
            </div>

            <div>
              <dt className="text-xs uppercase tracking-widest text-muted-foreground">Audience</dt>
              {views === null ? (
                <dd className="mt-2">
                  <Skeleton className="h-10 w-32 md:h-14" />
                </dd>
              ) : (
                <dd className="text-4xl font-medium tracking-tight tabular-nums md:text-6xl">
                  {views.toLocaleString("en-US")}
                </dd>
              )}
              <dd className="mt-2 text-sm text-muted-foreground">page views since launch</dd>
            </div>


          </dl>
          <a href="#place-bid" className="btn-cta mt-8 inline-flex">
            Place a bid <span className="btn-arrow">↓</span>
          </a>
        </section>


        {loading && (
          <section className="mt-16 lg:-mx-24 xl:-mx-40">
            <Skeleton className="h-4 w-32" />
            <div className="mt-4 border-t border-foreground/10">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 border-b border-foreground/10 py-5">
                  <Skeleton className="size-8 shrink-0 rounded sm:size-10" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-64 max-w-full" />
                  </div>
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          </section>
        )}

        {!loading && bids.length > 0 && (
          <section className="mt-16 lg:-mx-24 xl:-mx-40">

            <h2 className="text-sm font-bold tracking-normal text-foreground">
              Bids ({bids.length})
            </h2>
            <div className="mt-4 max-h-[28rem] overflow-y-auto border-t border-foreground/10">
              <table className="w-full table-fixed text-base">
                <thead className="sticky top-0 bg-background">
                  <tr className="text-left text-xs font-bold tracking-normal text-foreground">
                    <th className="w-7 py-4 pl-3 font-bold sm:w-8 sm:pl-6">#</th>
                    <th className="px-2 py-4 font-bold sm:px-4">Brand</th>
                    <th className="hidden px-4 py-4 font-bold md:table-cell whitespace-nowrap">Placed</th>
                    <th className="w-24 py-4 pr-3 text-right font-bold whitespace-nowrap sm:pr-6">Bid</th>
                  </tr>
                </thead>

                <tbody>
                  {pagedBids.map((b, idx) => {
                    const i = safePage * PAGE_SIZE + idx;
                    const host = b.website
                      ? b.website.replace(/^https?:\/\//i, "").replace(/\/.*$/, "")
                      : null;
                    const description = b.website ? descriptions[b.website] : undefined;
                    const winning = i === 0;
                    return (
                      <tr
                        key={b.id}
                        onClick={
                          b.website
                            ? () => window.open(b.website!, "_blank", "noopener,noreferrer")
                            : undefined
                        }
                        className={`border-t border-foreground/10 align-middle ${
                          winning ? "bg-money/10" : ""
                        } ${
                          b.website ? "cursor-pointer transition-colors hover:bg-foreground/5" : ""
                        }`}
                      >
                        <td className="py-5 pl-3 text-sm tabular-nums text-muted-foreground sm:pl-6">{i + 1}</td>
                        <td className="px-2 py-5 sm:px-4">
                          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                            {host ? (
                              <img
                                src={`https://www.google.com/s2/favicons?sz=128&domain=${host}`}
                                alt=""
                                loading="lazy"
                                className="size-8 shrink-0 rounded sm:size-10"
                              />
                            ) : (
                              <span className="size-8 shrink-0 rounded bg-foreground/10 sm:size-10" />
                            )}
                            <span className="min-w-0 flex-1">
                              {b.website ? (
                                <a
                                  href={b.website}
                                  target="_blank"
                                  rel="noopener noreferrer nofollow"
                                  onClick={(e) => e.stopPropagation()}
                                  className="block truncate font-bold text-foreground underline-offset-4 hover:underline"
                                >
                                  {b.advertiser}
                                </a>
                              ) : (
                                <span className="block truncate font-bold text-foreground">{b.advertiser}</span>
                              )}
                              {description && (
                                <span className="block truncate text-sm text-muted-foreground">
                                  {description}
                                </span>
                              )}
                            </span>
                          </div>
                        </td>
                        <td className="hidden whitespace-nowrap px-4 py-5 text-sm text-muted-foreground md:table-cell">
                          {timeAgo(b.created_at)}
                        </td>
                        <td className="py-5 pr-3 text-right font-bold tabular-nums whitespace-nowrap text-money sm:pr-6">
                          {formatUsd(b.amount_cents)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {pageCount > 1 && (
              <div className="mt-4 flex items-center justify-between gap-4 text-sm">
                <button
                  type="button"
                  onClick={() => setPage(Math.max(0, safePage - 1))}
                  disabled={safePage === 0}
                  className="rounded border border-foreground/15 px-3 py-1.5 transition-colors hover:bg-foreground/5 disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  ← Previous
                </button>
                <span className="text-muted-foreground tabular-nums">
                  Page {safePage + 1} of {pageCount}
                </span>
                <button
                  type="button"
                  onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))}
                  disabled={safePage >= pageCount - 1}
                  className="rounded border border-foreground/15 px-3 py-1.5 transition-colors hover:bg-foreground/5 disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  Next →
                </button>
              </div>
            )}
          </section>
        )}


        <section id="place-bid" className="mt-16 scroll-mt-24">
          <h1 className="text-2xl font-medium tracking-tight">Place a bid</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            No account. You won't be charged now — Stripe verifies your payment method so your bid
            counts. Minimum bid {formatUsd(minBidCents)} (increments of {formatUsd(incrementCents)}).
          </p>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Creative spec: <span className="text-foreground">1600 × 900 px</span> (16:9), JPG or
            PNG, under 2 MB. 2× retina file: 3200 × 1800 px.
          </p>


          {!isSupabaseConfigured && (
            <p className="mt-6 border border-foreground/20 p-4 text-sm text-muted-foreground">
              Bidding is offline until VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are set.
            </p>
          )}
          {isSupabaseConfigured && !isStripeConfigured && (
            <p className="mt-6 border border-foreground/20 p-4 text-sm text-muted-foreground">
              Bidding is offline until VITE_STRIPE_PUBLISHABLE_KEY is set.
            </p>
          )}

          {pending ? (
            <VerifyStep
              pending={pending}
              onCancel={() => setPending(null)}
              onVerified={async () => {
                setPending(null);
                setForm((f) => ({ ...f, amount: "" }));
                setTerms(false);
                toast.success("Bid verified. You're the highest bidder.");
                await reload();
              }}
              onStale={async (message) => {
                setPending(null);
                toast.error(message);
                await reload();
              }}
            />
          ) : (
            <form onSubmit={onSubmit} className="mt-8 space-y-6">
              <input required placeholder="Name" className={field} value={form.name} onChange={set("name")} />
              <input
                required
                type="email"
                placeholder="Email"
                className={field}
                value={form.email}
                onChange={set("email")}
              />
              <input
                required
                placeholder="Advertiser / company"
                className={field}
                value={form.advertiser}
                onChange={set("advertiser")}
              />
              <input
                type="text"
                inputMode="url"
                placeholder="Website (optional)"
                className={field}
                value={form.website}
                onChange={set("website")}
              />
              <div className="flex items-baseline gap-2 border-b border-foreground/20 focus-within:border-foreground">
                <span className="text-base text-muted-foreground">$</span>
                <input
                  required
                  type="number"
                  min={minBidCents / 100}
                  step={incrementCents / 100}
                  placeholder={`Bid amount in USD (min ${minBidCents / 100})`}
                  className="w-full border-0 bg-transparent py-3 text-base tabular-nums outline-none placeholder:text-muted-foreground"
                  value={form.amount}
                  onChange={set("amount")}
                />
                <span className="text-xs uppercase tracking-widest text-muted-foreground">USD</span>
              </div>

              <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed">
                <input
                  required
                  type="checkbox"
                  checked={terms}
                  onChange={(e) => setTerms(e.target.checked)}
                  className="mt-1 size-4 shrink-0 accent-foreground"
                />
                <span>
                  I understand that if I win this auction, I authorize Your Message Here to charge
                  my payment method for my winning bid.
                </span>
              </label>

              <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
                You won't be charged now. Your payment method is required to verify your bid. If
                you're the highest bidder when the auction closes, we'll attempt to charge your
                winning bid.
              </p>

              <button
                type="submit"
                disabled={submitting || !isSupabaseConfigured || !isStripeConfigured}
                className="btn-cta w-full"
              >
                {submitting ? "Starting…" : "Continue & verify bid"}{" "}
                <span className="btn-arrow">→</span>
              </button>
            </form>
          )}
        </section>


      </main>


      <div className="mx-auto max-w-5xl px-6 pb-16">
        <SiteLinks />
      </div>

      <SiteFooter />
    </div>

  );
}
