// Copy to supabase/functions/ymh-send-winner-email/index.ts in the ROCKET project.
// Deploy: supabase functions deploy ymh-send-winner-email --no-verify-jwt
// Secrets needed: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, YMH_CRON_SECRET
//
// Does exactly one thing: email the winner their "upload your creative" link.
// No Stripe, no auction closing, no charging — so nothing else can break it.
//
// Call it:
//   curl -X POST -H "x-ymh-cron-secret: $YMH_CRON_SECRET" \
//     -H "Content-Type: application/json" -d '{}' \
//     https://<project>.supabase.co/functions/v1/ymh-send-winner-email
// Optionally target one bid: -d '{"bid_id":"<uuid>"}'
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE = "https://yourmessagehere.co";
const LOGO = `${SITE}/__l5e/assets-v1/95a7cebf-ad72-4869-836e-e9359f2439f1/email-logo.png`;
const FROM = "Your Message Here <hello@yourmessagehere.co>";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const usd = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

function weekEndingLabel(weekEnd: string) {
  return new Date(weekEnd).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  });
}

function html(bid: Record<string, unknown>, weekEnd: string) {
  return `<!doctype html>
<html><body style="margin:0;padding:40px 16px;background:#f7f9fb;font-family:Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #eaecef;border-radius:8px;">
    <tr><td align="center" style="padding:40px 40px 36px 40px;border-bottom:1px solid #eaecef;">
      <a href="${SITE}"><img src="${LOGO}" alt="Your Message Here" width="240" style="display:block;border:0;width:240px;max-width:70%;height:auto;" /></a>
    </td></tr>
    <tr><td style="padding:40px 40px 8px 40px;">
      <h1 style="margin:0 0 20px 0;font-size:30px;line-height:1.2;color:#111111;font-weight:700;">The billboard is yours 🎉</h1>
      <div style="font-size:17px;line-height:1.6;color:#4b5563;">
        <p style="margin:0 0 16px 0;">We charged your verified payment method ${usd(Number(bid["amount_cents"]))}. You own the one billboard on the internet for the week — ${weekEndingLabel(weekEnd)}.</p>
        <p style="margin:0;">Upload your creative — 1600×900, JPG or PNG.</p>
      </div>
    </td></tr>
    <tr><td style="padding:8px 40px 40px 40px;">
      <a href="${SITE}/upload?token=${bid["payment_token"]}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;padding:16px 28px;border-radius:8px;">Upload your creative</a>
    </td></tr>
    <tr><td align="center" style="padding:24px 40px;border-top:1px solid #eaecef;font-size:15px;color:#9ca3af;">
      One billboard on the internet. Auction closes Fridays at 10:00 PM New York time.
    </td></tr>
  </table>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.headers.get("x-ymh-cron-secret") !== Deno.env.get("YMH_CRON_SECRET")) {
    return new Response("Unauthorized", { status: 401 });
  }

  let bidId: string | null = null;
  let force = false;
  try {
    const body = await req.json();
    bidId = body?.bid_id ?? null;
    force = body?.force === true;
  } catch {
    bidId = null;
  }


  // Default target: the winning bid of the most recently closed auction.
  if (!bidId) {
    const { data: auction } = await admin
      .from("ymh_auctions")
      .select("winning_bid_id")
      .in("status", ["paid", "awaiting_payment"])
      .not("winning_bid_id", "is", null)
      .order("ends_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    bidId = (auction?.["winning_bid_id"] as string) ?? null;
  }
  if (!bidId) return Response.json({ ok: false, error: "No winning bid found" }, { status: 404 });

  const { data: bid } = await admin
    .from("ymh_bids")
    .select("id, auction_id, bidder_email, amount_cents, payment_token, advertiser, website")
    .eq("id", bidId)
    .maybeSingle();
  if (!bid) return Response.json({ ok: false, error: "Bid not found" }, { status: 404 });

  const { data: auction } = await admin
    .from("ymh_auctions")
    .select("week_start, week_end")
    .eq("id", bid["auction_id"])
    .maybeSingle();
  if (!auction) return Response.json({ ok: false, error: "Auction not found" }, { status: 404 });

  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return Response.json({ ok: false, error: "RESEND_API_KEY is not configured" }, { status: 500 });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM,
      to: bid["bidder_email"],
      subject: "Your Message Here — Payment received, upload your creative",
      html: html(bid as Record<string, unknown>, auction["week_end"] as string),
    }),
  });

  const body = await res.text();
  console.log(`[ymh-send-winner-email] resend ${res.status}: ${body}`);

  if (!res.ok) {
    return Response.json({ ok: false, resend_status: res.status, resend_body: body }, { status: 502 });
  }

  const providerId = (() => {
    try {
      return JSON.parse(body)?.id ?? null;
    } catch {
      return null;
    }
  })();

  // Make sure the winner can actually use the link.
  await admin
    .from("ymh_bids")
    .update({ status: "winner_paid", payment_status: "paid", payment_failure_reason: null })
    .eq("id", bid["id"]);
  await admin.from("ymh_auctions").update({ status: "paid" }).eq("id", bid["auction_id"]);

  const { data: existingBillboard } = await admin
    .from("ymh_billboards")
    .select("id")
    .eq("auction_id", bid["auction_id"])
    .maybeSingle();
  if (!existingBillboard) {
    await admin.from("ymh_billboards").insert({
      auction_id: bid["auction_id"],
      advertiser: bid["advertiser"],
      click_url: bid["website"],
      week_start: auction["week_start"],
      week_end: auction["week_end"],
      status: "pending",
    });
  }

  await admin.from("ymh_email_events").insert({
    auction_id: bid["auction_id"],
    bid_id: bid["id"],
    recipient: bid["bidder_email"],
    template: "payment_received",
    provider_id: providerId,
    status: "sent",
  });

  return Response.json({
    ok: true,
    sent_to: bid["bidder_email"],
    provider_id: providerId,
    upload_url: `${SITE}/upload?token=${bid["payment_token"]}`,
  });
});
