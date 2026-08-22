-- Your Message Here — winner creative upload (token-scoped, anon-safe)
-- Run in the Rocket Supabase SQL editor.

-- Allow the winner's browser to upload into the creatives bucket.
-- Reads are already public; writes are limited to this bucket only, and the
-- billboard row can only be written through the token-scoped RPC below.
drop policy if exists "ymh creatives token upload" on storage.objects;
create policy "ymh creatives token upload"
  on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'ymh-creatives');

-- ---------- context for the upload page ----------
create or replace function public.ymh_creative_context(p_token uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_bid public.ymh_bids;
  v_auction public.ymh_auctions;
  v_board public.ymh_billboards;
begin
  select * into v_bid from public.ymh_bids where payment_token = p_token;
  if v_bid is null then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  select * into v_auction from public.ymh_auctions where id = v_bid.auction_id;

  select * into v_board
  from public.ymh_billboards
  where auction_id = v_bid.auction_id
  order by created_at desc
  limit 1;

  return json_build_object(
    'ok', true,
    'auction_id', v_bid.auction_id,
    'advertiser', v_bid.advertiser,
    'website', v_bid.website,
    'amount_cents', v_bid.amount_cents,
    'week_start', coalesce(v_board.week_start, v_auction.week_start),
    'week_end', coalesce(v_board.week_end, v_auction.week_end),
    'headline', v_board.headline,
    'image_url', v_board.image_url,
    'click_url', coalesce(v_board.click_url, v_bid.website),
    'status', coalesce(v_board.status::text, 'pending')
  );
end;
$$;

grant execute on function public.ymh_creative_context(uuid) to anon, authenticated;

-- ---------- submit / replace the creative ----------
create or replace function public.ymh_submit_creative(
  p_token uuid,
  p_image_url text,
  p_headline text,
  p_click_url text
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bid public.ymh_bids;
  v_auction public.ymh_auctions;
  v_board_id uuid;
begin
  select * into v_bid from public.ymh_bids where payment_token = p_token;
  if v_bid is null then
    raise exception 'Invalid or expired upload link.';
  end if;

  if p_image_url is null or length(trim(p_image_url)) = 0 then
    raise exception 'An image is required.';
  end if;

  select * into v_auction from public.ymh_auctions where id = v_bid.auction_id;

  select id into v_board_id
  from public.ymh_billboards
  where auction_id = v_bid.auction_id
  order by created_at desc
  limit 1;

  if v_board_id is null then
    insert into public.ymh_billboards
      (auction_id, advertiser, headline, image_url, click_url, week_start, week_end, status)
    values (
      v_bid.auction_id,
      v_bid.advertiser,
      nullif(trim(p_headline), ''),
      trim(p_image_url),
      nullif(trim(p_click_url), ''),
      coalesce(v_auction.week_start, now()),
      coalesce(v_auction.week_end, now() + interval '7 days'),
      'approved'
    )
    returning id into v_board_id;
  else
    update public.ymh_billboards
    set image_url = trim(p_image_url),
        headline = nullif(trim(p_headline), ''),
        click_url = nullif(trim(p_click_url), ''),
        advertiser = coalesce(advertiser, v_bid.advertiser),
        status = 'approved'
    where id = v_board_id;
  end if;

  return json_build_object('ok', true, 'billboard_id', v_board_id);
end;
$$;

grant execute on function public.ymh_submit_creative(uuid, text, text, text) to anon, authenticated;
