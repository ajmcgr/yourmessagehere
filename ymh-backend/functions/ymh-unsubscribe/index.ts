// Copy to supabase/functions/ymh-unsubscribe/index.ts in the ROCKET project.
// Deploy: supabase functions deploy ymh-unsubscribe --no-verify-jwt
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, YMH_UNSUB_SALT
//
// Public endpoint. The token is a salted digest of the address, so nobody can
// unsubscribe an address they were not emailed at.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

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
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  let email = "";
  let token = "";
  if (req.method === "GET") {
    const url = new URL(req.url);
    email = url.searchParams.get("e") ?? "";
    token = url.searchParams.get("t") ?? "";
  } else {
    const body = await req.json().catch(() => ({}));
    email = String(body.email ?? "");
    token = String(body.token ?? "");
  }

  email = email.trim().toLowerCase();
  if (!email || !token || token !== (await unsubToken(email))) {
    return new Response(JSON.stringify({ error: "Invalid unsubscribe link" }), {
      status: 400,
      headers: cors,
    });
  }

  await admin.from("ymh_email_optouts").upsert({ email }, { onConflict: "email" });

  return new Response(JSON.stringify({ ok: true, email }), { headers: cors });
});
