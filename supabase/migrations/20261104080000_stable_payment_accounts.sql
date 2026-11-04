-- Built-in payments: the paid add-on switch and each stable's Stripe connected
-- account. This is a separate table because stable owners can update every
-- column on public.stables. App users can only read it; the add-on is switched
-- on from the Supabase SQL editor, and the stripe-connect Edge Function writes
-- the Stripe fields with the service role.

create table public.stable_payment_accounts (
  stable_id uuid primary key references public.stables (id) on delete cascade,
  addon_enabled boolean not null default false,
  stripe_account_id text unique,
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_stable_payment_accounts_updated_at
before update on public.stable_payment_accounts
for each row execute function set_updated_at();

alter table public.stable_payment_accounts enable row level security;

create policy "stable_payment_accounts_select_owner_role"
on public.stable_payment_accounts for select
using (stable_id = auth_stable_id() and auth_role() = 'stable_owner');

revoke insert, update, delete on public.stable_payment_accounts
from anon, authenticated;
