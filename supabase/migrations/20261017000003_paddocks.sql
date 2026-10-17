-- Paddocks: outdoor turnout areas, separate from indoor stalls. A horse
-- can be assigned to one paddock at a time via horses.paddock_id, and
-- (unlike stalls) many horses can share the same paddock. Mirrors the
-- existing stalls table/RLS shape exactly.

create table public.paddocks (
  id uuid primary key default gen_random_uuid(),
  stable_id uuid not null references public.stables(id) on delete cascade,
  name text not null,
  size text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_paddocks_updated_at
before update on public.paddocks
for each row execute function set_updated_at();

alter table public.paddocks enable row level security;

create policy "paddocks_select_stable"
on public.paddocks for select
using (stable_id = auth_stable_id());

create policy "paddocks_insert_staff"
on public.paddocks for insert
with check (
  stable_id = auth_stable_id()
  and auth_role() in ('stable_owner', 'stable_employee')
);

create policy "paddocks_update_staff"
on public.paddocks for update
using (
  stable_id = auth_stable_id()
  and auth_role() in ('stable_owner', 'stable_employee')
)
with check (
  stable_id = auth_stable_id()
  and auth_role() in ('stable_owner', 'stable_employee')
);

create policy "paddocks_delete_owner_role"
on public.paddocks for delete
using (
  stable_id = auth_stable_id()
  and auth_role() = 'stable_owner'
);

alter table public.horses
  add column paddock_id uuid references public.paddocks(id) on delete set null;
