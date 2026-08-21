// Copy to supabase/functions/ymh-admin/index.ts in the ROCKET project.
// Deploy: supabase functions deploy ymh-admin --no-verify-jwt
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, YMH_ADMIN_SECRET
//
// Admin console backend for /admin. Every request must carry the shared admin
// secret in the x-ymh-admin-secret header. Bidder emails never reach the
// public site — only this authenticated endpoint returns them.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-ymh-admin-secret",
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const secret = Deno.env.get("YMH_ADMIN_SECRET");
  if (!secret || req.headers.get("x-ymh-admin-secret") !== secret) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = req.method === "POST" ? await req.json() : {};
    const action = String(body.action ?? "list");

    if (action === "list") {
      const { data: auctions } = await admin
        .from("ymh_auctions")
        .select("*")
        .order("ends_at", { ascending: false })
        .limit(10);

      const ids = (auctions ?? []).map((a: { id: string }) => a.id);
      const { data: bids } = await admin
        .from("ymh_bids")
        .select(
          "id, auction_id, bidder_name, bidder_email, advertiser, website, amount_cents, status, payment_status, payment_failure_reason, payment_method_verified_at, terms_accepted_at, disqualified_at, disqualified_reason, stripe_customer_id, stripe_payment_method_id, stripe_setup_intent_id, stripe_payment_intent_id, created_at",
        )
        .in("auction_id", ids)
        .order("amount_cents", { ascending: false });

      return json({ auctions: auctions ?? [], bids: bids ?? [] });
    }

    if (action === "disqualify") {
      const { data, error } = await admin.rpc("ymh_disqualify_bid", {
        p_bid_id: String(body.bid_id),
        p_reason: body.reason ? String(body.reason) : null,
      });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, auction: data });
    }

    if (action === "restore") {
      const { data, error } = await admin.rpc("ymh_restore_bid", {
        p_bid_id: String(body.bid_id),
      });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, auction: data });
    }

    if (action === "recalc") {
      const { error } = await admin.rpc("ymh_recalc_current_bid", {
        p_auction_id: String(body.auction_id),
      });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("[ymh-admin] Unhandled error", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
