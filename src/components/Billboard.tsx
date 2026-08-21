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

  const imgClass = cn("h-full w-full", isFs ? "object-contain" : "object-cover");

  const inner = loading ? (
    <Skeleton className="h-full w-full rounded-none" />
  ) : billboard?.image_url ? (
    <img
      src={billboard.image_url}
      alt={billboard.headline ?? `Advertisement by ${billboard.advertiser ?? "this week's winner"}`}
      className={imgClass}
    />
  ) : isFs ? (
    <img src={placeholder.url} alt="Your message here — buy this billboard" className={imgClass} />
  ) : (
    <Link to="/buy" className="block h-full w-full transition-opacity hover:opacity-60">
      <img
        src={placeholder.url}
        alt="Your message here — buy this billboard"
        className={imgClass}
      />
    </Link>
  );

  const frame = (
    <div
      className={cn(
        "aspect-[16/9] w-full overflow-hidden border border-foreground bg-background",
        isFs && "max-h-full max-w-[calc(100vh*16/9)] border-0",
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
        isFs && "fixed inset-0 z-50 flex h-full w-full items-center justify-center bg-background",
      )}
    >
      {linked}
      <button
        type="button"
        onClick={toggleFs}
        aria-label={isFs ? "Exit billboard fullscreen" : "View billboard fullscreen"}
        title={isFs ? "Exit fullscreen" : "Fullscreen"}
        className="absolute bottom-3 left-3 z-10 grid size-8 place-items-center rounded-sm bg-transparent billboard-ink opacity-60 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
