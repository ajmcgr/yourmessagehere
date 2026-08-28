import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { Billboard } from "@/components/Billboard";
import { Countdown } from "@/components/Countdown";
import { useAuction } from "@/hooks/useAuction";
import { formatUsd, recordPageView } from "@/lib/ymh";
import { SiteFooter, SiteNav } from "@/components/SiteNav";
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
      { property: "og:url", content: "https://yourmessagehere.co/" },
      { property: "og:image", content: "https://yourmessagehere.co/og.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://yourmessagehere.co/og.jpg" },
    ],
    links: [{ rel: "canonical", href: "https://yourmessagehere.co/" }],
  }),
  component: Index,
});

function Index() {
  const { billboard, currentBidCents, startingBidCents, endsAt, loading } = useAuction();
  const hasActiveAdvertiser = !loading && billboard?.status === "approved";

  useEffect(() => {
    void recordPageView();
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
    <div className="flex min-h-[100dvh] flex-col bg-background text-foreground">
      <SiteNav ctaActive={hasActiveAdvertiser} ctaLoading={loading} />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-8 md:px-6">
        <h1 className="sr-only">Your Message Here — the internet's billboard</h1>

        <section className="flex flex-1 items-center justify-center py-2">
          <div className="w-full">
            <Billboard billboard={billboard} loading={loading} />
          </div>
        </section>

        <section className="mt-6 text-sm md:mt-8">

          {loading ? (
            <div className="flex flex-col gap-2.5 md:flex-row md:flex-wrap md:items-center md:justify-center md:gap-x-7 md:gap-y-3">
              <div className="flex items-center justify-between gap-4 md:contents">
                <Skeleton className="h-5 w-44 md:order-2" />
                <Skeleton className="h-5 w-28 md:order-3" />
              </div>
              <div className="flex items-center justify-between gap-4 md:contents">
                <Skeleton className="h-5 w-52 md:order-1" />
              </div>
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

        <section className="mt-4 text-center md:mt-5">
          <p className="mx-auto text-sm leading-relaxed text-balance text-muted-foreground sm:whitespace-nowrap">
            One brand owns this billboard each week. Changes Fridays at 10 PM New York time.{" "}
            <a
              href="https://cloud.umami.is/share/81qD5QRhMHc3UUN0"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
            >
              {visitors === null ? "Traffic ↗" : `Total visitors ${visitors.toLocaleString("en-US")} ↗`}
            </a>
          </p>

        </section>
      </main>

      <SiteFooter />
    </div>

  );
}
