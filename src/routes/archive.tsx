import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteFooter, SiteLinks, SiteNav } from "@/components/SiteNav";
import { fetchArchivedBillboards, type Billboard } from "@/lib/ymh";

export const Route = createFileRoute("/archive")({
  head: () => ({
    meta: [
      { title: "Archive — every advertiser who owned the billboard" },
      {
        name: "description",
        content:
          "A week-by-week record of every advertiser who has owned the internet's only billboard.",
      },
      { property: "og:title", content: "Archive — Your Message Here" },
      {
        property: "og:description",
        content: "Every advertiser who has owned the internet's only billboard, week by week.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Archive,
});

const week = (start: string, end: string) => {
  const f = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${f(start)} – ${f(end)}, ${new Date(end).getUTCFullYear()}`;
};

function Archive() {
  const [items, setItems] = useState<Billboard[] | null>(null);

  useEffect(() => {
    let active = true;
    fetchArchivedBillboards().then((rows) => {
      if (active) setItems(rows);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />

      <main className="mx-auto max-w-5xl px-6 pb-32">
        <h1 className="text-3xl font-medium tracking-tight md:text-4xl">Archive</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Every advertiser who has owned the billboard, one week at a time.
        </p>

        {items === null ? (
          <p className="mt-16 text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="mt-16 text-sm text-muted-foreground">
            No past advertisers yet. The first week is still up for auction.
          </p>
        ) : (
          <ul className="mt-16 grid gap-12 md:grid-cols-2">
            {items.map((b) => (
              <li key={b.id}>
                <div className="aspect-video w-full overflow-hidden border border-foreground/15">
                  {b.image_url ? (
                    <img
                      src={b.image_url}
                      alt={b.headline ?? b.advertiser ?? "Billboard creative"}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                      {b.headline ?? "—"}
                    </div>
                  )}
                </div>
                <div className="mt-4 flex items-baseline justify-between gap-4 text-sm">
                  <span className="font-medium">
                    {b.click_url ? (
                      <a
                        href={b.click_url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="underline-offset-4 hover:underline"
                      >
                        {b.advertiser ?? "Unknown"}
                      </a>
                    ) : (
                      (b.advertiser ?? "Unknown")
                    )}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {week(b.week_start, b.week_end)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      <div className="mx-auto max-w-5xl px-6 pb-16">
        <SiteLinks />
      </div>

      <SiteFooter />
    </div>
  );
}
