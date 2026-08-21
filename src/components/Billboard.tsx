import { Link } from "@tanstack/react-router";
import type { Billboard as BillboardType } from "@/lib/ymh";

export function Billboard({ billboard }: { billboard: BillboardType | null }) {
  const inner = billboard?.image_url ? (
    <img
      src={billboard.image_url}
      alt={billboard.headline ?? `Advertisement by ${billboard.advertiser ?? "this week's winner"}`}
      className="h-full w-full object-cover"
    />
  ) : (
    <div className="flex h-full w-full items-center justify-center bg-background">
      <p className="px-6 text-center text-2xl font-medium tracking-tight text-muted-foreground md:text-5xl">
        Your message here
      </p>
    </div>
  );

  const frame = (
    <div className="w-full">
      <div className="aspect-[16/9] w-full overflow-hidden border border-foreground bg-background">
        {inner}
      </div>
    </div>
  );

  if (billboard?.click_url) {
    return (
      <a href={billboard.click_url} target="_blank" rel="noopener noreferrer nofollow">
        {frame}
      </a>
    );
  }
  return frame;
}
