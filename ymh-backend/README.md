# Your Message Here — backend for the existing Rocket Supabase project

Nothing here is provisioned by Lovable. Deploy it yourself into the Rocket
project. All objects are namespaced `ymh_` and no Rocket object is modified.

## Bidding model (auction integrity)

A number typed into a form is **not** a bid. A row only becomes a public bid
after: amount validated → terms accepted → Stripe SetupIntent verified →
server re-checks the auction and the minimum bid → bid activated.

```
Enter bid → Verify payment method (Stripe SetupIntent) → Bid accepted
          → Win auction → Automatic off-session charge
```

`pending_verification` and `disqualified` bids are excluded from the
`ymh_bids_public` view, from `ymh_auctions.current_bid_cents`, and from winner
selection. Nobody is charged when they bid.

## 1. Schema

```bash
psql "$ROCKET_DB_URL" -f migrations/0001_ymh_init.sql
psql "$ROCKET_DB_URL" -f migrations/0002_ymh_min_bid_5.sql
psql "$ROCKET_DB_URL" -f migrations/0003_ymh_page_views.sql
psql "$ROCKET_DB_URL" -f migrations/0004_ymh_stripe_verification.sql
psql "$ROCKET_DB_URL" -f migrations/0005_ymh_weekly_invites.sql
psql "$ROCKET_DB_URL" -f migrations/0006_ymh_email_subscribers.sql
psql "$ROCKET_DB_URL" -f migrations/0007_ymh_auto_rollover.sql
```

`0005` adds `ymh_email_optouts`, the idempotent `ymh_email_sends` ledger, the
`ymh_job_locks` lease table, `ymh_try_lock` and
`ymh_weekly_invite_recipients` — everything the weekly reminder email needs.

`0004` adds the bid status enum plus `stripe_customer_id`,
`stripe_payment_method_id`, `stripe_setup_intent_id`,
`stripe_payment_intent_id`, `payment_method_verified_at`, `terms_accepted_at`,
`payment_status`; rewrites `ymh_bids_public` to verified bids only; and adds
`ymh_create_pending_bid`, `ymh_activate_bid`, `ymh_disqualify_bid`,
`ymh_restore_bid`, `ymh_recalc_current_bid`, `ymh_promote_next_bidder`. It
drops the old `ymh_place_bid` (bidding with no card). Existing rows are
grandfathered as `active`.

No card data is ever stored in Postgres — only Stripe object IDs.

## 2. Edge Functions

Copy each folder under `functions/` into the Rocket functions directory (or use
the single-file copies in `standalone/`) and deploy:

```bash
supabase functions deploy ymh-start-bid       --no-verify-jwt
supabase functions deploy ymh-confirm-bid     --no-verify-jwt
supabase functions deploy ymh-stripe-webhook  --no-verify-jwt
supabase functions deploy ymh-close-auction   --no-verify-jwt
supabase functions deploy ymh-admin           --no-verify-jwt
supabase functions deploy ymh-weekly-invite   --no-verify-jwt
supabase functions deploy ymh-unsubscribe     --no-verify-jwt
```

`ymh-place-bid` and `ymh-create-checkout` are retired — delete them from the
Rocket project after deploying the new ones.

- **ymh-start-bid** — validates the amount, writes a `pending_verification`
  bid, creates/reuses the Stripe customer and returns a hosted Stripe Checkout
  URL (`mode: "setup"`, cards only). The bidder verifies the card on
  checkout.stripe.com and is redirected back to `/buy?ymh_bid=…&ymh_session=…`.
- **ymh-confirm-bid** — retrieves the Checkout session and its SetupIntent
  server-side (metadata must match the bid), re-checks the
  auction and minimum bid, activates the bid, sends the "Your bid is in" and
  outbid emails, enrolls the bidder in beehiiv.
- **ymh-close-auction** — closes at Friday 22:00 ET, marks the top verified bid
  `provisional_winner`, and charges the saved payment method off-session with
  the amount read from the database. On failure/expiry it promotes the next
  verified bidder.
- **ymh-stripe-webhook** — `payment_intent.succeeded` /
  `payment_intent.payment_failed`.
- **ymh-admin** — backs `/admin`; requires the `x-ymh-admin-secret` header.
- **ymh-weekly-invite** — emails every past Stripe-verified bidder once per
  auction week (Resend) telling them the new bidding window is open. Bounded to
  60 sends per run, single-flight via `ymh_try_lock`, idempotent through the
  `ymh_email_sends` unique key, and it skips anyone in `ymh_email_optouts`.
  Requires the `x-ymh-cron-secret` header.
- **ymh-unsubscribe** — public one-click opt-out backing `/unsubscribe`; the
  token is a salted digest of the address (`YMH_UNSUB_SALT`).

## 3. Secrets (server-side only, never in the frontend)

```bash
supabase secrets set \
  STRIPE_SECRET_KEY=sk_live_... \
  STRIPE_WEBHOOK_SECRET=whsec_... \
  RESEND_API_KEY=re_... \
  BEEHIIV_API_KEY=... \
  YMH_CRON_SECRET=$(openssl rand -hex 32) \
  YMH_ADMIN_SECRET=$(openssl rand -hex 32) \
  YMH_UNSUB_SALT=$(openssl rand -hex 32) \
  SITE_URL=https://yourmessagehere.co
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

## 4. Stripe webhook

Endpoint `https://<rocket-ref>.supabase.co/functions/v1/ymh-stripe-webhook`,
events `payment_intent.succeeded` and `payment_intent.payment_failed`. Store
the signing secret as `STRIPE_WEBHOOK_SECRET`.

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

Weekly reminder to past bidders — runs shortly after the auction rolls over
(Friday 22:00 ET) and again a few times so a large list drains in 60-email
batches. Already-emailed addresses are skipped, so extra runs are harmless.

```sql
select cron.schedule(
  'ymh_weekly_invite',
  '15,25,35 3 * * 6',            -- Sat 03:15/03:25/03:35 UTC = Fri 22:15 ET
  $$
  select net.http_post(
    url := 'https://<rocket-ref>.supabase.co/functions/v1/ymh-weekly-invite',
    headers := '{"Content-Type":"application/json","x-ymh-cron-secret":"<YMH_CRON_SECRET>"}'::jsonb
  );
  $$
);
```

## 6. Frontend env

```
VITE_SUPABASE_URL=https://<rocket-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable/anon key>
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

Only publishable keys ever reach the browser.

## 7. The fake $9m bid

Nothing is deleted automatically. Open `/admin`, enter `YMH_ADMIN_SECRET`, and
press **Disqualify** on that bid. It leaves the public leaderboard, is excluded
from winner selection, and `ymh_auctions.current_bid_cents` is recalculated
from the highest remaining verified bid (the $205 one). The homepage and `/buy`
follow through Realtime.

## 8. Shared email template

Copy `functions/_shared/` alongside the functions before deploying, or deploy
the pre-inlined files in `standalone/`.
