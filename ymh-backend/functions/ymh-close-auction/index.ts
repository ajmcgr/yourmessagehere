// Copy to supabase/functions/ymh-close-auction/index.ts in the ROCKET project.
// Deploy: supabase functions deploy ymh-close-auction --no-verify-jwt
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY,
//          RESEND_API_KEY, YMH_CRON_SECRET
// Schedule hourly with pg_cron (see ../README.md).
//
// New model: the winner already verified a payment method while bidding, so we
// charge it off-session here. No Checkout link, no manual re-entry of a card.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "npm:stripe@17.0.0";
import { sendEmail, emailLayout, weekEndingLabel } from "../_shared/email.ts";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20", httpClient: Stripe.createFetchHttpClient() });

const usd = (c: number) => `$${(c / 100).toFixed(0)}`;

type WinnerBid = {
  id: string;
  auction_id: string;
  bidder_name: string;
  bidder_email: string;
  amount_cents: number;
  stripe_customer_id: string | null;
  stripe_payment_method_id: string | null;
  advertiser: string;
};

/** Idempotently mark a winner paid, create the billboard row, and email the
 *  "upload your creative" link. Safe to run repeatedly; the Stripe webhook does
 *  the same work and neither path duplicates the email. */
async function fulfilWinner(auctionId: string, bidId: string): Promise<"sent" | "already_sent" | "failed" | "skipped"> {
  const { data: bid } = await admin
    .from("ymh_bids")
    .select(
      "id, status, advertiser, website, bidder_name, bidder_email, amount_cents, payment_token",
    )
    .eq("id", bidId)
    .maybeSingle();
  if (!bid) return "skipped";

  await admin
    .from("ymh_bids")
    .update({ status: "winner_paid", payment_status: "paid", payment_failure_reason: null })
    .eq("id", bidId);

  await admin.from("ymh_auctions").update({ status: "paid" }).eq("id", auctionId);
  const { data: auction } = await admin
    .from("ymh_auctions")
    .select("week_start, week_end")
    .eq("id", auctionId)
    .maybeSingle();
  if (!auction) return "skipped";

  const { data: existingBillboard } = await admin
    .from("ymh_billboards")
    .select("id")
    .eq("auction_id", auctionId)
    .maybeSingle();
  if (!existingBillboard) {
    await admin.from("ymh_billboards").insert({
      auction_id: auctionId,
      advertiser: bid["advertiser"],
      click_url: bid["website"],
      week_start: auction["week_start"],
      week_end: auction["week_end"],
      status: "pending",
    });
  }

  const { data: sent } = await admin
    .from("ymh_email_events")
    .select("id")
    .eq("bid_id", bidId)
    .eq("template", "payment_received")
    .eq("status", "sent")
    .not("provider_id", "is", null)
    .neq("provider_id", "unknown")
    .neq("provider_id", "")
    .maybeSingle();
  if (sent) return "already_sent";

  try {
    const providerId = await sendEmail(
      bid["bidder_email"],
      "Payment received — upload your creative",
      emailLayout({
        heading: "The billboard is yours 🎉",
        body: `<p style="margin:0 0 16px 0;">We charged your verified payment method ${usd(bid["amount_cents"])}. You own the one billboard on the internet for the week — ${weekEndingLabel(auction["week_end"])}.</p><p style="margin:0;">Upload your creative — 1600×900, JPG or PNG.</p>`,
        cta: {
          label: "Upload your creative",
          url: `https://yourmessagehere.co/upload?token=${bid["payment_token"]}`,
        },
      }),
    );

    await admin.from("ymh_email_events").insert({
      auction_id: auctionId,
      bid_id: bidId,
      recipient: bid["bidder_email"],
      template: "payment_received",
      provider_id: providerId,
      status: "sent",
    });
    return "sent";
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown email delivery error";
    console.error(`[ymh-close-auction] Winner email failed for bid ${bidId}: ${message}`);
    await admin.from("ymh_email_events").insert({
      auction_id: auctionId,
      bid_id: bidId,
      recipient: bid["bidder_email"],
      template: "payment_received",
      status: "failed",
      error: message.slice(0, 1000),
    });
    return "failed";
  }
}

