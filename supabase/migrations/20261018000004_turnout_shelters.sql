-- "Utegang" (24/7 turnout): horses that live outdoors full-time with
-- shelter access, instead of a stall. Lives on the Stalls page as a
-- second section. Mirrors paddocks exactly (many horses can share one
-- shelter), but is tracked separately from both stalls and paddocks
-- since it's a distinct, alternative home-housing arrangement rather
-- than daytime turnout.

create table public.turnout_shelters (
  id uuid primary key default gen_random_uuid(),
  stable_id uuid not null references public.stables(id) on delete cascade,
  name text not null,
  size text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_turnout_shelters_updated_at
before update on public.turnout_shelters
for each row execute function set_updated_at();

alter table public.turnout_shelters enable row level security;

create policy "turnout_shelters_select_stable"
on public.turnout_shelters for select
using (stable_id = auth_stable_id());

create policy "turnout_shelters_insert_staff"
on public.turnout_shelters for insert
with check (
  stable_id = auth_stable_id()
  and auth_role() in ('stable_owner', 'stable_employee')
);

create policy "turnout_shelters_update_staff"
on public.turnout_shelters for update
using (
  stable_id = auth_stable_id()
  and auth_role() in ('stable_owner', 'stable_employee')
)
with check (
  stable_id = auth_stable_id()
  and auth_role() in ('stable_owner', 'stable_employee')
);

create policy "turnout_shelters_delete_owner_role"
on public.turnout_shelters for delete
using (
  stable_id = auth_stable_id()
  and auth_role() = 'stable_owner'
);

alter table public.horses
  add column turnout_shelter_id uuid references public.turnout_shelters(id) on delete set null;
