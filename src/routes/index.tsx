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
      <header className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-8">
        <Link to="/" className="transition-opacity hover:opacity-60">
          <img src={logo.url} alt="Your Message Here" className="h-9 w-auto md:h-12" />
        </Link>
        <div className="flex items-center gap-8 text-sm text-muted-foreground">
          <span>
            Current bid{" "}
            <span className="font-medium text-foreground tabular-nums">
              {formatUsd(currentBidCents ?? startingBidCents)}
            </span>
          </span>
          <Countdown target={endsAt} />
          <Link
            to="/buy"
            className="bg-foreground px-5 py-2 text-sm font-medium tracking-tight text-background transition-opacity hover:opacity-80"
          >
            Buy
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-32">
        <h1 className="sr-only">Your Message Here — the internet's billboard</h1>

        <section className="pt-8 md:pt-16">
          <Billboard billboard={billboard} />
        </section>

        <section className="mt-16 flex flex-col items-center gap-6 text-center md:mt-24">
          <Link
            to="/buy"
            className="border-b-2 border-foreground pb-1 text-2xl font-medium tracking-tight transition-opacity hover:opacity-60 md:text-4xl"
          >
            Buy this billboard →
          </Link>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            There is one billboard on the internet. Every Friday at 10:00 PM New York time, the
            highest bidder wins it for the following seven days.
          </p>
        </section>
      </main>

      <footer className="mx-auto max-w-5xl px-6 pb-10 text-center text-xs text-muted-foreground">
        Copyright © 2026 Works App, Inc. Built with 🫶🏻 by{" "}
        <a
          href="https://x.com/alexmacgregor__"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Alex
        </a>
        .
      </footer>
    </div>
  );
}
