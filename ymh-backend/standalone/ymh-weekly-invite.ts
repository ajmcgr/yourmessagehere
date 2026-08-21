// Copy to supabase/functions/ymh-weekly-invite/index.ts in the ROCKET project.
// Deploy: supabase functions deploy ymh-weekly-invite --no-verify-jwt
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY,
//          YMH_CRON_SECRET, YMH_UNSUB_SALT
//
// Emails every past Stripe-verified bidder once per auction week, right after a
// new bidding window opens, inviting them to bid again.
//
// Safety rails (background job):
//   • single-flight lease in Postgres (ymh_try_lock)
//   • bounded batch per run (BATCH), re-run until drained
//   • idempotent ledger (ymh_email_sends, unique on auction+email+kind)
//   • one-click unsubscribe (ymh_email_optouts) honoured before every send
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---- inlined shared email helper (single-file deploy) ----

const SITE = "https://yourmessagehere.co";
const LOGO = `${SITE}/__l5e/assets-v1/95a7cebf-ad72-4869-836e-e9359f2439f1/email-logo.png`;
const FROM = "Your Message Here <hello@yourmessagehere.co>";

function emailLayout(opts: {
  heading: string;
  body: string;
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

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  headers?: Record<string, string>,
) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return { ok: false, status: 0, body: "RESEND_API_KEY not set" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM,
      to,
      subject: subject.startsWith("Your Message Here") ? subject : `Your Message Here — ${subject}`,
      html,
      ...(headers ? { headers } : {}),
    }),
  });
  return { ok: res.ok, status: res.status, body: res.ok ? "" : await res.text() };
}

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

const BATCH = 60; // hard cap on emails per invocation
const usd = (c: number) => `$${(c / 100).toFixed(0)}`;

async function unsubToken(email: string) {
  const salt = Deno.env.get("YMH_UNSUB_SALT") ?? "";
  const data = new TextEncoder().encode(`${email.toLowerCase()}:${salt}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

Deno.serve(async (req) => {
  if (req.headers.get("x-ymh-cron-secret") !== Deno.env.get("YMH_CRON_SECRET")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: locked } = await admin.rpc("ymh_try_lock", {
    p_name: "ymh_weekly_invite",
    p_seconds: 300,
  });
  if (!locked) {
    return new Response(JSON.stringify({ skipped: "locked" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // The open auction is the current bidding window.
  const { data: auction } = await admin
    .from("ymh_auctions")
    .select("id, ends_at, week_end, current_bid_cents, starting_bid_cents, min_increment_cents")
    .eq("status", "open")
    .order("ends_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!auction) {
    return new Response(JSON.stringify({ sent: 0, reason: "no open auction" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const nextBid = (auction.current_bid_cents ?? 0) > 0
    ? auction.current_bid_cents! + auction.min_increment_cents
    : auction.starting_bid_cents;

  const { data: recipients, error } = await admin.rpc("ymh_weekly_invite_recipients", {
    p_auction_id: auction.id,
    p_limit: BATCH,
  });
  if (error) return new Response(error.message, { status: 500 });

  const list = (recipients ?? []) as Array<{ email: string; bidder_name: string | null }>;

  let sent = 0;
  const failures: string[] = [];

  for (const r of list) {
    // Claim first: the unique index makes a concurrent/retried run skip this address.
    const { error: claimErr } = await admin
      .from("ymh_email_sends")
      .insert({ auction_id: auction.id, email: r.email, kind: "weekly_invite" });
    if (claimErr) continue; // already claimed

    const token = await unsubToken(r.email);
    const unsubUrl = `${SITE}/unsubscribe?e=${encodeURIComponent(r.email)}&t=${token}`;
    const first = (r.bidder_name ?? "").trim().split(" ")[0];

    const result = await sendEmail(
      r.email,
      "A new week on the billboard is open",
      emailLayout({
        heading: "The billboard is up for grabs again",
        body:
          `<p style="margin:0 0 16px 0;">${first ? `Hi ${first}, a` : "A"} new bidding window just opened for <strong style="color:#111111;">${weekEndingLabel(auction.week_end)}</strong>.</p>` +
          `<p style="margin:0 0 16px 0;">The next bid starts at <strong style="color:#111111;">${usd(nextBid)}</strong>. Highest bidder at 10:00 PM New York time on Friday owns the internet's billboard for the following seven days.</p>` +
          `<p style="margin:0;">No charge when you bid — you only pay if you win.</p>`,
        cta: { label: "Place a bid", url: `${SITE}/buy` },
        footer:
          `One billboard on the internet. Auction closes Fridays at 10:00 PM New York time.<br />` +
          `<a href="${unsubUrl}" style="color:#9ca3af;">Unsubscribe from weekly reminders</a>`,
      }),
      { "List-Unsubscribe": `<${unsubUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    );

    if (result.ok) {
      sent++;
    } else {
      failures.push(`${r.email}: ${result.status} ${result.body}`.slice(0, 200));
      // Release the claim so the next run retries this address.
      await admin
        .from("ymh_email_sends")
        .delete()
        .eq("auction_id", auction.id)
        .eq("email", r.email)
        .eq("kind", "weekly_invite");
    }
  }

  // Release the lease early so a follow-up run can drain the remainder.
  await admin
    .from("ymh_job_locks")
    .update({ locked_until: new Date().toISOString() })
    .eq("name", "ymh_weekly_invite");

  console.log(
    JSON.stringify({ fn: "ymh-weekly-invite", auction: auction.id, sent, failures: failures.length }),
  );

  return new Response(
    JSON.stringify({
      auction_id: auction.id,
      candidates: list.length,
      sent,
      remaining: list.length === BATCH ? "more" : 0,
      failures,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});
