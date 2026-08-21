import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Billboard } from "@/components/Billboard";
import { Countdown } from "@/components/Countdown";
import { useAuction } from "@/hooks/useAuction";
import { useSiteDescriptions } from "@/hooks/useSiteDescriptions";
import { formatUsd, placeBid, recordPageView, weekEndingLabel } from "@/lib/ymh";

import { isSupabaseConfigured } from "@/lib/supabase";
import { SiteFooter, SiteLinks, SiteNav } from "@/components/SiteNav";

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
  const { auction, billboard, bids, currentBidCents, minBidCents, incrementCents, endsAt, reload } =
    useAuction();
  const descriptions = useSiteDescriptions(bids.map((b) => b.website));
  const [views, setViews] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountCents = Math.round(Number(form.amount) * 100);
    if (!Number.isFinite(amountCents) || amountCents < minBidCents) {
      toast.error(`Minimum bid is ${formatUsd(minBidCents)}.`);
      return;
    }
    setSubmitting(true);
    try {
      const raw = form.website.trim();
      const website = raw && !/^https?:\/\//i.test(raw) ? `https://${raw}` : raw;
      await placeBid({
        name: form.name.trim(),
        email: form.email.trim(),
        advertiser: form.advertiser.trim(),
        amount_cents: amountCents,
        ...(website ? { website } : {}),
      });
      toast.success("Bid placed. You're the highest bidder.");
      setForm((f) => ({ ...f, amount: "" }));
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Your bid could not be placed.");
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
                  <Skeleton className="size-10 shrink-0 rounded" />
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
              Advertisers ({bids.length})
            </h2>
            <div className="mt-4 max-h-[28rem] overflow-y-auto border-t border-foreground/10">
              <table className="w-full text-base">
                <thead className="sticky top-0 bg-background">
                  <tr className="text-left text-xs font-bold tracking-normal text-foreground">
                    <th className="w-8 py-4 font-bold">#</th>
                    <th className="py-4 font-bold">Advertiser</th>
                    <th className="hidden py-4 font-bold md:table-cell whitespace-nowrap">Placed</th>
                    <th className="py-4 text-right font-bold">Bid</th>
                  </tr>
                </thead>

                <tbody>
                  {bids.map((b, i) => {
                    const host = b.website
                      ? b.website.replace(/^https?:\/\//i, "").replace(/\/.*$/, "")
                      : null;
                    const description = b.website ? descriptions[b.website] : undefined;
                    return (
                      <tr
                        key={b.id}
                        onClick={
                          b.website
                            ? () => window.open(b.website!, "_blank", "noopener,noreferrer")
                            : undefined
                        }
                        className={`border-t border-foreground/10 align-middle ${
                          b.website ? "cursor-pointer transition-colors hover:bg-foreground/5" : ""
                        }`}
                      >
                        <td className="py-5 text-sm tabular-nums text-muted-foreground">{i + 1}</td>
                        <td className="py-5 pr-4">
                          <div className="flex items-center gap-4">
                            {host ? (
                              <img
                                src={`https://www.google.com/s2/favicons?sz=128&domain=${host}`}
                                alt=""
                                loading="lazy"
                                className="size-10 shrink-0 rounded"
                              />
                            ) : (
                              <span className="size-10 shrink-0 rounded bg-foreground/10" />
                            )}
                            <span className="min-w-0">
                              {b.website ? (
                                <a
                                  href={b.website}
                                  target="_blank"
                                  rel="noopener noreferrer nofollow"
                                  onClick={(e) => e.stopPropagation()}
                                  className="block truncate text-foreground underline-offset-4 hover:underline"
                                >
                                  {b.advertiser}
                                </a>
                              ) : (
                                <span className="block truncate text-foreground">{b.advertiser}</span>
                              )}
                              {description && (
                                <span className="block truncate text-sm text-muted-foreground">
                                  {description}
                                </span>
                              )}
                            </span>
                          </div>
                        </td>
                        <td className="hidden whitespace-nowrap py-5 text-sm text-muted-foreground md:table-cell">
                          {timeAgo(b.created_at)}
                        </td>
                        <td className="py-5 text-right tabular-nums text-foreground">
                          {formatUsd(b.amount_cents)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}


        <section id="place-bid" className="mt-16 scroll-mt-24">
          <h1 className="text-2xl font-medium tracking-tight">Place a bid</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            No account. No payment now. If you win, we email you a Stripe link and you upload your
            creative. Minimum bid {formatUsd(minBidCents)} (increments of{" "}
            {formatUsd(incrementCents)}).
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

            <button
              type="submit"
              disabled={submitting || !isSupabaseConfigured}
              className="btn-cta w-full"
            >
              {submitting ? "Placing bid…" : "Place bid"}
            </button>
          </form>
        </section>

      </main>


      <div className="mx-auto max-w-5xl px-6 pb-16">
        <SiteLinks />
      </div>

      <SiteFooter />
    </div>

  );
}
