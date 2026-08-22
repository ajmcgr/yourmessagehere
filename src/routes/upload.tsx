import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteFooter, SiteNav } from "@/components/SiteNav";
import {
  fetchCreativeContext,
  formatUsd,
  submitCreative,
  uploadCreativeImage,
  type CreativeContext,
} from "@/lib/ymh";

export const Route = createFileRoute("/upload")({
  head: () => ({
    meta: [
      { title: "Upload your creative — Your Message Here" },
      {
        name: "description",
        content:
          "Winners upload the image, headline, and link that runs on the internet's billboard for their week.",
      },
      { property: "og:title", content: "Upload your creative — Your Message Here" },
      {
        property: "og:description",
        content: "Send us the artwork for your week on the billboard.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search["token"] === "string" ? search["token"] : "",
  }),
  component: UploadPage,
});

function UploadPage() {
  const { token } = Route.useSearch();
  const [ctx, setCtx] = useState<CreativeContext | null>(null);
  const [loading, setLoading] = useState(true);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [clickUrl, setClickUrl] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let alive = true;
    if (!token) {
      setLoading(false);
      return;
    }
    fetchCreativeContext(token).then((res) => {
      if (!alive) return;
      setCtx(res);
      if (res.ok) {
        setClickUrl(res.click_url ?? res.website ?? "");
        setPreview(res.image_url ?? null);
      }
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [token]);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (f) setPreview(URL.createObjectURL(f));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ctx?.ok) return;
    if (!file && !ctx.image_url) {
      setState("error");
      setMessage("Pick an image first.");
      return;
    }
    setState("saving");
    try {
      const imageUrl = file ? await uploadCreativeImage(token, file) : ctx.image_url!;
      await submitCreative({ token, imageUrl, headline: "", clickUrl });
      setState("done");
      setMessage("");
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <div className="min-h-dvh">
      <SiteNav />
      <main className="mx-auto w-full max-w-2xl px-6 py-16 md:py-20">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Upload your creative</h1>

        {loading ? (
          <div className="mt-8 h-40 animate-pulse rounded-xl bg-muted" />
        ) : !token || !ctx?.ok ? (
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            This upload link isn’t valid any more. If you won a week and can’t get in, reply to your
            winner email and we’ll sort it out.
          </p>
        ) : state === "done" ? (
          <div className="mt-6 space-y-4">
            <p className="text-lg leading-relaxed text-muted-foreground">
              Your creative is live. It runs on the billboard for your week — you can come back to
              this link any time to swap the image or headline.
            </p>
            {preview ? (
              <img
                src={preview}
                alt="Your billboard creative"
                className="w-full rounded-xl border border-border"
              />
            ) : null}
          </div>
        ) : (
          <>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              You won the week for {formatUsd(ctx.amount_cents ?? 0)}
              {ctx.advertiser ? ` as ${ctx.advertiser}` : ""}. Send us the artwork below.
            </p>

            <form onSubmit={onSubmit} className="mt-8 space-y-6">
              <div>
                <label htmlFor="creative" className="block text-sm font-medium">
                  Billboard image
                </label>
                <p className="mt-1 text-sm text-muted-foreground">
                  Wide artwork works best — roughly 1600×900, PNG or JPG, under 5 MB.
                </p>
                <input
                  id="creative"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={onPick}
                  className="mt-3 block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-foreground file:px-4 file:py-2 file:text-sm file:font-medium file:text-background"
                />
                {preview ? (
                  <img
                    src={preview}
                    alt="Creative preview"
                    className="mt-4 w-full rounded-xl border border-border"
                  />
                ) : null}
              </div>

              <div>
                <label htmlFor="clickUrl" className="block text-sm font-medium">
                  Click-through URL
                </label>
                <input
                  id="clickUrl"
                  value={clickUrl}
                  onChange={(e) => setClickUrl(e.target.value)}
                  className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-base"
                  placeholder="https://example.com"
                />
              </div>

              {state === "error" ? (
                <p className="text-sm text-destructive">{message}</p>
              ) : null}

              <button
                type="submit"
                disabled={state === "saving"}
                className="rounded-md bg-foreground px-6 py-3 text-base font-semibold text-background disabled:opacity-60"
              >
                {state === "saving" ? "Saving…" : "Publish creative"}
              </button>
            </form>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
