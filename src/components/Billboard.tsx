import { Link } from "@tanstack/react-router";
import type { Billboard as BillboardType } from "@/lib/ymh";
import { Skeleton } from "@/components/ui/skeleton";
import placeholder from "@/assets/billboard-placeholder.png.asset.json";

export function Billboard({
  billboard,
  loading = false,
}: {
  billboard: BillboardType | null;
  loading?: boolean;
}) {
  const inner = loading ? (
    <Skeleton className="h-full w-full rounded-none" />
  ) : billboard?.image_url ? (
    <img
      src={billboard.image_url}
      alt={billboard.headline ?? `Advertisement by ${billboard.advertiser ?? "this week's winner"}`}
      className="h-full w-full object-cover"
    />
  ) : (
    <Link to="/buy" className="block h-full w-full transition-opacity hover:opacity-60">
      <img
        src={placeholder.url}
        alt="Your message here — buy this billboard"
        className="h-full w-full object-cover"
      />
    </Link>
  );



  const frame = (
    <div className="w-full">
      <div className="aspect-[16/9] w-full overflow-hidden border border-foreground bg-background">
        {inner}
      </div>
    </div>
  );

  if (billboard?.click_url && !loading) {
    return (
      <a href={billboard.click_url} target="_blank" rel="noopener noreferrer nofollow">
        {frame}
      </a>
    );
  }
  return frame;
}
