-- Structured vaccination log per horse: the 3-dose "grunnvaksine" primary
-- series (A, then B 21-60 days later, then C within 6 months + 21 days of
-- B), followed by indefinite yearly boosters. Validity/due-date logic lives
-- in the frontend (src/lib/vaccinations.ts) and is computed from these rows.

create table public.vaccinations (
  id uuid primary key default gen_random_uuid(),
  horse_id uuid not null references public.horses(id) on delete cascade,
  stable_id uuid not null references public.stables(id) on delete cascade,
  dose text not null check (dose in ('A', 'B', 'C', 'annual')),
  date date not null,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index vaccinations_horse_id_date_idx
on public.vaccinations (horse_id, date desc);

alter table public.vaccinations enable row level security;

create policy "vaccinations_select_stable"
on public.vaccinations for select
using (
  stable_id = auth_stable_id()
  and auth_role() = any (array['stable_owner', 'stable_employee']::user_role[])
);

create policy "vaccinations_select_self_service"
on public.vaccinations for select
using (
  exists (
    select 1 from public.horses h
    join public.owners o on o.id = h.owner_id
    where h.id = vaccinations.horse_id and o.user_id = auth.uid()
  )
);

create policy "vaccinations_insert_staff"
on public.vaccinations for insert
with check (
  stable_id = auth_stable_id()
  and auth_role() = any (array['stable_owner', 'stable_employee']::user_role[])
);

create policy "vaccinations_update_staff"
on public.vaccinations for update
using (
  stable_id = auth_stable_id()
  and auth_role() = any (array['stable_owner', 'stable_employee']::user_role[])
)
with check (
  stable_id = auth_stable_id()
  and auth_role() = any (array['stable_owner', 'stable_employee']::user_role[])
);

create policy "vaccinations_delete_owner_role"
on public.vaccinations for delete
using (
  stable_id = auth_stable_id()
  and auth_role() = 'stable_owner'::user_role
);
