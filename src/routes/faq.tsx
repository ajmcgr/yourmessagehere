import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteFooter, SiteLinks, SiteNav } from "@/components/SiteNav";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ & Rules — Your Message Here" },
      {
        name: "description",
        content:
          "How the weekly billboard auction works: bidding rules, the Friday 10:00 PM New York deadline, payment, creative specs and content policy.",
      },
      { property: "og:title", content: "FAQ & Rules — Your Message Here" },
      {
        property: "og:description",
        content:
          "Everything about bidding on the one billboard on the internet: rules, deadlines, payment, creative specs and content policy.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Faq,
});

type QA = { q: string; a: React.ReactNode };

const sections: { title: string; items: QA[] }[] = [
  {
    title: "The basics",
    items: [
      {
        q: "What is Your Message Here?",
        a: "One billboard on the internet. A single advertiser owns it at a time, for seven days. Anyone can bid for the next week.",
      },
      {
        q: "How does the auction work?",
        a: "Bidding runs continuously. Every auction closes at exactly 10:00 PM Friday, New York time. The highest bid at that moment wins the billboard for the following seven days.",
      },
      {
        q: "When does the winning creative go live?",
        a: "Once payment clears. The week runs from the Saturday after the auction closes through the following Friday.",
      },
      {
        q: "How much traffic does the billboard get?",
        a: "Everyone who visits the homepage sees it — there is nothing else on the page. Weekly traffic is shared with the winner and grows with each week.",
      },
    ],
  },
  {
    title: "Bidding rules",
    items: [
      {
        q: "What does it cost to bid?",
        a: "Nothing up front. Bidding is free and requires no account and no card — just your name, email, advertiser name and an amount.",
      },
      {
        q: "What is the minimum bid?",
        a: "The auction opens at $5 USD. Every subsequent bid must beat the current high bid by at least the $10 increment. All amounts are in USD.",
      },
      {
        q: "Can I bid more than the increment?",
        a: "Yes. Bid any amount at or above the current minimum. There is no maximum.",
      },
      {
        q: "Are bids binding?",
        a: "Yes. Placing a bid is a commitment to pay if you win. Bids cannot be retracted or lowered.",
      },
      {
        q: "Can I bid more than once?",
        a: "Yes — bid as many times as you like, as long as each new bid beats the current high bid.",
      },
      {
        q: "What happens if I get outbid?",
        a: "We email you immediately so you can bid again before the deadline.",
      },
      {
        q: "Are bids public?",
        a: "The current high bid and the advertiser name are public. Email addresses are never shown.",
      },
      {
        q: "What if two bids land at the same moment?",
        a: "Bids are validated on the server in the order they arrive. The first bid to clear the minimum wins the tie.",
      },
      {
        q: "Is there a last-minute sniping rule?",
        a: "No extensions. The auction ends at 10:00 PM New York time on the dot — whatever is highest then wins.",
      },
    ],
  },
  {
    title: "Winning and payment",
    items: [
      {
        q: "How do I know if I won?",
        a: "You get an email within moments of the auction closing, with a secure Stripe checkout link.",
      },
      {
        q: "How long do I have to pay?",
        a: "24 hours from the close of the auction. Payment is handled by Stripe — we never see your card details.",
      },
      {
        q: "What if I do not pay in time?",
        a: "The win is forfeited and the billboard is offered to the next highest bidder at their bid amount. Non-payers may be blocked from future auctions.",
      },
      {
        q: "Do you offer refunds?",
        a: "Payment is non-refundable once the creative is live. If your creative is rejected and you cannot supply a compliant replacement, you are refunded in full.",
      },
      {
        q: "Can I get an invoice or receipt?",
        a: "Yes — Stripe emails a receipt automatically, and an invoice is available on request.",
      },
    ],
  },
  {
    title: "Your creative",
    items: [
      {
        q: "What size should the image be?",
        a: (
          <>
            <span className="text-foreground">1600 × 900 px</span> (16:9), JPG or PNG, under 2 MB.
            For a retina-sharp file use 3200 × 1800 px.
          </>
        ),
      },
      {
        q: "When do I upload it?",
        a: "Right after payment. You get an upload link in your confirmation email.",
      },
      {
        q: "Can the billboard link somewhere?",
        a: "Yes. You provide one destination URL and the whole billboard links to it.",
      },
      {
        q: "Can I change my creative mid-week?",
        a: "One swap per week is allowed, subject to the same review. Email us and we will handle it.",
      },
      {
        q: "What if I miss the upload?",
        a: "Until your creative is uploaded and approved, the billboard shows the default placeholder. No refunds for unused days.",
      },
    ],
  },
  {
    title: "Content policy",
    items: [
      {
        q: "Is every creative reviewed?",
        a: "Yes. Every image and destination URL is manually reviewed before it goes live.",
      },
      {
        q: "What is not allowed?",
        a: "No illegal content, adult content, hate speech, harassment, malware, phishing, scams or deceptive claims, and nothing that impersonates another brand or person.",
      },
      {
        q: "Are crypto, gambling or political ads allowed?",
        a: "Case by case. They are not banned outright, but they must be legal, clearly disclosed and not misleading.",
      },
      {
        q: "Can you reject my creative after I have paid?",
        a: "Yes. You can supply a compliant replacement, or take a full refund if you would rather not.",
      },
    ],
  },
  {
    title: "Everything else",
    items: [
      {
        q: "Can I buy multiple weeks in a row?",
        a: "Only by winning each week's auction. There is no way to reserve future weeks.",
      },
      {
        q: "What happens to old ads?",
        a: (
          <>
            Every past advertiser stays online permanently in the{" "}
            <Link to="/archive" className="text-primary underline underline-offset-4">
              archive
            </Link>
            .
          </>
        ),
      },
      {
        q: "What if nobody bids?",
        a: "The billboard stays on its placeholder for that week and the next auction opens as normal at $50.",
      },
      {
        q: "How do I get in touch?",
        a: (
          <>
            Message{" "}
            <a
              href="https://x.com/alexmacgregor__"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-4"
            >
              @alexmacgregor__
            </a>{" "}
            on X, or reply to any email we send you.
          </>
        ),
      },
    ],
  },
];

function Faq() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />

      <main className="mx-auto max-w-3xl px-6 pb-32">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">FAQ &amp; rules</h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
          One billboard. Bidding is free and open to anyone. Every auction closes at 10:00 PM Friday,
          New York time.
        </p>

        <div className="mt-12 space-y-14">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                {section.title}
              </h2>
              <dl className="mt-6 divide-y divide-border border-t border-border">
                {section.items.map((item) => (
                  <div key={item.q} className="py-5">
                    <dt className="text-base font-bold leading-snug">{item.q}</dt>
                    <dd className="mt-2 text-base leading-relaxed text-muted-foreground">
                      {item.a}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>

        <div className="mt-16">
          <Link
            to="/buy"
            className="inline-block rounded-lg bg-foreground px-6 py-2.5 text-sm font-medium tracking-tight text-background transition-opacity hover:opacity-80"
          >
            Buy this billboard →
          </Link>
        </div>
      </main>

      <div className="mx-auto max-w-5xl px-6 pb-16">
        <SiteLinks />
      </div>

      <SiteFooter />
    </div>
  );
}
