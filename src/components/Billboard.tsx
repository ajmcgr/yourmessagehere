import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import type { Billboard as BillboardType } from "@/lib/ymh";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import placeholder from "@/assets/billboard-placeholder.png.asset.json";

export function Billboard({
  billboard,
  loading = false,
}: {
  billboard: BillboardType | null;
  loading?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [nativeFs, setNativeFs] = useState(false);
  const [overlayFs, setOverlayFs] = useState(false);
  const [darkIcon, setDarkIcon] = useState<boolean | null>(null);
  const isFs = nativeFs || overlayFs;

  useEffect(() => {
    const onChange = () =>
      setNativeFs(
        typeof document !== "undefined" &&
          document.fullscreenElement === containerRef.current,
      );
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    if (!overlayFs) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOverlayFs(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [overlayFs]);

  const toggleFs = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
      return;
    }
    if (overlayFs) {
      setOverlayFs(false);
      return;
    }
    if (typeof el.requestFullscreen === "function") {
      el.requestFullscreen().catch(() => setOverlayFs(true));
    } else {
      setOverlayFs(true);
    }
  }, [overlayFs]);

  const imgClass = "h-full w-full object-cover";

  /** Sample the bottom-left corner of the creative so the control stays legible. */
  const onImgLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    try {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (!w || !h) return;
      const canvas = document.createElement("canvas");
      canvas.width = 16;
      canvas.height = 16;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      const sw = Math.max(1, Math.round(w * 0.2));
      const sh = Math.max(1, Math.round(h * 0.2));
      ctx.drawImage(img, 0, h - sh, sw, sh, 0, 0, 16, 16);
      const { data } = ctx.getImageData(0, 0, 16, 16);
      let sum = 0;
      for (let i = 0; i < data.length; i += 4) {
        sum += 0.2126 * (data[i] ?? 0) + 0.7152 * (data[i + 1] ?? 0) + 0.0722 * (data[i + 2] ?? 0);
      }
      const avg = sum / (data.length / 4);
      setDarkIcon(avg > 140);
    } catch {
      /* cross-origin creative — keep the default tint */
    }
  }, []);

  const inner = loading ? (
    <Skeleton className="h-full w-full rounded-none" />
  ) : billboard?.image_url ? (
    <img
      src={billboard.image_url}
      alt={billboard.headline ?? `Advertisement by ${billboard.advertiser ?? "this week's winner"}`}
      className={imgClass}
      crossOrigin="anonymous"
      onLoad={onImgLoad}
    />
  ) : isFs ? (
    <img src={placeholder.url} alt="Your message here — buy the billboard" className={imgClass} />
  ) : (
    <Link to="/buy" className="block h-full w-full transition-opacity hover:opacity-60">
      <img
        src={placeholder.url}
        alt="Your message here — buy the billboard"
        className={imgClass}
      />
    </Link>
  );

  const hasAd = !loading && Boolean(billboard?.image_url);

  const frame = (
    <div
      className={cn(
        "aspect-[16/9] w-full overflow-hidden bg-background",
        hasAd ? "border-0" : "billboard-frame border",
        isFs && "aspect-auto h-full max-h-none w-full max-w-none border-0 bg-black",
      )}
    >
      {inner}
    </div>
  );


  const linked =
    billboard?.click_url && !loading && !isFs ? (
      <a href={billboard.click_url} target="_blank" rel="noopener noreferrer nofollow">
        {frame}
      </a>
    ) : (
      frame
    );

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full",
        isFs && "fixed inset-0 z-50 flex h-full w-full items-center justify-center bg-black",
      )}
    >
      {linked}
      <button
        type="button"
        onClick={toggleFs}
        aria-label={isFs ? "Exit billboard fullscreen" : "View billboard fullscreen"}
        title={isFs ? "Exit fullscreen" : "Fullscreen"}
        className={cn(
          "absolute bottom-3 left-3 z-10 grid size-8 place-items-center rounded-sm bg-transparent opacity-80 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          darkIcon === null
            ? "billboard-ink"
            : darkIcon
              ? "billboard-ink-dark"
              : "billboard-ink-light",
        )}
      >
        {isFs ? (
          <Minimize2 className="size-4" strokeWidth={1.5} />
        ) : (
          <Maximize2 className="size-4" strokeWidth={1.5} />
        )}
      </button>
    </div>
  );
}
