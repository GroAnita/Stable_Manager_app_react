-- Subscription tier pricing/ranges as data, not hardcoded in the app, so
-- they can be edited directly in the Supabase Table Editor without a code
-- change or deploy. Adding a brand new tier still needs a migration (the
-- key is the existing stable_plan enum), but editing an existing tier's
-- name, horse range or price is fully self-serve.

create table public.subscription_plans (
  key public.stable_plan primary key,
  name text not null,
  horse_min integer not null,
  horse_max integer,
  price_nok integer not null,
  sort_order integer not null,
  updated_at timestamptz not null default now()
);

create trigger trg_subscription_plans_updated_at
before update on public.subscription_plans
for each row execute function set_updated_at();

alter table public.subscription_plans enable row level security;

create policy "subscription_plans_select_authenticated"
on public.subscription_plans for select
to authenticated
using (true);

insert into public.subscription_plans (key, name, horse_min, horse_max, price_nok, sort_order) values
  ('small', 'Liten', 1, 10, 299, 1),
  ('medium', 'Mellomstor', 11, 20, 599, 2),
  ('large', 'Stor', 21, 30, 899, 3),
  ('xlarge', 'Ekstra stor', 31, null, 1199, 4);
