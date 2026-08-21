-- ============================================================
-- Your Message Here (ymh_) — schema for the EXISTING Rocket Supabase project
-- Run with: supabase db push  (or paste into the Rocket SQL editor)
-- Everything is namespaced with ymh_; no existing Rocket object is touched.
-- ============================================================

-- ---------- enums ----------
do $$ begin
  create type public.ymh_auction_status as enum ('open','closed','awaiting_payment','paid','expired');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ymh_billboard_status as enum ('pending','approved','rejected');
exception when duplicate_object then null; end $$;

-- ---------- settings ----------
create table if not exists public.ymh_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
grant select on public.ymh_settings to anon, authenticated;
grant all on public.ymh_settings to service_role;
alter table public.ymh_settings enable row level security;

drop policy if exists "ymh_settings public read" on public.ymh_settings;
create policy "ymh_settings public read"
  on public.ymh_settings for select to anon, authenticated using (true);

insert into public.ymh_settings (key, value) values
  ('starting_bid_cents', '500'::jsonb),
  ('min_increment_cents', '1000'::jsonb),
  ('payment_deadline_hours', '24'::jsonb)
on conflict (key) do nothing;

-- ---------- auctions ----------
create table if not exists public.ymh_auctions (
  id uuid primary key default gen_random_uuid(),
  status public.ymh_auction_status not null default 'open',
  ends_at timestamptz not null,
  week_start timestamptz not null,
  week_end timestamptz not null,
  starting_bid_cents integer not null default 500,
  min_increment_cents integer not null default 1000,
  current_bid_cents integer,
  winning_bid_id uuid,
  payment_due_at timestamptz,
  stripe_checkout_session_id text,
  created_at timestamptz not null default now()
);
create index if not exists ymh_auctions_status_idx on public.ymh_auctions (status, ends_at);

grant select on public.ymh_auctions to anon, authenticated;
grant all on public.ymh_auctions to service_role;
alter table public.ymh_auctions enable row level security;

drop policy if exists "ymh_auctions public read" on public.ymh_auctions;
create policy "ymh_auctions public read"
  on public.ymh_auctions for select to anon, authenticated using (true);

-- ---------- bids ----------
create table if not exists public.ymh_bids (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.ymh_auctions(id) on delete cascade,
  bidder_name text not null,
  bidder_email text not null,
  advertiser text not null,
  website text,
  amount_cents integer not null check (amount_cents > 0),
  payment_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);
create index if not exists ymh_bids_auction_amount_idx
  on public.ymh_bids (auction_id, amount_cents desc);

-- Base table is service-role only: it holds emails and payment tokens.
grant all on public.ymh_bids to service_role;
alter table public.ymh_bids enable row level security;

-- Public-safe projection used by the frontend (no email, no payment token).
create or replace view public.ymh_bids_public as
  select id, auction_id, bidder_name, advertiser, website, amount_cents, created_at
  from public.ymh_bids;
alter view public.ymh_bids_public owner to postgres;
grant select on public.ymh_bids_public to anon, authenticated;

alter table public.ymh_auctions drop constraint if exists ymh_auctions_winning_bid_fk;
alter table public.ymh_auctions
  add constraint ymh_auctions_winning_bid_fk
  foreign key (winning_bid_id) references public.ymh_bids(id) on delete set null;

-- ---------- billboards ----------
create table if not exists public.ymh_billboards (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.ymh_auctions(id) on delete cascade,
  advertiser text,
  headline text,
  image_url text,
  click_url text,
  week_start timestamptz not null,
  week_end timestamptz not null,
  status public.ymh_billboard_status not null default 'pending',
  created_at timestamptz not null default now()
);
create index if not exists ymh_billboards_live_idx
  on public.ymh_billboards (status, week_start, week_end);

grant select on public.ymh_billboards to anon, authenticated;
grant all on public.ymh_billboards to service_role;
alter table public.ymh_billboards enable row level security;

