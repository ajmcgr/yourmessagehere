-- ============================================================
-- Your Message Here — weekly "new window is open" invite emails
-- Run AFTER 0001–0004 in the existing Rocket Supabase project.
-- Emails every past verified bidder once per auction week.
-- ============================================================

-- ---------- opt-outs (one row per address that unsubscribed) ----------
create table if not exists public.ymh_email_optouts (
  email text primary key,
  created_at timestamptz not null default now()
);
grant all on public.ymh_email_optouts to service_role;
alter table public.ymh_email_optouts enable row level security;
-- No anon/authenticated policies: only the service role (edge functions) touches it.

-- ---------- idempotent send ledger ----------
create table if not exists public.ymh_email_sends (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.ymh_auctions(id) on delete cascade,
  email text not null,
  kind text not null,
  sent_at timestamptz not null default now(),
  unique (auction_id, email, kind)
);
grant all on public.ymh_email_sends to service_role;
alter table public.ymh_email_sends enable row level security;

-- ---------- single-flight job lease ----------
create table if not exists public.ymh_job_locks (
  name text primary key,
  locked_until timestamptz not null
);
grant all on public.ymh_job_locks to service_role;
alter table public.ymh_job_locks enable row level security;

create or replace function public.ymh_try_lock(p_name text, p_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_ok boolean;
begin
  insert into public.ymh_job_locks (name, locked_until)
  values (p_name, now() + make_interval(secs => p_seconds))
  on conflict (name) do update
    set locked_until = excluded.locked_until
    where public.ymh_job_locks.locked_until < now()
  returning true into v_ok;

  return coalesce(v_ok, false);
end;
$$;

-- ---------- who still needs this week's invite ----------
-- Distinct past bidders with at least one Stripe-verified bid, minus opt-outs
-- and minus anyone already emailed for this auction.
create or replace function public.ymh_weekly_invite_recipients(
  p_auction_id uuid,
  p_limit integer default 100
)
returns table (email text, bidder_name text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (lower(b.bidder_email))
         lower(b.bidder_email) as email,
         b.bidder_name
  from public.ymh_bids b
  where b.status = any (public.ymh_eligible_statuses())
    and b.bidder_email is not null
    and b.bidder_email <> ''
    and not exists (
      select 1 from public.ymh_email_optouts o
      where o.email = lower(b.bidder_email)
    )
    and not exists (
      select 1 from public.ymh_email_sends s
      where s.auction_id = p_auction_id
        and s.kind = 'weekly_invite'
        and s.email = lower(b.bidder_email)
    )
  order by lower(b.bidder_email), b.created_at desc
  limit p_limit;
$$;

revoke all on function public.ymh_try_lock(text, integer) from public, anon, authenticated;
revoke all on function public.ymh_weekly_invite_recipients(uuid, integer) from public, anon, authenticated;
grant execute on function public.ymh_try_lock(text, integer) to service_role;
grant execute on function public.ymh_weekly_invite_recipients(uuid, integer) to service_role;
