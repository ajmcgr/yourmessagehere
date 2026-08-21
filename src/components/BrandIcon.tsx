import { useEffect, useState } from "react";

/**
 * Brand favicon with fallbacks.
 *
 * Google's s2 favicon service serves a cached crawl, which can be months out of
 * date (it will happily keep serving a site's old default icon). So we try the
 * site's own favicon first and only fall back to Google, then to a blank tile.
 */
export function BrandIcon({ host, className = "" }: { host: string | null; className?: string }) {
  const candidates = host
    ? [
        `https://${host}/favicon.png`,
        `https://${host}/favicon.ico`,
        `https://www.google.com/s2/favicons?sz=128&domain=${host}`,
      ]
    : [];

  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(0);
  }, [host]);

  if (!host || idx >= candidates.length) {
    return <span className={`shrink-0 rounded bg-foreground/10 ${className}`} />;
  }

  return (
    <img
      key={candidates[idx]}
      src={candidates[idx]}
      alt=""
      loading="lazy"
      onError={() => setIdx((i) => i + 1)}
      className={`shrink-0 rounded object-contain ${className}`}
    />
  );
}
