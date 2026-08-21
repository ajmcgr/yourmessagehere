// Copy to supabase/functions/ymh-start-bid/index.ts in the ROCKET project.
// Deploy: supabase functions deploy ymh-start-bid --no-verify-jwt
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY
//
// Step 1 of bidding: validate the amount and create a PENDING bid that is NOT
// public, then create a Stripe SetupIntent so the bidder can verify a payment
// method. No money moves here.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@17.0.0?target=deno";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const advertiser = String(body.advertiser ?? "").trim();
    const website = String(body.website ?? "").trim();
    const amount = Number(body.amount_cents);
    const termsAccepted = body.terms_accepted === true;

    if (!name || name.length > 120) return json({ error: "Please enter your name." }, 400);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Enter a valid email." }, 400);
    if (!advertiser || advertiser.length > 120) return json({ error: "Enter the advertiser." }, 400);
    if (!Number.isInteger(amount) || amount <= 0) return json({ error: "Enter a valid bid." }, 400);
    if (!termsAccepted) {
      return json({ error: "You must accept the payment authorization to bid." }, 400);
    }

    // Amount rules are enforced in the database. The row is pending_verification,
    // so it is invisible to the public leaderboard and cannot move the current bid.
    const { data: bid, error } = await admin.rpc("ymh_create_pending_bid", {
      p_name: name,
      p_email: email,
      p_advertiser: advertiser,
      p_website: website,
      p_amount_cents: amount,
    });
    if (error) return json({ error: error.message }, 400);

    // Reuse a Stripe customer per email so repeat bidders keep one payment profile.
    const existing = await stripe.customers.list({ email, limit: 1 });
    const customer =
      existing.data[0] ??
      (await stripe.customers.create({
        email,
        name,
        metadata: { product_source: "your_message_here", advertiser },
      }));

    const setupIntent = await stripe.setupIntents.create({
      customer: customer.id,
      usage: "off_session",
      automatic_payment_methods: { enabled: true },
      metadata: {
        product_source: "your_message_here",
        ymh_bid_id: bid.id,
        ymh_auction_id: bid.auction_id,
        advertiser,
        amount_cents: String(amount),
      },
    });

    await admin
      .from("ymh_bids")
      .update({ stripe_customer_id: customer.id, stripe_setup_intent_id: setupIntent.id })
      .eq("id", bid.id);

    return json({
      bid_id: bid.id,
      amount_cents: amount,
      client_secret: setupIntent.client_secret,
      setup_intent_id: setupIntent.id,
    });
  } catch (e) {
    console.error("[ymh-start-bid] Unhandled error", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
