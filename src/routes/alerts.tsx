import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SiteFooter, SiteNav } from "@/components/SiteNav";
import { subscribeToAlerts } from "@/lib/ymh";

export const Route = createFileRoute("/alerts")({
  head: () => ({
    meta: [
      { title: "Email Alerts — Your Message Here" },
      {
        name: "description",
        content:
          "Get an email every Friday night when a new bidding window opens on the internet's billboard.",
      },
      { property: "og:title", content: "Email Alerts — Your Message Here" },
      {
        property: "og:description",
        content:
          "One email a week when the billboard reopens for bidding. No spam, unsubscribe any time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Alerts,
});

const EMAIL_RE = /^[^@\s]+@[^@\s.]+\.[^@\s]+$/;

function Alerts() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!EMAIL_RE.test(value) || value.length > 254) {
      setState("error");
      setMessage("That email doesn't look right.");
      return;
    }
    setState("sending");
    const ok = await subscribeToAlerts(value);
    if (ok) {
      setState("done");
      setMessage("");
    } else {
      setState("error");
      setMessage("Something went wrong. Try again in a moment.");
    }
  }

  return (
    <div className="min-h-dvh">
      <SiteNav />
      <main className="mx-auto w-full max-w-2xl px-6 py-16 md:py-20">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Email alerts</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          Every Friday at 10:00 PM New York time the auction closes and a new one opens. Drop your
          email and we'll tell you the moment the billboard is up for grabs again — including the
          bid you'd need to beat.
        </p>

        {state === "done" ? (
          <div className="mt-8 rounded-lg border border-border bg-card p-6">
            <p className="font-semibold">You're on the list.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              We'll email {email.trim().toLowerCase()} when the next bidding window opens. Every
              email has a one-click unsubscribe.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-3 sm:flex-row">
            <label htmlFor="alerts-email" className="sr-only">
              Email address
            </label>
            <input
              id="alerts-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (state === "error") setState("idle");
              }}
              placeholder="you@company.com"
              className="h-12 w-full flex-1 rounded-lg border border-border bg-background px-4 text-base outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground"
            />
            <button type="submit" disabled={state === "sending"} className="btn-cta h-12 shrink-0">
              {state === "sending" ? "Adding…" : "Notify me"}{" "}
              <span className="btn-arrow" aria-hidden="true">
                →
              </span>
            </button>
          </form>
        )}

        {state === "error" && <p className="mt-3 text-sm text-destructive">{message}</p>}

        <p className="mt-6 text-sm text-muted-foreground">
          One email a week, nothing else. Unsubscribe any time.
        </p>

        <SiteFooter />
      </main>
    </div>
  );
}
