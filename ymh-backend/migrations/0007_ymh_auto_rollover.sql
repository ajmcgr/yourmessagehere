-- ============================================================
-- 0007 — automatic weekly auction rollover
--
-- Fixes: the countdown could sit at 00:00:00 because closing an auction and
-- opening the next one only ever happened from the hourly cron Edge Function.
--
-- Adds:
--   ymh_next_friday_10pm(ts)   — timezone-aware (EST/EDT) next Friday 22:00 ET
--   ymh_rollover_auctions()    — idempotent close + open, safe to call from
--                                anywhere, including anonymous website visits
--   ymh_current_auction()      — anon-callable: rolls over if due, then returns
--                                the single active auction
-- ============================================================

-- ---------- next Friday 22:00 America/New_York, strictly after p_from ----------
create or replace function public.ymh_next_friday_10pm(p_from timestamptz default now())
returns timestamptz
language sql
stable
set search_path = public
as $$
  with local as (select (p_from at time zone 'America/New_York') as l),
  base as (
    select (date_trunc('day', l)
            + make_interval(days => (((5 - extract(isodow from l)::int) + 7) % 7))
            + interval '22 hours') as candidate
    from local
  )
  select case
           when (candidate at time zone 'America/New_York') > p_from
             then (candidate at time zone 'America/New_York')
           else ((candidate + interval '7 days') at time zone 'America/New_York')
         end
  from base;
$$;

grant execute on function public.ymh_next_friday_10pm(timestamptz) to anon, authenticated, service_role;

-- ---------- idempotent rollover ----------
-- Closes every open auction whose deadline has passed (recording the winner
-- from the highest Stripe-verified eligible bid only), then guarantees exactly
-- one open auction ending on the next Friday at 22:00 America/New_York.
create or replace function public.ymh_rollover_auctions()
returns public.ymh_auctions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auction public.ymh_auctions;
  v_top public.ymh_bids;
  v_deadline_hours integer;
  v_open public.ymh_auctions;
  v_ends timestamptz;
begin
  -- Single-flight: concurrent visitors serialise here, so only one of them can
  -- create the next auction. The lock is released at transaction end.
  perform pg_advisory_xact_lock(hashtext('ymh_rollover_auctions'));

  select coalesce((value #>> '{}')::integer, 24) into v_deadline_hours
  from public.ymh_settings where key = 'payment_deadline_hours';
  v_deadline_hours := coalesce(v_deadline_hours, 24);

  for v_auction in
    select * from public.ymh_auctions
    where status = 'open' and ends_at <= now()
    order by ends_at asc
    for update
  loop
    select * into v_top from public.ymh_bids
    where auction_id = v_auction.id
      and status = any (public.ymh_eligible_statuses())
      and payment_method_verified_at is not null
    order by amount_cents desc, created_at asc
    limit 1;

    if v_top is null then
      -- No valid verified bid: close with no winner. Never blocks rollover.
      update public.ymh_auctions set status = 'expired' where id = v_auction.id;
    else
      update public.ymh_bids
        set status = 'provisional_winner',
            payment_status = 'charge_pending',
            payment_due_at = now() + make_interval(hours => v_deadline_hours)
        where id = v_top.id;

      update public.ymh_auctions
        set status = 'awaiting_payment',
            winning_bid_id = v_top.id,
            current_bid_cents = v_top.amount_cents,
            payment_due_at = now() + make_interval(hours => v_deadline_hours)
        where id = v_auction.id;
    end if;
  end loop;

  -- Exactly one open auction, always ending on the next Friday 22:00 ET.
  select * into v_open from public.ymh_auctions
  where status = 'open' and ends_at > now()
  order by ends_at asc
  limit 1;

  if v_open.id is null then
    v_ends := public.ymh_next_friday_10pm(now());
    insert into public.ymh_auctions (status, ends_at, week_start, week_end, current_bid_cents)
    values ('open', v_ends, v_ends, v_ends + interval '7 days', null)
    returning * into v_open;
  end if;

  return v_open;
end;
$$;

revoke all on function public.ymh_rollover_auctions() from public;
grant execute on function public.ymh_rollover_auctions() to anon, authenticated, service_role;

-- ---------- what the website reads ----------
create or replace function public.ymh_current_auction()
returns public.ymh_auctions
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.ymh_auctions;
begin
  select * into v from public.ymh_auctions
  where status = 'open' and ends_at > now()
  order by ends_at asc
  limit 1;

  -- Only take the write path (and the advisory lock) when rollover is due.
  if v.id is null then
    v := public.ymh_rollover_auctions();
  end if;

  return v;
end;
$$;

revoke all on function public.ymh_current_auction() from public;
grant execute on function public.ymh_current_auction() to anon, authenticated, service_role;

-- ---------- keep the cron path consistent ----------
-- ymh_close_due_auctions() used a next-Friday expression that returns *today*
-- 22:00 when it runs exactly at the deadline, which could create an auction
-- that is already expired. Delegate to the shared rollover instead.
create or replace function public.ymh_close_due_auctions()
returns setof public.ymh_auctions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
begin
  select array_agg(id) into v_ids
  from public.ymh_auctions
  where status = 'open' and ends_at <= now();

  perform public.ymh_rollover_auctions();

  return query
    select * from public.ymh_auctions
    where id = any (coalesce(v_ids, '{}'::uuid[]));
end;
$$;

revoke all on function public.ymh_close_due_auctions() from public, anon, authenticated;
grant execute on function public.ymh_close_due_auctions() to service_role;

-- ---------- one-off: repair any stuck auction right now ----------
select public.ymh_rollover_auctions();
