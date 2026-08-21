// Copy to supabase/functions/ymh-place-bid/index.ts in the ROCKET project.
// Deploy: supabase functions deploy ymh-place-bid --no-verify-jwt
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, BEEHIIV_API_KEY
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


// beehiiv — enroll every bidder in the Rocket mailing list.
const BEEHIIV_PUB_ID = "pub_34f2ec46-4dd5-4040-9758-31a8acfb7022";

async function subscribeToBeehiiv(email: string, name: string) {
  const key = Deno.env.get("BEEHIIV_API_KEY");
  if (!key) return;
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
    if (!res.ok) console.error(`beehiiv subscribe failed [${res.status}]: ${await res.text()}`);
  } catch (e) {
    console.error("beehiiv subscribe error", e);
  }
}

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

    if (!name || name.length > 120) return json({ error: "Please enter your name." }, 400);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Enter a valid email." }, 400);
    if (!advertiser || advertiser.length > 120) return json({ error: "Enter the advertiser." }, 400);
    if (!Number.isInteger(amount) || amount <= 0) return json({ error: "Enter a valid bid." }, 400);

    // Who currently leads (so we can send an outbid email)
    const { data: auction } = await admin
      .from("ymh_auctions")
      .select("id")
      .eq("status", "open")
      .order("ends_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    let previous: { bidder_email: string; bidder_name: string } | null = null;
    if (auction) {
      const { data } = await admin
        .from("ymh_bids")
        .select("bidder_email, bidder_name")
        .eq("auction_id", auction.id)
        .order("amount_cents", { ascending: false })
        .limit(1)
        .maybeSingle();
      previous = data as typeof previous;
    }

    // All bid rules are enforced inside the database function.
    const { data: bid, error } = await admin.rpc("ymh_place_bid", {
      p_name: name,
      p_email: email,
      p_advertiser: advertiser,
      p_website: website,
      p_amount_cents: amount,
    });
    if (error) return json({ error: error.message }, 400);

    const usd = (c: number) => `$${(c / 100).toFixed(0)}`;

    await sendEmail(
      email,
      `You're the highest bidder — ${usd(amount)}`,
      emailLayout({
        heading: "You're the highest bidder 📣",
        body: `<p style="margin:0 0 16px 0;">Hi ${name}, your bid of <strong style="color:#111111;">${usd(amount)}</strong> is now the highest bid for the billboard.</p><p style="margin:0;">The auction closes Friday at 10:00 PM New York time. We'll email you if someone outbids you.</p>`,
        cta: { label: "View the auction", url: "https://yourmessagehere.co/buy" },
      }),
    );
    await admin.from("ymh_email_events").insert({
      auction_id: bid?.auction_id ?? null,
      bid_id: bid?.id ?? null,
      recipient: email,
      template: "bid_confirmation",
    });

    if (previous && previous.bidder_email !== email) {
      await sendEmail(
        previous.bidder_email,
        "You've been outbid",
        emailLayout({
          heading: "You've been outbid",
          body: `<p style="margin:0;">Hi ${previous.bidder_name}, the current bid is now <strong style="color:#111111;">${usd(amount)}</strong>. There's still time to take the billboard back.</p>`,
          cta: { label: "Bid again", url: "https://yourmessagehere.co/buy" },
        }),
      );

      await admin.from("ymh_email_events").insert({
        auction_id: bid?.auction_id ?? null,
        recipient: previous.bidder_email,
        template: "outbid",
      });
    }

    return json({ ok: true, amount_cents: amount });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
