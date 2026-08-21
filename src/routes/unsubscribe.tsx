import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteFooter, SiteLinks, SiteNav } from "@/components/SiteNav";
import { functionsUrl } from "@/lib/supabase";

export const Route = createFileRoute("/unsubscribe")({
  head: () => ({
    meta: [
      { title: "Unsubscribe — Your Message Here" },
      {
        name: "description",
        content:
          "Stop receiving the weekly reminder email from Your Message Here, the internet's billboard.",
      },
      { property: "og:title", content: "Unsubscribe — Your Message Here" },
      {
        property: "og:description",
        content: "Stop receiving the weekly bidding reminder from Your Message Here.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Unsubscribe,
});

function Unsubscribe() {
  const [state, setState] = useState<"working" | "done" | "error">("working");
  const [email, setEmail] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const e = params.get("e") ?? "";
    const t = params.get("t") ?? "";
    setEmail(e);
    if (!e || !t) {
      setState("error");
      return;
    }
    void fetch(functionsUrl("ymh-unsubscribe"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: e, token: t }),
    })
      .then((r) => setState(r.ok ? "done" : "error"))
      .catch(() => setState("error"));
  }, []);

  return (
    <div className="min-h-dvh">
      <SiteNav />
      <main className="mx-auto w-full max-w-2xl px-6 py-20">
        <h1 className="text-3xl font-semibold tracking-tight">
          {state === "done" ? "You're unsubscribed" : state === "error" ? "Link not valid" : "One moment…"}
        </h1>
        <p className="mt-4 text-muted-foreground">
          {state === "done"
            ? `${email} won't receive the weekly reminder any more. You can still bid any time at yourmessagehere.co.`
            : state === "error"
              ? "This unsubscribe link is incomplete or expired. Reply to any of our emails and we'll remove you."
              : "Removing you from the weekly reminder."}
        </p>
        <SiteLinks className="mt-12" />
        <SiteFooter />
      </main>
    </div>
  );
}
