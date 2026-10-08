-- Tracks stock levels for consumables (e.g. hay): items with a known daily
-- usage rate, plus a ledger of deliveries. Current stock and days-remaining
-- are computed client-side from these rows rather than stored, since the
-- usage rate is a simple user-set estimate rather than a true event log.

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  stable_id uuid not null references public.stables(id) on delete cascade,
  name text not null,
  unit text not null default 'kg',
  daily_usage_rate numeric not null default 0,
  low_stock_days_threshold numeric not null default 7,
  price_list_item_id uuid references public.price_list_items(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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
