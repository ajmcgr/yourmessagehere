-- Site-wide page view counter for Your Message Here
create table if not exists public.ymh_page_views (
  id boolean primary key default true check (id),
  views bigint not null default 0
);

grant select on public.ymh_page_views to anon, authenticated;
grant all on public.ymh_page_views to service_role;

alter table public.ymh_page_views enable row level security;

drop policy if exists "ymh page views are public" on public.ymh_page_views;
create policy "ymh page views are public"
  on public.ymh_page_views for select
  to anon, authenticated
  using (true);

insert into public.ymh_page_views (id, views)
values (true, 0)
on conflict (id) do nothing;

-- Atomic increment; returns the new total.
create or replace function public.ymh_increment_page_view()
returns bigint
language sql
security definer
set search_path = public
as $$
  insert into public.ymh_page_views (id, views)
  values (true, 1)
  on conflict (id) do update set views = public.ymh_page_views.views + 1
  returning views;
$$;

grant execute on function public.ymh_increment_page_view() to anon, authenticated;
