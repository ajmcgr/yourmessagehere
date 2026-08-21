// Copy to supabase/functions/ymh-place-bid/index.ts in the ROCKET project.
// Deploy: supabase functions deploy ymh-place-bid --no-verify-jwt
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, BEEHIIV_API_KEY
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
      `<p>Hi ${name},</p><p>Your bid of <strong>${usd(amount)}</strong> is now the highest. The auction closes Friday at 10:00 PM New York time.</p>`,
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
        `<p>Hi ${previous.bidder_name},</p><p>The current bid is now <strong>${usd(amount)}</strong>. <a href="https://yourmessagehere.co/buy">Bid again</a>.</p>`,
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
