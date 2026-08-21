// Copy to supabase/functions/ymh-stripe-webhook/index.ts in the ROCKET project.
// Deploy: supabase functions deploy ymh-stripe-webhook --no-verify-jwt
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY,
//          STRIPE_WEBHOOK_SECRET, RESEND_API_KEY
// Stripe endpoint: https://<rocket-ref>.supabase.co/functions/v1/ymh-stripe-webhook
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@17.0.0?target=deno";

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
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });


Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();
  if (!signature) return new Response("Missing signature", { status: 401 });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!,
    );
  } catch {
    return new Response("Invalid signature", { status: 401 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const auctionId = session.metadata?.["ymh_auction_id"];
    const bidId = session.metadata?.["ymh_bid_id"];

    if (auctionId && bidId) {
      const { data: auction } = await admin
        .from("ymh_auctions")
        .update({ status: "paid" })
        .eq("id", auctionId)
        .select("week_start, week_end")
        .maybeSingle();

      const { data: bid } = await admin
        .from("ymh_bids")
        .select("advertiser, website, bidder_email, payment_token")
        .eq("id", bidId)
        .maybeSingle();

      if (auction && bid) {
        await admin.from("ymh_billboards").insert({
          auction_id: auctionId,
          advertiser: bid.advertiser,
          click_url: bid.website,
          week_start: auction.week_start,
          week_end: auction.week_end,
          status: "pending",
        });

        await sendEmail(
          bid.bidder_email,
          "Payment received — upload your creative",
          emailLayout({
            heading: "The billboard is yours 🎉",
            body: `<p style="margin:0 0 16px 0;">Payment received. You own the one billboard on the internet for the week.</p><p style="margin:0;">Upload your creative — 1600×900, JPG or PNG.</p>`,
            cta: {
              label: "Upload your creative",
              url: `https://yourmessagehere.co/upload?token=${bid.payment_token}`,
            },
          }),
        );

        await admin.from("ymh_email_events").insert({
          auction_id: auctionId,
          bid_id: bidId,
          recipient: bid.bidder_email,
          template: "payment_received",
        });
      }
    }
  }

  return new Response("ok");
});
