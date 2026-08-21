# Your Message Here — backend for the existing Rocket Supabase project

Nothing here is provisioned by Lovable. Deploy it yourself into the Rocket
project. All objects are namespaced `ymh_` and no Rocket object is modified.

## 1. Schema

```bash
psql "$ROCKET_DB_URL" -f migrations/0001_ymh_init.sql
# or paste the file into the Rocket SQL editor
```

Creates: `ymh_settings`, `ymh_auctions`, `ymh_bids` (+ `ymh_bids_public` view),
`ymh_billboards`, `ymh_email_events`, the `ymh-creatives` storage bucket, RLS
policies, realtime publication entries, and the `ymh_place_bid` /
`ymh_close_due_auctions` functions. It also seeds the first auction ending the
next Friday at 22:00 America/New_York.

## 2. Edge Functions

Copy each folder under `functions/` into `supabase/functions/` in the Rocket
repo and deploy:

```bash
supabase functions deploy ymh-place-bid       --no-verify-jwt
supabase functions deploy ymh-create-checkout --no-verify-jwt
supabase functions deploy ymh-stripe-webhook  --no-verify-jwt
supabase functions deploy ymh-close-auction   --no-verify-jwt
```

## 3. Secrets (server-side only, never in the frontend)

```bash
supabase secrets set \
  STRIPE_SECRET_KEY=sk_live_... \
  STRIPE_WEBHOOK_SECRET=whsec_... \
  RESEND_API_KEY=re_... \
  YMH_CRON_SECRET=$(openssl rand -hex 32) \
  SITE_URL=https://yourmessagehere.co
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

## 4. Stripe webhook

Add an endpoint in the Stripe dashboard pointing at
`https://<rocket-ref>.supabase.co/functions/v1/ymh-stripe-webhook`, event
`checkout.session.completed`, and store its signing secret as
`STRIPE_WEBHOOK_SECRET`.

## 5. Cron

```sql
select cron.schedule(
  'ymh_close_auction_hourly',
  '5 * * * *',
  $$
  select net.http_post(
    url := 'https://<rocket-ref>.supabase.co/functions/v1/ymh-close-auction',
    headers := '{"Content-Type":"application/json","x-ymh-cron-secret":"<YMH_CRON_SECRET>"}'::jsonb
  );
  $$
);
```

## 6. Frontend env

```
VITE_SUPABASE_URL=https://<rocket-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable/anon key>
```

Only the publishable key ever reaches the browser.
