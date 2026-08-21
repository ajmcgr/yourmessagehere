import { useEffect, useState } from "react";

const cache = new Map<string, string>();

/** Best-effort site descriptions for advertiser websites (client-side, cached). */
export function useSiteDescriptions(urls: (string | null | undefined)[]) {
  const [map, setMap] = useState<Record<string, string>>(() => Object.fromEntries(cache));

  const key = urls.filter(Boolean).join("|");

  useEffect(() => {
    let cancelled = false;
    const list = Array.from(new Set(urls.filter((u): u is string => Boolean(u))));

    (async () => {
      for (const url of list) {
        if (cache.has(url)) continue;
        try {
          const res = await fetch(
            `https://api.microlink.io/?url=${encodeURIComponent(url)}&meta=true`,
          );
          if (!res.ok) continue;
          const json = (await res.json()) as { data?: { description?: string | null } };
          const desc = json.data?.description?.trim();
          if (desc) {
            cache.set(url, desc);
            if (!cancelled) setMap((m) => ({ ...m, [url]: desc }));
          }
        } catch {
          /* ignore — descriptions are decorative */
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return map;
}
