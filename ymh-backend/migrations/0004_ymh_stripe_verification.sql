-- ============================================================
-- Your Message Here — auction integrity / Stripe verification
-- Run AFTER 0001–0003 in the existing Rocket Supabase project.
-- A bid is only public once Stripe has verified a payment method.
-- ============================================================

-- ---------- bid status ----------
do $$ begin
  create type public.ymh_bid_status as enum (
    'pending_verification','active','outbid','provisional_winner',
    'winner_paid','payment_failed','payment_expired','disqualified'
  );
exception when duplicate_object then null; end $$;

alter table public.ymh_bids
  add column if not exists status public.ymh_bid_status not null default 'active',
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_payment_method_id text,
  add column if not exists stripe_setup_intent_id text,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists payment_method_verified_at timestamptz,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists payment_status text not null default 'none',
  add column if not exists payment_failure_reason text,
  add column if not exists payment_due_at timestamptz,
  add column if not exists disqualified_at timestamptz,
  add column if not exists disqualified_reason text;

create index if not exists ymh_bids_status_idx
  on public.ymh_bids (auction_id, status, amount_cents desc);

-- ---------- public projection: verified bids only ----------
-- pending_verification and disqualified bids never reach the public site.
drop view if exists public.ymh_bids_public;
create view public.ymh_bids_public as
  select id, auction_id, bidder_name, advertiser, website, amount_cents, created_at
  from public.ymh_bids
  where status in ('active','outbid','provisional_winner','winner_paid',
                   'payment_failed','payment_expired');
alter view public.ymh_bids_public owner to postgres;
grant select on public.ymh_bids_public to anon, authenticated;

-- ---------- helpers ----------
-- Statuses that count as a legitimate, Stripe-verified auction bid.
create or replace function public.ymh_eligible_statuses()
returns public.ymh_bid_status[]
language sql immutable
as $$ select array['active','outbid','provisional_winner','winner_paid']::public.ymh_bid_status[] $$;