/** Charge one provisional winner. Returns true when the charge succeeded. */
async function chargeWinner(auction: Record<string, string>, bidId: string) {
  // The amount is always read from the database, never from any client input.
  const { data } = await admin
    .from("ymh_bids")
    .select(
      "id, auction_id, bidder_name, bidder_email, amount_cents, stripe_customer_id, stripe_payment_method_id, advertiser",
    )
    .eq("id", bidId)
    .maybeSingle();
  const bid = data as WinnerBid | null;
  if (!bid) return false;

  if (!bid.stripe_customer_id || !bid.stripe_payment_method_id) {
    await admin
      .from("ymh_bids")
      .update({
        status: "payment_failed",
        payment_status: "failed",
        payment_failure_reason: "No verified payment method on file",
      })
      .eq("id", bid.id);
    return false;
  }

  try {
    const intent = await stripe.paymentIntents.create({
      amount: bid.amount_cents,
      currency: "usd",
      customer: bid.stripe_customer_id,
      payment_method: bid.stripe_payment_method_id,
      off_session: true,
      confirm: true,
      description: "Your Message Here — one week on the billboard",
      metadata: {
        product_source: "your_message_here",
        auction_id: bid.auction_id,
        bid_id: bid.id,
        advertiser: bid.advertiser,
      },
    });

    await admin
      .from("ymh_bids")
      .update({ stripe_payment_intent_id: intent.id })
      .eq("id", bid.id);

    if (intent.status === "succeeded") {
      // The webhook does the same work; both paths are idempotent.
      await fulfilWinner(bid.auction_id, bid.id);
      return true;
    }

    await admin
      .from("ymh_bids")
      .update({
        status: "payment_failed",
        payment_status: intent.status,
        payment_failure_reason: "Additional authentication required",
      })
      .eq("id", bid.id);

    await sendEmail(
      bid.bidder_email,
      "Action needed — confirm your billboard payment",
      emailLayout({
        heading: "One more step",
        body: `<p style="margin:0 0 16px 0;">Hi ${bid.bidder_name}, you won the billboard for ${weekEndingLabel(auction["week_end"])} with <strong style="color:#111111;">${usd(bid.amount_cents)}</strong>.</p><p style="margin:0;">Your bank needs you to confirm the payment. Please confirm it soon — if we can't collect payment in time, the billboard goes to the next verified bidder.</p>`,
        cta: { label: "Confirm payment", url: "https://yourmessagehere.co/buy" },
      }),
    );
    return false;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Card declined";
    await admin
      .from("ymh_bids")
      .update({
        status: "payment_failed",
        payment_status: "failed",
        payment_failure_reason: message.slice(0, 400),
      })
      .eq("id", bid.id);

    await sendEmail(
      bid.bidder_email,
      "We couldn't charge your card",
      emailLayout({
        heading: "Your payment didn't go through",
        body: `<p style="margin:0 0 16px 0;">Hi ${bid.bidder_name}, you won the billboard for ${weekEndingLabel(auction["week_end"])} with <strong style="color:#111111;">${usd(bid.amount_cents)}</strong>, but your bank declined the charge.</p><p style="margin:0;">Reply to this email and we'll help. If payment can't be completed in time, the billboard passes to the next verified bidder.</p>`,
      }),
    );
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.headers.get("x-ymh-cron-secret") !== Deno.env.get("YMH_CRON_SECRET")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: closed, error } = await admin.rpc("ymh_close_due_auctions");
  if (error) return new Response(error.message, { status: 500 });

  let charged = 0;
  let emailsSent = 0;
  let emailFailures = 0;
  for (const auction of (closed ?? []) as Array<Record<string, string>>) {
    if (!auction["winning_bid_id"]) continue;
    if (await chargeWinner(auction, auction["winning_bid_id"]!)) charged++;
  }

  // Auctions closed by the website's own rollover (a visitor arriving after the
  // deadline) still need their winner charged exactly once.
  const { data: unpaid } = await admin
    .from("ymh_auctions")
    .select("id, week_end, winning_bid_id")
    .eq("status", "awaiting_payment")
    .not("winning_bid_id", "is", null);

  for (const auction of (unpaid ?? []) as Array<Record<string, string>>) {
    const { data: bid } = await admin
      .from("ymh_bids")
      .select("id, stripe_payment_intent_id, status")
      .eq("id", auction["winning_bid_id"]!)
      .maybeSingle();
    if (!bid || bid["stripe_payment_intent_id"]) continue;
    if (bid["status"] !== "provisional_winner") continue;
    if (await chargeWinner(auction, auction["winning_bid_id"]!)) charged++;
  }

  // Winners who never completed a required authentication: pass the billboard on.
  const { data: lapsed } = await admin
    .from("ymh_auctions")
    .select("id, week_end, winning_bid_id")
    .eq("status", "awaiting_payment")
    .lt("payment_due_at", new Date().toISOString());

  let promoted = 0;
  for (const auction of (lapsed ?? []) as Array<Record<string, string>>) {
    if (auction["winning_bid_id"]) {
      await admin
        .from("ymh_bids")
        .update({ status: "payment_expired", payment_status: "expired" })
        .eq("id", auction["winning_bid_id"]!)
        .neq("status", "winner_paid");
    }
    const { data: next } = await admin.rpc("ymh_promote_next_bidder", {
      p_auction_id: auction["id"],
    });
    if (next?.id) {
      promoted++;
      await chargeWinner(auction, next.id);
    }
  }

  // Winners charged earlier but never emailed (e.g. the webhook missed the
  // event): send the "upload your creative" email exactly once.
  const { data: paidAuctions } = await admin
    .from("ymh_auctions")
    .select("id, winning_bid_id")
    .in("status", ["paid", "awaiting_payment"])
    .not("winning_bid_id", "is", null);

  for (const auction of (paidAuctions ?? []) as Array<Record<string, string>>) {
    const { data: bid } = await admin
      .from("ymh_bids")
      .select("id, status, stripe_payment_intent_id")
      .eq("id", auction["winning_bid_id"]!)
      .maybeSingle();
    if (!bid || !bid["stripe_payment_intent_id"]) continue;
    const intent = await stripe.paymentIntents.retrieve(bid["stripe_payment_intent_id"]!);
    if (intent.status !== "succeeded") continue;
    const emailResult = await fulfilWinner(auction["id"]!, bid["id"]!);
    if (emailResult === "sent") emailsSent++;
    if (emailResult === "failed") emailFailures++;
  }

  const summary = {
    closed: (closed ?? []).length,
    charged,
    promoted,
    winner_emails_sent: emailsSent,
    winner_email_failures: emailFailures,
  };
  console.log(`[ymh-close-auction] ${JSON.stringify(summary)}`);

  return new Response(
    JSON.stringify(summary),
    { headers: { "Content-Type": "application/json" } },
  );
});
