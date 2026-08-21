import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Billboard } from "@/components/Billboard";
import { Countdown } from "@/components/Countdown";
import { useAuction } from "@/hooks/useAuction";
import { formatUsd, recordPageView, weekEndingLabel } from "@/lib/ymh";
import { SiteFooter, SiteLinks, SiteNav } from "@/components/SiteNav";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";



export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Your Message Here — The Internet's Billboard" },
      {
        name: "description",
        content:
          "One billboard. One winner a week. Bid to own the internet's simplest billboard for seven days. Auction ends every Friday at 10:00 PM New York time.",
      },
      { property: "og:title", content: "Your Message Here — The Internet's Billboard" },
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
  const { auction, billboard, currentBidCents, startingBidCents, endsAt, loading } = useAuction();
  const [views, setViews] = useState<number | null>(null);
  const hasActiveAdvertiser = !loading && billboard?.status === "approved";

  useEffect(() => {
    void recordPageView().then(setViews);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("ymh_bookmark_prompt_seen")) return;
    const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    const timer = window.setTimeout(() => {
      localStorage.setItem("ymh_bookmark_prompt_seen", "1");
      toast("Bookmark the billboard", {
        description: `Check back every Friday to see who won the week. ${
          isMac ? "⌘" : "Ctrl"
        } + D to save it.`,
        duration: 8000,
      });
    }, 2500);
    return () => window.clearTimeout(timer);
  }, []);


  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav ctaActive={hasActiveAdvertiser} />

      <main className="mx-auto max-w-5xl px-6 pb-8">
        <h1 className="sr-only">Your Message Here — the internet's billboard</h1>

        <section className="flex min-h-[55vh] items-center pt-16 md:min-h-0 md:pt-16">
          <div className="w-full">
            <Billboard billboard={billboard} loading={loading} />
          </div>
        </section>


        <section className="mt-6 flex flex-col items-center gap-3 text-sm md:mt-8 md:flex-row md:flex-wrap md:justify-center md:gap-x-7 md:gap-y-3">
          {loading ? (
            <>
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-5 w-36" />
            </>
          ) : (
            <>
              <span className="order-1 text-base font-semibold text-foreground md:order-none md:text-sm">
                Current bid{" "}
                <span className="marker-highlight tabular-nums font-bold">
                  {formatUsd(currentBidCents ?? startingBidCents)}
                </span>
              </span>

              <span className="order-2 md:order-none">
                <span className="font-semibold text-foreground">Auction ends</span>{" "}
                <Countdown target={endsAt} suffix="" />
              </span>

              <span className="order-3 md:order-none">
                <span className="font-semibold text-foreground">Audience</span>{" "}
                {views === null ? (
                  <Skeleton className="inline-block h-3 w-12 align-middle" />
                ) : (
                  <span className="tabular-nums font-medium text-foreground">
                    {views.toLocaleString("en-US")}
                  </span>
                )}
              </span>

              <Link
                to="/buy"
                className="order-4 font-semibold text-foreground underline-offset-4 hover:underline md:order-first"
              >
                Buy this billboard →
              </Link>

              <span className="order-5 text-xs text-muted-foreground md:order-none">
                <span className="md:hidden">{weekEndingLabel(auction, endsAt, { short: true })}</span>
                <span className="hidden md:inline">
                  {weekEndingLabel(auction, endsAt, { short: true })}
                </span>
              </span>
            </>
          )}
        </section>

        <section className="mt-6 text-center md:mt-7">
          <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
            The internet's billboard. One brand owns it for a week. Highest bid wins the next one.
          </p>
        </section>


        <SiteLinks className="mt-16 md:mt-[22vh]" />
      </main>

      <SiteFooter />
    </div>

  );
}