drop policy if exists "ymh_billboards public read approved" on public.ymh_billboards;
create policy "ymh_billboards public read approved"
  on public.ymh_billboards for select to anon, authenticated
  using (status = 'approved');

-- ---------- email events (service role only) ----------
create table if not exists public.ymh_email_events (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid references public.ymh_auctions(id) on delete set null,
  bid_id uuid references public.ymh_bids(id) on delete set null,
  recipient text not null,
  template text not null,
  provider_id text,
  status text not null default 'sent',
  error text,
  created_at timestamptz not null default now()
);
grant all on public.ymh_email_events to service_role;
alter table public.ymh_email_events enable row level security;

-- ---------- realtime ----------
do $$ begin
  alter publication supabase_realtime add table public.ymh_bids;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.ymh_auctions;
exception when duplicate_object then null; end $$;

-- ---------- storage bucket for creatives ----------
insert into storage.buckets (id, name, public)
values ('ymh-creatives', 'ymh-creatives', true)
on conflict (id) do nothing;

drop policy if exists "ymh creatives public read" on storage.objects;
create policy "ymh creatives public read"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'ymh-creatives');
-- Uploads happen through Edge Functions using the service role only.

-- ---------- atomic, race-safe bid placement ----------
create or replace function public.ymh_place_bid(
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
  v_min integer;
  v_bid public.ymh_bids;
begin
  select * into v_auction
  from public.ymh_auctions
  where status = 'open' and ends_at > now()
  order by ends_at asc
  limit 1
  for update;

  if v_auction is null then
    raise exception 'No auction is currently open.';
  end if;

  v_min := coalesce(v_auction.current_bid_cents + v_auction.min_increment_cents,
                    v_auction.starting_bid_cents);

  if p_amount_cents < v_min then
    raise exception 'Minimum bid is $%.', (v_min / 100);
  end if;

  if (p_amount_cents - v_min) % v_auction.min_increment_cents <> 0 then
    raise exception 'Bids must be in increments of $%.', (v_auction.min_increment_cents / 100);
  end if;

  insert into public.ymh_bids (auction_id, bidder_name, bidder_email, advertiser, website, amount_cents)
  values (v_auction.id, p_name, p_email, p_advertiser, nullif(p_website, ''), p_amount_cents)
  returning * into v_bid;

  update public.ymh_auctions
  set current_bid_cents = p_amount_cents
  where id = v_auction.id;

  return v_bid;
end;
$$;

revoke all on function public.ymh_place_bid(text, text, text, text, integer) from public, anon, authenticated;
grant execute on function public.ymh_place_bid(text, text, text, text, integer) to service_role;

-- ---------- auction close ----------
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
    select * into v_top from public.ymh_bids
    where auction_id = v_auction.id
    order by amount_cents desc, created_at asc
    limit 1;

    if v_top is null then
      update public.ymh_auctions set status = 'expired' where id = v_auction.id
      returning * into v_auction;
    else
      update public.ymh_auctions
      set status = 'awaiting_payment',
          winning_bid_id = v_top.id,
          payment_due_at = now() + make_interval(hours => v_deadline_hours)
      where id = v_auction.id
      returning * into v_auction;
    end if;

    return next v_auction;
  end loop;

  -- open the next week's auction if none is open
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

-- ---------- seed the first auction (next Friday 22:00 America/New_York) ----------
insert into public.ymh_auctions (status, ends_at, week_start, week_end, starting_bid_cents, min_increment_cents)
select 'open', e, e, e + interval '7 days', 500, 1000
from (select (
  (date_trunc('day', (now() at time zone 'America/New_York'))
    + make_interval(days => (((5 - extract(isodow from (now() at time zone 'America/New_York'))::int) + 7) % 7))
    + interval '22 hours') at time zone 'America/New_York'
) as e) s
where not exists (select 1 from public.ymh_auctions where status = 'open');
