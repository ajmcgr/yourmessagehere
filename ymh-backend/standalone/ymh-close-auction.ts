// Copy to supabase/functions/ymh-close-auction/index.ts in the ROCKET project.
// Deploy: supabase functions deploy ymh-close-auction --no-verify-jwt
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY,
//          RESEND_API_KEY, YMH_CRON_SECRET
// Schedule hourly with pg_cron (see ../README.md).
//
// New model: the winner already verified a payment method while bidding, so we
// charge it off-session here. No Checkout link, no manual re-entry of a card.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@17.0.0?target=deno";
// ---- inlined shared email helper (single-file deploy) ----

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
    body: JSON.stringify({ from: FROM, to, subject: subject.startsWith("Your Message Here") ? subject : `Your Message Here — ${subject}`, html }),
  });
}

/** "Week ending Aug 28, 2026" for a week_end timestamp. */
function weekEndingLabel(weekEnd?: string | null) {
  if (!weekEnd) return "";
  return `Week ending ${new Date(weekEnd).toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

// ---- end shared ----

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });

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
      // The webhook also handles this; both paths are idempotent.
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
  for (const auction of (closed ?? []) as Array<Record<string, string>>) {
    if (!auction["winning_bid_id"]) continue;
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

  return new Response(JSON.stringify({ closed: (closed ?? []).length, charged, promoted }), {
    headers: { "Content-Type": "application/json" },
  });
});
