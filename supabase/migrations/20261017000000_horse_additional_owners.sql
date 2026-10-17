-- Lets a horse have up to 2 additional owners beyond the primary
-- horses.owner_id (e.g. a parent and children sharing care of one horse).
-- Billing/contracts stay keyed on the primary owner; additional owners
-- just get the same read access to the horse's profile, calendar, tasks,
-- vaccinations and feeding info that the primary owner already has.
-- Staff manage the links; access to the feeding rota itself is still a
-- separate, stable-wide opt-in via feeding_rota_participants.

create table public.horse_additional_owners (
  horse_id uuid not null references public.horses(id) on delete cascade,
  owner_id uuid not null references public.owners(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (horse_id, owner_id)
);

alter table public.horse_additional_owners enable row level security;

create or replace function public.enforce_horse_additional_owners()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  v_primary_owner_id uuid;
  v_count integer;
begin
  select owner_id into v_primary_owner_id from public.horses where id = new.horse_id;

  if v_primary_owner_id = new.owner_id then
    raise exception 'This owner already owns the horse.';
  end if;

  select count(*) into v_count
  from public.horse_additional_owners
  where horse_id = new.horse_id;

  if v_count >= 2 then
    raise exception 'A horse can have at most 2 additional owners.';
  end if;

  return new;
end;
$$;

create trigger horse_additional_owners_limit
before insert on public.horse_additional_owners
for each row execute function public.enforce_horse_additional_owners();

create policy "horse_additional_owners_select_staff"
on public.horse_additional_owners for select
using (
  auth_role() in ('stable_owner', 'stable_employee')
  and exists (
    select 1 from public.horses h
    where h.id = horse_additional_owners.horse_id
      and h.stable_id = auth_stable_id()
  )
);

create policy "horse_additional_owners_insert_staff"
on public.horse_additional_owners for insert
with check (
  auth_role() in ('stable_owner', 'stable_employee')
  and exists (
    select 1 from public.horses h
    where h.id = horse_additional_owners.horse_id
      and h.stable_id = auth_stable_id()
  )
  and exists (
    select 1 from public.owners o
    where o.id = horse_additional_owners.owner_id
      and o.stable_id = auth_stable_id()
  )
);

create policy "horse_additional_owners_delete_staff"
on public.horse_additional_owners for delete
using (
  auth_role() in ('stable_owner', 'stable_employee')
  and exists (
    select 1 from public.horses h
    where h.id = horse_additional_owners.horse_id
      and h.stable_id = auth_stable_id()
  )
);

-- Extend the existing self-service read policies so an additional owner
-- sees exactly what the primary owner sees for that horse.

create policy "horses_select_additional_owner"
on public.horses for select
using (
  exists (
    select 1 from public.horse_additional_owners hao
    join public.owners o on o.id = hao.owner_id
    where hao.horse_id = horses.id and o.user_id = auth.uid()
  )
);

create policy "medical_records_select_additional_owner"
on public.medical_records for select
using (
  exists (
    select 1 from public.horse_additional_owners hao
    join public.owners o on o.id = hao.owner_id
    where hao.horse_id = medical_records.horse_id and o.user_id = auth.uid()
  )
);

create policy "vaccinations_select_additional_owner"
on public.vaccinations for select
using (
  exists (
    select 1 from public.horse_additional_owners hao
    join public.owners o on o.id = hao.owner_id
    where hao.horse_id = vaccinations.horse_id and o.user_id = auth.uid()
  )
);

create policy "feeding_plans_select_additional_owner"
on public.feeding_plans for select
using (
  exists (
    select 1 from public.horse_additional_owners hao
    join public.owners o on o.id = hao.owner_id
    where hao.horse_id = feeding_plans.horse_id and o.user_id = auth.uid()
  )
);

create policy "feeding_times_select_additional_owner"
on public.feeding_times for select
using (
  exists (
    select 1 from public.horse_additional_owners hao
    join public.owners o on o.id = hao.owner_id
    where hao.horse_id = feeding_times.horse_id and o.user_id = auth.uid()
  )
);

create policy "tasks_select_additional_owner"
on public.tasks for select
using (
  exists (
    select 1 from public.horse_additional_owners hao
    join public.owners o on o.id = hao.owner_id
    where hao.horse_id = tasks.horse_id and o.user_id = auth.uid()
  )
);

create policy "calendar_events_select_additional_owner"
on public.calendar_events for select
using (
  exists (
    select 1 from public.horse_additional_owners hao
    join public.owners o on o.id = hao.owner_id
    where hao.horse_id = calendar_events.horse_id and o.user_id = auth.uid()
  )
);
