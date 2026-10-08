-- Daily usage rate is no longer a static number: it's computed from
-- active contracts' hay/bedding allocations plus logged feeding extras.
-- Tracking an item now just means linking it to a price list item (for
-- name/unit/matching against contracts and extras) and a low-stock
-- threshold. No data exists yet, so recreate rather than migrate in place.

drop table if exists public.inventory_deliveries;
drop table if exists public.inventory_items;

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  stable_id uuid not null references public.stables(id) on delete cascade,
  price_list_item_id uuid not null references public.price_list_items(id) on delete cascade,
  low_stock_days_threshold numeric not null default 7,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (stable_id, price_list_item_id)
);

create table public.inventory_deliveries (
  id uuid primary key default gen_random_uuid(),
  stable_id uuid not null references public.stables(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  quantity numeric not null,
  delivered_on date not null,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.inventory_items enable row level security;
alter table public.inventory_deliveries enable row level security;

create policy "stable members manage their inventory items"
on public.inventory_items for all
using (stable_id = (select stable_id from public.profiles where id = auth.uid()))
with check (stable_id = (select stable_id from public.profiles where id = auth.uid()));

create policy "stable members manage their inventory deliveries"
on public.inventory_deliveries for all
using (stable_id = (select stable_id from public.profiles where id = auth.uid()))
with check (stable_id = (select stable_id from public.profiles where id = auth.uid()));
