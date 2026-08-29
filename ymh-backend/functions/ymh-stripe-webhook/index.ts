// Copy to supabase/functions/ymh-stripe-webhook/index.ts in the ROCKET project.
// Deploy: supabase functions deploy ymh-stripe-webhook --no-verify-jwt
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY,
//          STRIPE_WEBHOOK_SECRET, RESEND_API_KEY
// Stripe endpoint: https://<rocket-ref>.supabase.co/functions/v1/ymh-stripe-webhook
// Events: payment_intent.succeeded, payment_intent.payment_failed
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "npm:stripe@17.0.0";
import { sendEmail, emailLayout, weekEndingLabel } from "../_shared/email.ts";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20", httpClient: Stripe.createFetchHttpClient() });

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

  if (event.type === "payment_intent.succeeded" || event.type === "payment_intent.payment_failed") {
    const intent = event.data.object as Stripe.PaymentIntent;
    if (intent.metadata?.["product_source"] !== "your_message_here") return new Response("ok");

    const auctionId = intent.metadata?.["auction_id"];
    const bidId = intent.metadata?.["bid_id"];
    if (!auctionId || !bidId) return new Response("ok");

    const { data: bid } = await admin
      .from("ymh_bids")
      .select("id, status, advertiser, website, bidder_name, bidder_email, amount_cents, payment_token")
      .eq("id", bidId)
      .maybeSingle();
    if (!bid) return new Response("ok");

    if (event.type === "payment_intent.payment_failed") {
      await admin
        .from("ymh_bids")
        .update({
          status: "payment_failed",
          payment_status: "failed",
          payment_failure_reason:
            intent.last_payment_error?.message?.slice(0, 400) ?? "Payment failed",
          stripe_payment_intent_id: intent.id,
        })
        .eq("id", bidId)
        .neq("status", "winner_paid");
      return new Response("ok");
    }

    await admin
      .from("ymh_bids")
      .update({
        status: "winner_paid",
        payment_status: "paid",
        payment_failure_reason: null,
        stripe_payment_intent_id: intent.id,
      })
      .eq("id", bidId);

    const { data: auction } = await admin
      .from("ymh_auctions")
      .update({ status: "paid" })
      .eq("id", auctionId)
      .select("week_start, week_end")
      .maybeSingle();

    if (auction) {
      const { data: boards } = await admin
        .from("ymh_billboards")
        .select("id, image_url")
        .eq("auction_id", auctionId)
        .limit(1);
      const existingBillboard = boards?.[0] ?? null;
      if (!existingBillboard) {
        await admin.from("ymh_billboards").insert({
          auction_id: auctionId,
          advertiser: bid.advertiser,
          click_url: bid.website,
          week_start: auction.week_start,
          week_end: auction.week_end,
          status: "pending",
        });
      }

      // limit(1), never maybeSingle(): several matching rows made maybeSingle()
      // error out and read as "never sent", which duplicated the email.
      const { data: sentRows } = await admin
        .from("ymh_email_events")
        .select("id")
        .eq("bid_id", bidId)
        .eq("template", "payment_received")
        .eq("status", "sent")
        .limit(1);
      const sent = (sentRows?.length ?? 0) > 0 || Boolean(existingBillboard?.["image_url"]);

      if (!sent) {

        try {
          const providerId = await sendEmail(
            bid.bidder_email,
            "Payment received — upload your creative",
            emailLayout({
              heading: "The billboard is yours 🎉",
              body: `<p style="margin:0 0 16px 0;">We charged your verified payment method $${(bid.amount_cents / 100).toFixed(0)}. You own the one billboard on the internet for the week — ${weekEndingLabel(auction.week_end)}.</p><p style="margin:0;">Upload your creative — 1600×900, JPG or PNG.</p>`,
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
            provider_id: providerId,
            status: "sent",
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown email delivery error";
          console.error(`[ymh-stripe-webhook] Winner email failed for bid ${bidId}: ${message}`);
          await admin.from("ymh_email_events").insert({
            auction_id: auctionId,
            bid_id: bidId,
            recipient: bid.bidder_email,
            template: "payment_received",
            status: "failed",
            error: message.slice(0, 1000),
          });
        }
      }
    }
  }

  return new Response("ok");
});
