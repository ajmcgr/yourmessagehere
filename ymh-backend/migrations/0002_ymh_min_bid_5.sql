-- Lower the starting bid to $5 (500 cents)
update public.ymh_settings set value = '500'::jsonb where key = 'starting_bid_cents';
alter table public.ymh_auctions alter column starting_bid_cents set default 500;
update public.ymh_auctions set starting_bid_cents = 500 where status = 'open';
