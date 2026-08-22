import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Billboard } from "@/components/Billboard";
import { Countdown } from "@/components/Countdown";
import { useAuction } from "@/hooks/useAuction";
import { formatUsd, recordPageView } from "@/lib/ymh";
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
  const { billboard, currentBidCents, startingBidCents, endsAt, loading } = useAuction();
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

        <div className="flex min-h-[70vh] flex-col justify-center pt-5 md:block md:min-h-0 md:pt-8">
        <section>
          <div className="w-full">
            <Billboard billboard={billboard} loading={loading} />
          </div>
        </section>

        <section className="mt-3.5 text-sm md:mt-5">

          {loading ? (
            <div className="flex flex-wrap items-center justify-between gap-2.5 md:justify-center md:gap-x-7">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-5 w-36" />
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 md:flex-row md:flex-wrap md:items-center md:justify-center md:gap-x-7 md:gap-y-3">
              <div className="flex items-center justify-between gap-4 md:contents">
                <span className="font-semibold text-foreground md:order-2">
                  {currentBidCents === null ? "Opening bid" : "Current bid"}{" "}
                  <span className="marker-highlight tabular-nums font-bold">
                    {formatUsd(currentBidCents ?? startingBidCents)}
                  </span>
                </span>

                <span className="md:order-3">
                  <Countdown target={endsAt} suffix=" left" />
                </span>
              </div>

              <div className="flex items-center justify-between gap-4 md:contents">
                <span className="text-muted-foreground md:order-4">
                  <span className="font-semibold text-foreground">Page views</span>{" "}
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
                  className="font-semibold text-foreground underline underline-offset-4 md:order-1"
                >
                  {hasActiveAdvertiser ? "Buy next week’s billboard →" : "Buy the billboard →"}
                </Link>
              </div>
            </div>
          )}
        </section>

        <section className="mt-6 text-center md:mt-8">
          <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
            One brand owns this billboard each week. Highest bid wins next week.
          </p>
        </section>
        </div>


        <SiteLinks className="mt-16 md:mt-[18vh]" />

      </main>

      <SiteFooter />
    </div>

  );
}
