// Copy to supabase/functions/ymh-close-auction/index.ts in the ROCKET project.
// Deploy: supabase functions deploy ymh-close-auction --no-verify-jwt
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, YMH_CRON_SECRET
// Schedule hourly with pg_cron (see ../README.md); the Friday 22:00 ET close and
// the 24-hour payment expiry are both handled by the same run.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
const SUPA_URL = Deno.env.get("SUPABASE_URL")!;

async function sendEmail(to: string, subject: string, html: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "Your Message Here <hello@yourmessagehere.co>", to, subject, html }),
  });
}

Deno.serve(async (req) => {
  if (req.headers.get("x-ymh-cron-secret") !== Deno.env.get("YMH_CRON_SECRET")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: closed, error } = await admin.rpc("ymh_close_due_auctions");
  if (error) return new Response(error.message, { status: 500 });

  for (const auction of (closed ?? []) as Array<Record<string, string>>) {
    if (!auction["winning_bid_id"]) continue;
    const { data: bid } = await admin
      .from("ymh_bids")
      .select("bidder_name, bidder_email, amount_cents, payment_token")
      .eq("id", auction["winning_bid_id"])
      .maybeSingle();
    if (!bid) continue;

    await sendEmail(
      bid.bidder_email,
      "You won the billboard — pay within 24 hours",
      `<p>Hi ${bid.bidder_name},</p><p>You won with $${(bid.amount_cents / 100).toFixed(0)}. Complete payment within 24 hours:</p><p><a href="${SUPA_URL}/functions/v1/ymh-create-checkout?token=${bid.payment_token}">Pay now</a></p>`,
    );
    await admin.from("ymh_email_events").insert({
      auction_id: auction["id"],
      bid_id: auction["winning_bid_id"],
      recipient: bid.bidder_email,
      template: "winner_payment_link",
    });
  }

  const { data: lapsed } = await admin
    .from("ymh_auctions")
    .update({ status: "expired" })
    .eq("status", "awaiting_payment")
    .lt("payment_due_at", new Date().toISOString())
    .select("id");

  return new Response(
    JSON.stringify({ closed: (closed ?? []).length, expired: (lapsed ?? []).length }),
    { headers: { "Content-Type": "application/json" } },
  );
});
