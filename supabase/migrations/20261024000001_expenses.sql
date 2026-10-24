-- Simple expense log so Reports can show real money-out alongside
-- payments received and hay/bedding usage. Mirrors the inventory_items
-- role-check pattern directly: only stable_owner/stable_employee can
-- see or touch financial data, never horse_owner.
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  stable_id uuid not null references public.stables(id) on delete cascade,
  category text,
  amount numeric(10, 2) not null check (amount > 0),
  expense_date date not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index expenses_stable_date_idx on public.expenses (stable_id, expense_date);

alter table public.expenses enable row level security;

create policy "expenses_select_staff"
on public.expenses for select
using (
  stable_id = auth_stable_id()
  and auth_role() in ('stable_owner', 'stable_employee')
);

create policy "expenses_insert_staff"
on public.expenses for insert
with check (
  stable_id = auth_stable_id()
  and auth_role() in ('stable_owner', 'stable_employee')
);

create policy "expenses_update_staff"
on public.expenses for update
using (
  stable_id = auth_stable_id()
  and auth_role() in ('stable_owner', 'stable_employee')
)
with check (
  stable_id = auth_stable_id()
  and auth_role() in ('stable_owner', 'stable_employee')
);

create policy "expenses_delete_staff"
on public.expenses for delete
using (
  stable_id = auth_stable_id()
  and auth_role() in ('stable_owner', 'stable_employee')
);

notify pgrst, 'reload schema';
