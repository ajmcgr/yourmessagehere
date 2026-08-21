// Copy to supabase/functions/ymh-close-auction/index.ts in the ROCKET project.
// Deploy: supabase functions deploy ymh-close-auction --no-verify-jwt
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, YMH_CRON_SECRET
// Schedule hourly with pg_cron (see ../README.md); the Friday 22:00 ET close and
// the 24-hour payment expiry are both handled by the same run.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---- inlined from _shared/email.ts (single-file deploy) ----
const SITE = "https://yourmessagehere.co";
const LOGO = `${SITE}/__l5e/assets-v1/95a7cebf-ad72-4869-836e-e9359f2439f1/email-logo.png`;
const FROM = "Your Message Here <hello@yourmessagehere.co>";

function emailLayout(opts: {
  heading: string;
  body: string; // raw HTML paragraphs
  cta?: { label: string; url: string };
  footer?: string;
}) {
  const button = opts.cta
    ? `<tr><td style="padding:8px 40px 40px 40px;">
         <a href="${opts.cta.url}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;padding:16px 28px;border-radius:8px;font-family:Helvetica,Arial,sans-serif;">${opts.cta.label}</a>
       </td></tr>`
    : "";

  return `<!doctype html>
<html><body style="margin:0;padding:40px 16px;background:#f7f9fb;font-family:Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #eaecef;border-radius:8px;">
    <tr>
      <td align="center" style="padding:40px 40px 36px 40px;border-bottom:1px solid #eaecef;">
        <a href="${SITE}"><img src="${LOGO}" alt="Your Message Here" width="240" style="display:block;border:0;width:240px;max-width:70%;height:auto;" /></a>
      </td>
    </tr>
    <tr>
      <td style="padding:40px 40px 8px 40px;">
        <h1 style="margin:0 0 20px 0;font-size:30px;line-height:1.2;color:#111111;font-weight:700;">${opts.heading}</h1>
        <div style="font-size:17px;line-height:1.6;color:#4b5563;">${opts.body}</div>
      </td>
    </tr>
    ${button}
    <tr>
      <td align="center" style="padding:24px 40px;border-top:1px solid #eaecef;font-size:15px;color:#9ca3af;">
        ${opts.footer ?? "One billboard on the internet. Auction closes Fridays at 10:00 PM New York time."}
      </td>
    </tr>
  </table>
</body></html>`;
}

async function sendEmail(to: string, subject: string, html: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
}
// ---- end shared ----

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
const SUPA_URL = Deno.env.get("SUPABASE_URL")!;


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
      emailLayout({
        heading: "You won the billboard 🏆",
        body: `<p style="margin:0 0 16px 0;">Hi ${bid.bidder_name}, you won this week's auction with <strong style="color:#111111;">$${(bid.amount_cents / 100).toFixed(0)}</strong>.</p><p style="margin:0;">Complete payment within 24 hours or the billboard goes to the next bidder.</p>`,
        cta: {
          label: "Pay now",
          url: `${SUPA_URL}/functions/v1/ymh-create-checkout?token=${bid.payment_token}`,
        },
      }),
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
