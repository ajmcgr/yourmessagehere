const SHARE_ID = "81qD5QRhMHc3UUN0";
const GATEWAY = "https://gateway-us.umami.is";
const START_AT = 1451606400000; // 2016-01-01, safely before tracking began
const TTL_MS = 5 * 60 * 1000;

let cache: { value: number; at: number } | null = null;

export async function fetchTotalVisitors(): Promise<number | null> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;

  try {
    const shareRes = await fetch(`${GATEWAY}/api/share/${SHARE_ID}`);
    if (!shareRes.ok) throw new Error(`share ${shareRes.status}`);
    const share = (await shareRes.json()) as { token?: string; websiteId?: string };
    if (!share.token || !share.websiteId) throw new Error("share payload missing token");

    const url = `${GATEWAY}/api/websites/${share.websiteId}/stats?startAt=${START_AT}&endAt=${Date.now()}`;
    const statsRes = await fetch(url, {
      headers: {
        "x-umami-share-token": share.token,
        "x-umami-share-context": "1",
        accept: "application/json",
      },
    });
    if (!statsRes.ok) throw new Error(`stats ${statsRes.status}`);
    const stats = (await statsRes.json()) as { visitors?: number };
    if (typeof stats.visitors !== "number") throw new Error("stats payload missing visitors");

    cache = { value: stats.visitors, at: Date.now() };
    return stats.visitors;
  } catch {
    return cache?.value ?? null;
  }
}
