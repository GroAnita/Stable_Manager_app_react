-- Tracks when recurring fire-safety checks (extinguishers, fire alarm,
-- electrical install, escape routes, fire drill) were last done, one row
-- per stable per check type (upsert on recheck — this is a "when was it
-- last done" tracker, not a full audit log). Staff-only, matching the
-- inventory/expenses role-check pattern — this is compliance-sensitive
-- data, not something a boarder should read or touch.
create table public.fire_safety_checks (
  id uuid primary key default gen_random_uuid(),
  stable_id uuid not null references public.stables(id) on delete cascade,
  check_type text not null,
  last_checked_date date not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (stable_id, check_type)
);

alter table public.fire_safety_checks enable row level security;

create policy "fire_safety_checks_select_staff"
on public.fire_safety_checks for select
using (
  stable_id = auth_stable_id()
  and auth_role() in ('stable_owner', 'stable_employee')
);

create policy "fire_safety_checks_insert_staff"
on public.fire_safety_checks for insert
with check (
  stable_id = auth_stable_id()
  and auth_role() in ('stable_owner', 'stable_employee')
);

create policy "fire_safety_checks_update_staff"
on public.fire_safety_checks for update
using (
  stable_id = auth_stable_id()
  and auth_role() in ('stable_owner', 'stable_employee')
)
with check (
  stable_id = auth_stable_id()
  and auth_role() in ('stable_owner', 'stable_employee')
);

notify pgrst, 'reload schema';
