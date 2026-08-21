import { createFileRoute } from "@tanstack/react-router";
import { SiteFooter, SiteLinks, SiteNav } from "@/components/SiteNav";
import portrait from "@/assets/alex.png.asset.json";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — Your Message Here" },
      {
        name: "description",
        content:
          "Why there is exactly one billboard on the internet, auctioned every Friday at 10:00 PM New York time.",
      },
      { property: "og:title", content: "About — Your Message Here" },
      {
        property: "og:description",
        content: "One billboard. One winner a week. A letter from the founder.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: About,
});

function About() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />

      <main className="mx-auto max-w-3xl px-6 pb-32">
        <article className="rounded-xl border border-border bg-card p-8 md:p-12">
          <h1 className="text-center text-3xl font-bold tracking-tight md:text-4xl">
            About Your Message Here
          </h1>

          <div className="mt-10 space-y-5 text-base leading-relaxed">
            <p>Your Message Here is one billboard on the internet.</p>

            <p className="font-bold">Hello there!</p>

            <p>
              Advertising online has become infinitely divisible — a million impressions, a million
              placements, none of them memorable. We wanted the opposite: a single space, owned by a
              single advertiser, seen by everyone who visits.
            </p>

            <p>
              Anyone can bid. No account, no payment up front — just a name, an email and a number.
              Every Friday at 10:00 PM New York time the auction closes, the highest bidder pays,
              and their creative goes up for the following seven days.
            </p>

            <p>
              Whether you're launching something, hiring, or just want to say something to the
              internet for a week, the billboard is yours if you win it. Every advertiser who has
              owned it is kept in the archive.
            </p>
          </div>

          <div className="mt-12">
            <img
              src={portrait.url}
              alt="Alex MacGregor"
              className="h-32 w-32 object-cover"
              loading="lazy"
            />
            <p className="mt-5 font-bold leading-snug">
              Alex MacGregor
              <br />
              Founder, Your Message Here
            </p>
            <a
              href="https://x.com/alexmacgregor__"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-sm font-medium text-primary underline underline-offset-4"
            >
              Follow me on X
            </a>
          </div>
        </article>
      </main>


      <div className="mx-auto max-w-5xl px-6 pb-16">
        <SiteLinks />
      </div>

      <SiteFooter />
    </div>
  );
}
