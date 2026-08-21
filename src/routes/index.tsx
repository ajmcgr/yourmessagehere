import { createFileRoute, Link } from "@tanstack/react-router";
import { Billboard } from "@/components/Billboard";
import { Countdown } from "@/components/Countdown";
import { useAuction } from "@/hooks/useAuction";
import { formatUsd } from "@/lib/ymh";
import logo from "@/assets/logo.png.asset.json";

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
      <header className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-6 pt-3 pb-6">
        <Link to="/" className="min-w-0 transition-opacity hover:opacity-60">
          <img src={logo.url} alt="Your Message Here" className="h-9 w-auto md:h-12" />
        </Link>
        <Link
          to="/buy"
          className="shrink-0 bg-foreground px-5 py-2 text-sm font-medium tracking-tight text-background transition-opacity hover:opacity-80"
        >
          Buy
        </Link>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-32">
        <h1 className="sr-only">Your Message Here — the internet's billboard</h1>

        <section className="pt-8 md:pt-16">
          <Billboard billboard={billboard} />
        </section>

        <section className="mt-10 flex flex-wrap items-center justify-center gap-8 text-sm font-semibold text-foreground md:mt-12">
          <span>
            Current bid{" "}
            <span className="tabular-nums">{formatUsd(currentBidCents ?? startingBidCents)}</span>
          </span>
          <span className="tabular-nums">
            <Countdown target={endsAt} />
          </span>
          <Link to="/buy" className="underline-offset-4 hover:underline">
            Buy this billboard →
          </Link>
        </section>

        <section className="mt-8 text-center md:mt-10">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Every Friday at 10:00 PM New York time, the highest bidder wins it for the following
            seven days.
          </p>
        </section>
      </main>

      <footer className="mx-auto max-w-5xl px-6 pb-10 text-center text-xs leading-relaxed text-muted-foreground">
        Copyright © 2026 Works App, Inc. Built with 🫶🏻 by{" "}
        <a
          href="https://x.com/alexmacgregor__"
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground underline-offset-4 hover:underline"
        >
          Alex
        </a>
        .
      </footer>
    </div>
  );
}
