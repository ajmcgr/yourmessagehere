// Server-side safety net: makes sure a closed auction actually gets settled
// (winner charged + "upload your creative" email) even if the database cron
// job in the Rocket project never fires.
//
// The SQL rollover (ymh_rollover_auctions) can close an auction and open the
// next one, but it cannot talk to Stripe or Resend. Only the
// ymh-close-auction edge function can. This pings that function, at most once
// every few minutes, from our own server. The edge function is idempotent, so
// extra pings are harmless.

const FUNCTION_URL = "https://lcujmvdgczkjxdstzhnr.supabase.co/functions/v1/ymh-close-auction";
const TTL_MS = 5 * 60 * 1000;

let lastRunAt = 0;
let inFlight: Promise<void> | null = null;

export async function settleClosedAuctions(): Promise<void> {
  const secret = process.env["YMH_CRON_SECRET"];
  if (!secret) return; // not configured yet — stay silent, never break a page render

  if (Date.now() - lastRunAt < TTL_MS) return;
  if (inFlight) return inFlight;

  lastRunAt = Date.now();
  inFlight = (async () => {
    try {
      const res = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-ymh-cron-secret": secret,
        },
        body: "{}",
      });
      const body = await res.text();
      console.log(`[ymh-settle] ${res.status}: ${body.slice(0, 500)}`);
    } catch (err) {
      console.error("[ymh-settle] failed", err);
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}
