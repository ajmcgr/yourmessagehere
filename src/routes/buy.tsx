import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Billboard } from "@/components/Billboard";
import { Countdown } from "@/components/Countdown";
import { useAuction } from "@/hooks/useAuction";
import { formatUsd, placeBid } from "@/lib/ymh";
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
  const { billboard, bids, currentBidCents, minBidCents, incrementCents, endsAt, reload } =
    useAuction();
  const [submitting, setSubmitting] = useState(false);
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
      const website = form.website.trim();
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

  const field =
    "w-full border-0 border-b border-foreground/20 bg-transparent py-3 text-base outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />


      <main className="mx-auto grid max-w-5xl gap-16 px-6 pb-32 md:grid-cols-2">
        <section>
          <Billboard billboard={billboard} />
          <dl className="mt-10 space-y-6">
            <div>
              <dt className="text-xs uppercase tracking-widest text-muted-foreground">
                Current bid
              </dt>
              <dd className="text-4xl font-medium tracking-tight tabular-nums md:text-6xl">
                {currentBidCents === null ? "No bids yet" : formatUsd(currentBidCents)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-widest text-muted-foreground">
                Auction ends in
              </dt>
              <dd>
                <Countdown target={endsAt} size="lg" />
              </dd>
            </div>
          </dl>

          {bids.length > 0 && (
            <ul className="mt-10 space-y-2 text-sm text-muted-foreground">
              {bids.map((b) => (
                <li key={b.id} className="flex justify-between border-b border-foreground/10 py-2">
                  <span>{b.advertiser}</span>
                  <span className="tabular-nums text-foreground">{formatUsd(b.amount_cents)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h1 className="text-2xl font-medium tracking-tight">Place a bid</h1>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
            No account. No payment now. If you win, we email you a Stripe link and you upload your
            creative. Minimum bid {formatUsd(minBidCents)} (increments of{" "}
            {formatUsd(incrementCents)}).
          </p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
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
              type="url"
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
              className="w-full bg-foreground py-4 text-sm font-medium tracking-tight text-background transition-opacity hover:opacity-80 disabled:opacity-40"
            >
              {submitting ? "Placing bid…" : "Place bid"}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
