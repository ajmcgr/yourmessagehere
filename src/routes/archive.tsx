import { BrandIcon } from "@/components/BrandIcon";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteFooter, SiteLinks, SiteNav } from "@/components/SiteNav";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchArchivedWeeks, formatUsd, type ArchivedWeek } from "@/lib/ymh";

export const Route = createFileRoute("/archive")({
  head: () => ({
    meta: [
      { title: "Archive — every advertiser who owned the billboard" },
      {
        name: "description",
        content:
          "A week-by-week record of every advertiser who has owned the internet's only billboard, including the full bid history for each week.",
      },
      { property: "og:title", content: "Archive — Your Message Here" },
      {
        property: "og:description",
        content: "Every advertiser and every bid, week by week.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Archive,
});


const host = (url: string | null) => {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
};

function Archive() {
  const [items, setItems] = useState<ArchivedWeek[] | null>(null);

  useEffect(() => {
    let active = true;
    fetchArchivedWeeks().then((rows) => {
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
          Every advertiser who has owned the billboard, one week at a time — along with every brand
          that bid for it.
        </p>

        {items === null ? (
          <div className="mt-16 space-y-16">
            {[0, 1].map((i) => (
              <div key={i}>
                <Skeleton className="aspect-video w-full max-w-2xl" />
                <Skeleton className="mt-4 h-4 w-56" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="mt-16 text-sm text-muted-foreground">
            No past weeks yet. The first week is still up for auction.
          </p>
        ) : (
          <ul className="mt-16 space-y-20">
            {items.map(({ auction, billboard, bids }) => {
              const winner = bids[0] ?? null;
              return (
                <li key={auction.id}>
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <h2 className="text-lg font-medium tracking-tight">
                      Week ending{" "}
                      {new Date(auction.week_end).toLocaleDateString("en-US", {
                        timeZone: "UTC",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </h2>
                  </div>

                  {(() => {
                    const creativeHref = billboard?.click_url ?? winner?.website ?? null;
                    const creative = billboard?.image_url ? (
                      <img
                        src={billboard.image_url}
                        alt={billboard.headline ?? billboard.advertiser ?? "Billboard creative"}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                        {billboard?.headline ?? "No creative"}
                      </div>
                    );
                    return (
                  <div className="mt-5 grid gap-8 md:grid-cols-2">
                    <div>
                      <div className="aspect-video w-full overflow-hidden border border-foreground/15">
                        {creativeHref ? (
                          <a
                            href={creativeHref}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            className="block h-full w-full"
                          >
                            {creative}
                          </a>
                        ) : (
                          creative
                        )}
                      </div>
                      <div className="mt-4 flex items-baseline justify-between gap-4 text-sm">
                        <span className="font-bold">
                          {billboard?.click_url || winner?.website ? (
                            <a
                              href={(billboard?.click_url ?? winner?.website)!}
                              target="_blank"
                              rel="noopener noreferrer nofollow"
                              className="underline-offset-4 hover:underline"
                            >
                              {billboard?.advertiser ?? winner?.advertiser ?? "Unknown"}
                            </a>
                          ) : (
                            (billboard?.advertiser ?? winner?.advertiser ?? "Unknown")
                          )}
                        </span>
                        {winner ? (
                          <span className="font-bold tabular-nums text-money">
                            {formatUsd(winner.amount_cents)}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-col">
                      <div className="flex items-baseline justify-between gap-4">
                        <h3 className="text-sm font-bold">Bids</h3>
                        <span className="text-sm text-muted-foreground">
                          Top {Math.min(bids.length, 5)}
                        </span>
                      </div>

                      {bids.length === 0 ? (
                        <p className="mt-4 text-sm text-muted-foreground">No bids recorded.</p>
                      ) : (
                        <div className="mt-4 flex-1">
                          <table className="h-full w-full table-fixed border-collapse text-sm">
                            <tbody>
                              {bids.slice(0, 5).map((b, idx) => {
                                const h = host(b.website);
                                return (
                                  <tr
                                    key={b.id}
                                    className={`border-b border-foreground/10 ${
                                      idx === 0 ? "bg-money/10" : ""
                                    } ${b.website ? "cursor-pointer hover:bg-foreground/[0.03]" : ""}`}
                                    onClick={() => {
                                      if (b.website)
                                        window.open(b.website, "_blank", "noopener,noreferrer");
                                    }}
                                  >
                                    <td className="py-2 pr-3 pl-3 sm:pl-4">
                                      <div className="flex min-w-0 items-center gap-3">
                                        <BrandIcon host={h} className="size-8 sm:size-10" />
                                        <span className="truncate font-bold">{b.advertiser}</span>
                                      </div>
                                    </td>
                                    <td className="w-24 py-2 pr-3 text-right font-bold tabular-nums whitespace-nowrap text-money sm:pr-4">
                                      {formatUsd(b.amount_cents)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                  </div>
                </li>
              );
            })}
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
