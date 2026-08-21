-- ============================================================
-- Your Message Here — email alert signups
-- Run AFTER 0005 in the existing Rocket Supabase project.
-- Lets anyone (not just past bidders) subscribe to the weekly
-- "new bidding window is open" reminder.
-- ============================================================

create table if not exists public.ymh_email_subscribers (
  email text primary key,
  source text not null default 'alerts_page',
  created_at timestamptz not null default now()
);

grant all on public.ymh_email_subscribers to service_role;
alter table public.ymh_email_subscribers enable row level security;
-- No anon/authenticated policies: signup goes through the security-definer
-- RPC below, so the list can never be read or enumerated from the browser.

-- ---------- public signup entry point ----------
create or replace function public.ymh_subscribe_email(p_email text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_email text := lower(btrim(p_email));
begin
  if v_email is null
     or length(v_email) > 254
     or v_email !~ '^[^@\s]+@[^@\s.]+\.[^@\s]+$' then
    raise exception 'invalid email';
  end if;

  -- Re-subscribing clears a previous opt-out.
  delete from public.ymh_email_optouts where email = v_email;

  insert into public.ymh_email_subscribers (email, source)
  values (v_email, 'alerts_page')
  on conflict (email) do nothing;

  return true;
end;
$$;

revoke all on function public.ymh_subscribe_email(text) from public;
grant execute on function public.ymh_subscribe_email(text) to anon, authenticated, service_role;

-- ---------- recipients now include self-serve subscribers ----------
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
  with candidates as (
    select distinct on (lower(b.bidder_email))
           lower(b.bidder_email) as email,
           b.bidder_name
    from public.ymh_bids b
    where b.status = any (public.ymh_eligible_statuses())
      and b.bidder_email is not null
      and b.bidder_email <> ''
    order by lower(b.bidder_email), b.created_at desc

    union

    select s.email, null::text
    from public.ymh_email_subscribers s
  )
  select c.email, c.bidder_name
  from candidates c
  where not exists (
      select 1 from public.ymh_email_optouts o
      where o.email = c.email
    )
    and not exists (
      select 1 from public.ymh_email_sends es
      where es.auction_id = p_auction_id
        and es.kind = 'weekly_invite'
        and es.email = c.email
    )
  limit p_limit;
$$;

revoke all on function public.ymh_weekly_invite_recipients(uuid, integer) from public, anon, authenticated;
grant execute on function public.ymh_weekly_invite_recipients(uuid, integer) to service_role;