-- Recalculate the authoritative current bid from eligible verified bids only.
create or replace function public.ymh_recalc_current_bid(p_auction_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_max integer;
begin
  select max(amount_cents) into v_max
  from public.ymh_bids
  where auction_id = p_auction_id
    and status = any (public.ymh_eligible_statuses());

  update public.ymh_auctions set current_bid_cents = v_max where id = p_auction_id;
  return v_max;
end;
$$;

-- ---------- step 1: pending bid (never public) ----------
create or replace function public.ymh_create_pending_bid(
  p_name text,
  p_email text,
  p_advertiser text,
  p_website text,
  p_amount_cents integer
) returns public.ymh_bids
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auction public.ymh_auctions;
  v_current integer;
  v_min integer;
  v_bid public.ymh_bids;
begin
  select * into v_auction
  from public.ymh_auctions
  where status = 'open' and ends_at > now()
  order by ends_at asc limit 1;

  if v_auction is null then
    raise exception 'No auction is currently open.';
  end if;

  select max(amount_cents) into v_current
  from public.ymh_bids
  where auction_id = v_auction.id and status = any (public.ymh_eligible_statuses());

  v_min := coalesce(v_current + v_auction.min_increment_cents, v_auction.starting_bid_cents);

  if p_amount_cents < v_min then
    raise exception 'Minimum bid is $%.', (v_min / 100);
  end if;
  if (p_amount_cents - v_min) % v_auction.min_increment_cents <> 0 then
    raise exception 'Bids must be in increments of $%.', (v_auction.min_increment_cents / 100);
  end if;

  insert into public.ymh_bids (
    auction_id, bidder_name, bidder_email, advertiser, website, amount_cents,
    status, terms_accepted_at, payment_status
  ) values (
    v_auction.id, p_name, p_email, p_advertiser, nullif(p_website, ''), p_amount_cents,
    'pending_verification', now(), 'awaiting_verification'
  ) returning * into v_bid;

  return v_bid;
end;
$$;

revoke all on function public.ymh_create_pending_bid(text, text, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.ymh_create_pending_bid(text, text, text, text, integer)
  to service_role;

-- ---------- step 2: activate after Stripe verification ----------
-- Re-validates the auction and the minimum bid, because another verified bid
-- may have landed while this bidder was completing Stripe verification.
create or replace function public.ymh_activate_bid(
  p_bid_id uuid,
  p_customer_id text,
  p_payment_method_id text,
  p_setup_intent_id text
) returns public.ymh_bids
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bid public.ymh_bids;
  v_auction public.ymh_auctions;
  v_current integer;
  v_min integer;
begin
  select * into v_bid from public.ymh_bids where id = p_bid_id for update;
  if v_bid is null then
    raise exception 'Bid not found.';
  end if;
  if v_bid.status = 'active' then
    return v_bid; -- idempotent
  end if;
  if v_bid.status <> 'pending_verification' then
    raise exception 'This bid can no longer be activated.';
  end if;

  select * into v_auction from public.ymh_auctions where id = v_bid.auction_id for update;
  if v_auction.status <> 'open' or v_auction.ends_at <= now() then
    raise exception 'AUCTION_CLOSED';
  end if;

  select max(amount_cents) into v_current
  from public.ymh_bids
  where auction_id = v_auction.id and status = any (public.ymh_eligible_statuses());

  v_min := coalesce(v_current + v_auction.min_increment_cents, v_auction.starting_bid_cents);

  if v_bid.amount_cents < v_min then
    update public.ymh_bids
      set status = 'disqualified',
          disqualified_at = now(),
          disqualified_reason = 'Outbid during payment verification',
          payment_status = 'not_charged'
      where id = v_bid.id;
    raise exception 'BID_TOO_LOW';
  end if;

  -- everything currently active becomes outbid
  update public.ymh_bids
    set status = 'outbid'
    where auction_id = v_auction.id and status = 'active' and id <> v_bid.id;

  update public.ymh_bids
    set status = 'active',
        stripe_customer_id = p_customer_id,
        stripe_payment_method_id = p_payment_method_id,
        stripe_setup_intent_id = p_setup_intent_id,
        payment_method_verified_at = now(),
        payment_status = 'verified'
    where id = v_bid.id
    returning * into v_bid;

  perform public.ymh_recalc_current_bid(v_auction.id);
  return v_bid;
end;
$$;

revoke all on function public.ymh_activate_bid(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.ymh_activate_bid(uuid, text, text, text) to service_role;

-- ---------- admin: disqualify + restore ----------
create or replace function public.ymh_disqualify_bid(p_bid_id uuid, p_reason text default null)
returns public.ymh_auctions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bid public.ymh_bids;
  v_auction public.ymh_auctions;
  v_top public.ymh_bids;
begin
  select * into v_bid from public.ymh_bids where id = p_bid_id for update;
  if v_bid is null then raise exception 'Bid not found.'; end if;

  update public.ymh_bids
    set status = 'disqualified',
        disqualified_at = now(),
        disqualified_reason = coalesce(p_reason, 'Disqualified by admin'),
        payment_status = 'not_charged'
    where id = p_bid_id;

  -- the highest remaining eligible verified bid becomes the current bid
  select * into v_top from public.ymh_bids
  where auction_id = v_bid.auction_id and status = any (public.ymh_eligible_statuses())
  order by amount_cents desc, created_at asc limit 1;

  if v_top is not null then
    update public.ymh_bids set status = 'outbid'
      where auction_id = v_bid.auction_id and status = 'active' and id <> v_top.id;
    update public.ymh_bids set status = 'active'
      where id = v_top.id and status in ('outbid','active');
  end if;

  perform public.ymh_recalc_current_bid(v_bid.auction_id);

  select * into v_auction from public.ymh_auctions where id = v_bid.auction_id;
  return v_auction;
end;
$$;

revoke all on function public.ymh_disqualify_bid(uuid, text) from public, anon, authenticated;
grant execute on function public.ymh_disqualify_bid(uuid, text) to service_role;

create or replace function public.ymh_restore_bid(p_bid_id uuid)
returns public.ymh_auctions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bid public.ymh_bids;
  v_auction public.ymh_auctions;
begin
  select * into v_bid from public.ymh_bids where id = p_bid_id for update;
  if v_bid is null then raise exception 'Bid not found.'; end if;
  if v_bid.payment_method_verified_at is null then
    raise exception 'This bid never had a verified payment method.';
  end if;

  update public.ymh_bids
    set status = 'outbid', disqualified_at = null, disqualified_reason = null,
        payment_status = 'verified'
    where id = p_bid_id;

  -- highest eligible bid is active again
  update public.ymh_bids set status = 'outbid'
    where auction_id = v_bid.auction_id and status = 'active';
  update public.ymh_bids set status = 'active'
    where id = (
      select id from public.ymh_bids
      where auction_id = v_bid.auction_id and status = any (public.ymh_eligible_statuses())
      order by amount_cents desc, created_at asc limit 1
    );

  perform public.ymh_recalc_current_bid(v_bid.auction_id);
  select * into v_auction from public.ymh_auctions where id = v_bid.auction_id;
  return v_auction;
end;
$$;

revoke all on function public.ymh_restore_bid(uuid) from public, anon, authenticated;
grant execute on function public.ymh_restore_bid(uuid) to service_role;

-- ---------- close: only verified bids can win ----------
create or replace function public.ymh_close_due_auctions()
returns setof public.ymh_auctions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auction public.ymh_auctions;
  v_top public.ymh_bids;
  v_deadline_hours integer;
begin
  select coalesce((value #>> '{}')::integer, 24) into v_deadline_hours
  from public.ymh_settings where key = 'payment_deadline_hours';
  v_deadline_hours := coalesce(v_deadline_hours, 24);

  for v_auction in
    select * from public.ymh_auctions where status = 'open' and ends_at <= now() for update
  loop
    -- pending_verification and disqualified bids can never win
    select * into v_top from public.ymh_bids
    where auction_id = v_auction.id
      and status = any (public.ymh_eligible_statuses())
      and payment_method_verified_at is not null
    order by amount_cents desc, created_at asc
    limit 1;

    if v_top is null then
      update public.ymh_auctions set status = 'expired' where id = v_auction.id
      returning * into v_auction;
    else
      update public.ymh_bids
        set status = 'provisional_winner', payment_status = 'charge_pending',
            payment_due_at = now() + make_interval(hours => v_deadline_hours)
        where id = v_top.id;

      update public.ymh_auctions
        set status = 'awaiting_payment',
            winning_bid_id = v_top.id,
            payment_due_at = now() + make_interval(hours => v_deadline_hours)
        where id = v_auction.id
        returning * into v_auction;
    end if;

    return next v_auction;
  end loop;

  if not exists (select 1 from public.ymh_auctions where status = 'open') then
    insert into public.ymh_auctions (status, ends_at, week_start, week_end)
    select 'open', e, e, e + interval '7 days'
    from (select (
      (date_trunc('day', (now() at time zone 'America/New_York'))
        + make_interval(days => (((5 - extract(isodow from (now() at time zone 'America/New_York'))::int) + 7) % 7))
        + interval '22 hours') at time zone 'America/New_York'
    ) as e) s;
  end if;
end;
$$;

revoke all on function public.ymh_close_due_auctions() from public, anon, authenticated;
grant execute on function public.ymh_close_due_auctions() to service_role;

-- ---------- winner payment failed → next eligible verified bidder ----------
create or replace function public.ymh_promote_next_bidder(p_auction_id uuid)
returns public.ymh_bids
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next public.ymh_bids;
  v_deadline_hours integer;
begin
  select coalesce((value #>> '{}')::integer, 24) into v_deadline_hours
  from public.ymh_settings where key = 'payment_deadline_hours';

  select * into v_next from public.ymh_bids
  where auction_id = p_auction_id
    and status in ('active','outbid')
    and payment_method_verified_at is not null
  order by amount_cents desc, created_at asc
  limit 1;

  if v_next is null then
    update public.ymh_auctions set status = 'expired', winning_bid_id = null
    where id = p_auction_id;
    return null;
  end if;

  update public.ymh_bids
    set status = 'provisional_winner', payment_status = 'charge_pending',
        payment_due_at = now() + make_interval(hours => coalesce(v_deadline_hours, 24))
    where id = v_next.id
    returning * into v_next;

  update public.ymh_auctions
    set status = 'awaiting_payment', winning_bid_id = v_next.id,
        payment_due_at = v_next.payment_due_at
    where id = p_auction_id;

  return v_next;
end;
$$;

revoke all on function public.ymh_promote_next_bidder(uuid) from public, anon, authenticated;
grant execute on function public.ymh_promote_next_bidder(uuid) to service_role;

-- ---------- retire the old "bid without a card" path ----------
drop function if exists public.ymh_place_bid(text, text, text, text, integer);
