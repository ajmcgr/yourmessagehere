// Copy to supabase/functions/ymh-create-checkout/index.ts in the ROCKET project.
// Deploy: supabase functions deploy ymh-create-checkout --no-verify-jwt
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY, SITE_URL
// Winner email links here: /functions/v1/ymh-create-checkout?token=<payment_token>
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@17.0.0?target=deno";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
const SITE = Deno.env.get("SITE_URL") ?? "https://yourmessagehere.co";

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return new Response("Missing token", { status: 400 });

  const { data: bid } = await admin
    .from("ymh_bids")
    .select("id, auction_id, amount_cents, bidder_email")
    .eq("payment_token", token)
    .maybeSingle();
  if (!bid) return new Response("Invalid link", { status: 404 });

  const { data: auction } = await admin
    .from("ymh_auctions")
    .select("id, status, winning_bid_id, payment_due_at")
    .eq("id", bid.auction_id)
    .maybeSingle();

  if (!auction || auction.winning_bid_id !== bid.id) {
    return new Response("This bid did not win.", { status: 403 });
  }
  if (auction.status !== "awaiting_payment") {
    return new Response("This auction is not awaiting payment.", { status: 409 });
  }
  if (auction.payment_due_at && new Date(auction.payment_due_at) < new Date()) {
    return new Response("The 24-hour payment window has expired.", { status: 410 });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: bid.bidder_email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: bid.amount_cents,
          product_data: { name: "Your Message Here — one week on the billboard" },
        },
      },
    ],
    metadata: { ymh_auction_id: auction.id, ymh_bid_id: bid.id },
    success_url: `${SITE}/?paid=1`,
    cancel_url: `${SITE}/buy`,
  });

  await admin
    .from("ymh_auctions")
    .update({ stripe_checkout_session_id: session.id })
    .eq("id", auction.id);

  return Response.redirect(session.url!, 303);
});
