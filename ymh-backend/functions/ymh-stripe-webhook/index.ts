// Copy to supabase/functions/ymh-stripe-webhook/index.ts in the ROCKET project.
// Deploy: supabase functions deploy ymh-stripe-webhook --no-verify-jwt
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY,
//          STRIPE_WEBHOOK_SECRET, RESEND_API_KEY
// Stripe endpoint: https://<rocket-ref>.supabase.co/functions/v1/ymh-stripe-webhook
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@17.0.0?target=deno";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });

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
          `<p>The billboard is yours for the week.</p><p><a href="https://yourmessagehere.co/upload?token=${bid.payment_token}">Upload your creative</a> (1600×900, JPG or PNG).</p>`,
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
