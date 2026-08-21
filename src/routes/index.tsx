import { createFileRoute, Link } from "@tanstack/react-router";
import { Billboard } from "@/components/Billboard";
import { Countdown } from "@/components/Countdown";
import { useAuction } from "@/hooks/useAuction";
import { formatUsd } from "@/lib/ymh";

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
  const { billboard, currentBidCents, startingBidCents, endsAt } = useAuction();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-5xl flex-wrap items-baseline justify-between gap-4 px-6 py-8">
        <span className="text-sm font-medium tracking-tight">Your Message Here</span>
        <div className="flex items-baseline gap-8 text-sm text-muted-foreground">
          <span>
            Current bid{" "}
            <span className="font-medium text-foreground tabular-nums">
              {formatUsd(currentBidCents ?? startingBidCents)}
            </span>
          </span>
          <Countdown target={endsAt} />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-32">
        <h1 className="sr-only">Your Message Here — the internet's billboard</h1>

        <section className="pt-8 md:pt-16">
          <Billboard billboard={billboard} />
        </section>

        <section className="mt-16 flex flex-col items-start gap-6 md:mt-24">
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            There is one billboard on the internet. Every Friday at 10:00 PM New York time, the
            highest bidder wins it for the following seven days.
          </p>
          <Link
            to="/buy"
            className="border-b border-foreground pb-1 text-base font-medium tracking-tight transition-opacity hover:opacity-60"
          >
            Buy this billboard →
          </Link>
        </section>
      </main>

      <footer className="mx-auto max-w-5xl px-6 pb-10 text-xs text-muted-foreground">
        yourmessagehere.co
      </footer>
    </div>
  );
}
