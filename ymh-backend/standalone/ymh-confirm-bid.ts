// Copy to supabase/functions/ymh-confirm-bid/index.ts in the ROCKET project.
// Deploy: supabase functions deploy ymh-confirm-bid --no-verify-jwt
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY,
//          RESEND_API_KEY, BEEHIIV_API_KEY
//
// Step 2 of bidding: the bidder returned from hosted Stripe Checkout. We
// re-check the Checkout session and its SetupIntent server-side, re-check the auction and the minimum
// bid, then activate the bid transactionally. Only now does it become public.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "npm:stripe@17.0.0";
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
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20", httpClient: Stripe.createFetchHttpClient() });

const BEEHIIV_PUB_ID = "pub_34f2ec46-4dd5-4040-9758-31a8acfb7022";

async function subscribeToBeehiiv(email: string, name: string) {
  const key = Deno.env.get("BEEHIIV_API_KEY");
  if (!key) return "missing_key";
  try {
    const res = await fetch(
      `https://api.beehiiv.com/v2/publications/${BEEHIIV_PUB_ID}/subscriptions`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          reactivate_existing: true,
          send_welcome_email: false,
          utm_source: "yourmessagehere.co",
          utm_medium: "bid_form",
          custom_fields: [{ name: "First Name", value: name }],
        }),
      },
    );
    if (!res.ok) {
      console.error(`[ymh-confirm-bid] Beehiiv failed [${res.status}]: ${await res.text()}`);
      return "failed";
    }
    return "accepted";
  } catch (e) {
    console.error("[ymh-confirm-bid] Beehiiv error", e);
    return "failed";
  }
}

const usd = (c: number) => `$${(c / 100).toFixed(0)}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const bidId = String(body.bid_id ?? "");
    const sessionId = String(body.checkout_session_id ?? "");
    if (!bidId || !sessionId) return json({ error: "Missing bid reference." }, 400);

    const { data: bid } = await admin
      .from("ymh_bids")
      .select("id, auction_id, bidder_name, bidder_email, amount_cents, status")
      .eq("id", bidId)
      .maybeSingle();
    if (!bid) return json({ error: "Bid not found." }, 404);
    if (bid.status === "active") {
      return json({ ok: true, amount_cents: bid.amount_cents, already: true });
    }

    // Authoritative check: never trust the client's word that Stripe succeeded.
    // The hosted Checkout session is the source of truth, and its metadata must
    // point back at this exact bid.
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["setup_intent"],
    });
    if (session.metadata?.ymh_bid_id !== bidId) {
      return json({ error: "Payment verification did not match this bid." }, 403);
    }
    const intent =
      typeof session.setup_intent === "string"
        ? await stripe.setupIntents.retrieve(session.setup_intent)
        : session.setup_intent;
    const setupIntentId = intent?.id ?? "";
    if (!intent || intent.status !== "succeeded" || !intent.payment_method) {
      return json(
        {
          error:
            "Your payment method could not be verified. Your card has not been charged — please try again.",
        },
        402,
      );
    }
    if (intent.metadata?.["ymh_bid_id"] !== bidId) {
      return json({ error: "Payment verification did not match this bid." }, 403);
    }

    // Who currently leads (for the outbid email) before we activate.
    const { data: previous } = await admin
      .from("ymh_bids")
      .select("bidder_email, bidder_name")
      .eq("auction_id", bid.auction_id)
      .eq("status", "active")
      .order("amount_cents", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: activated, error } = await admin.rpc("ymh_activate_bid", {
      p_bid_id: bidId,
      p_customer_id: typeof intent.customer === "string" ? intent.customer : intent.customer?.id,
      p_payment_method_id:
        typeof intent.payment_method === "string" ? intent.payment_method : intent.payment_method.id,
      p_setup_intent_id: setupIntentId,
    });

    if (error) {
      const msg = error.message ?? "";
      if (msg.includes("BID_TOO_LOW")) {
        return json(
          {
            error:
              "The current bid changed while you were verifying your card. Your card has not been charged. Place a new bid to continue.",
          },
          409,
        );
      }
      if (msg.includes("AUCTION_CLOSED")) {
        return json(
          { error: "This auction closed while you were verifying your card. Your card has not been charged." },
          409,
        );
      }
      return json({ error: msg || "Your bid could not be activated." }, 400);
    }

    const { data: auction } = await admin
      .from("ymh_auctions")
      .select("week_end")
      .eq("id", bid.auction_id)
      .maybeSingle();

    const beehiiv = await subscribeToBeehiiv(bid.bidder_email, bid.bidder_name);

    await sendEmail(
      bid.bidder_email,
      "Your bid is in",
      emailLayout({
        heading: "You're in.",
        body: `<p style="margin:0 0 16px 0;">Your verified bid: <strong style="color:#111111;">${usd(bid.amount_cents)}</strong></p><p style="margin:0 0 16px 0;">The auction ends Friday at 10 PM New York time — ${weekEndingLabel(auction?.week_end)}.</p><p style="margin:0 0 16px 0;">If you're the highest bidder when the auction closes, we'll attempt to charge your payment method for your winning bid.</p><p style="margin:0;">We'll email you if you're outbid or if you win.</p>`,
        cta: { label: "View auction", url: "https://yourmessagehere.co/buy" },
      }),
    );
    await admin.from("ymh_email_events").insert({
      auction_id: bid.auction_id,
      bid_id: bid.id,
      recipient: bid.bidder_email,
      template: "bid_confirmation",
    });

    if (previous && previous.bidder_email !== bid.bidder_email) {
      await sendEmail(
        previous.bidder_email,
        "You've been outbid",
        emailLayout({
          heading: "You've been outbid",
          body: `<p style="margin:0;">Hi ${previous.bidder_name}, the current verified bid is now <strong style="color:#111111;">${usd(bid.amount_cents)}</strong>. There's still time to take the billboard back — ${weekEndingLabel(auction?.week_end)}.</p>`,
          cta: { label: "Bid again", url: "https://yourmessagehere.co/buy" },
        }),
      );
      await admin.from("ymh_email_events").insert({
        auction_id: bid.auction_id,
        recipient: previous.bidder_email,
        template: "outbid",
      });
    }

    return json({ ok: true, amount_cents: activated?.amount_cents ?? bid.amount_cents, beehiiv });
  } catch (e) {
    console.error("[ymh-confirm-bid] Unhandled error", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
