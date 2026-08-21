import { createFileRoute, Link } from "@tanstack/react-router";
import { Billboard } from "@/components/Billboard";
import { Countdown } from "@/components/Countdown";
import { useAuction } from "@/hooks/useAuction";
import { formatUsd, weekEndingLabel } from "@/lib/ymh";
import { SiteFooter, SiteLinks, SiteNav } from "@/components/SiteNav";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Your Message Here — One billboard on the internet" },
      {
        name: "description",
        content:
          "One billboard. One winner a week. Bid to own the internet's simplest billboard for seven days. Auction ends every Friday at 10:00 PM New York time.",
      },
      { property: "og:title", content: "Your Message Here — One billboard on the internet" },
      {
        property: "og:description",
        content:
          "One billboard. One winner a week. Bidding closes every Friday at 10:00 PM New York time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const { auction, billboard, currentBidCents, startingBidCents, endsAt } = useAuction();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />

      <main className="mx-auto max-w-5xl px-6 pb-32">
        <h1 className="sr-only">Your Message Here — the internet's billboard</h1>

        <section className="pt-8 md:pt-16">
          <Billboard billboard={billboard} />
        </section>

        <section className="mt-10 flex flex-wrap items-center justify-center gap-8 text-sm font-semibold text-foreground md:mt-12">
          <Link to="/buy" className="underline-offset-4 hover:underline">
            Buy this billboard →
          </Link>
          <span className="marker-highlight">
            Current bid{" "}
            <span className="tabular-nums">{formatUsd(currentBidCents ?? startingBidCents)}</span>
          </span>

          <span className="tabular-nums">
            <Countdown target={endsAt} />
          </span>
          <span className="text-muted-foreground">{weekEndingLabel(auction, endsAt)}</span>
        </section>

        <section className="mt-8 text-center md:mt-10">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Every Friday at 10:00 PM New York time, the highest bidder wins it for the following
            seven days.
          </p>
        </section>

        <SiteLinks />
      </main>

      <SiteFooter />
    </div>

  );
}
