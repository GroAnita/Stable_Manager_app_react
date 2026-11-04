-- Widens what a horse owner can edit on their own horse to match staff's
-- own edit form almost field-for-field: adds stall/turnout_shelter
-- assignment, arrival date, and active/away status (away auto-switches
-- billing to the empty-box rate — a deliberate choice, not an oversight).
-- Still locked: id, name, owner_id, paddock_id, stable_id, is_school_horse,
-- status, vaccination_status, age, created_at — plus granting additional-
-- owner access stays a separate, staff-only feature untouched by this.
create or replace function public.protect_horse_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.auth_role() = 'horse_owner' then
    new.id := old.id;
    new.name := old.name;
    new.owner_id := old.owner_id;
    new.paddock_id := old.paddock_id;
    new.stable_id := old.stable_id;
    new.is_school_horse := old.is_school_horse;
    new.status := old.status;
    new.vaccination_status := old.vaccination_status;
    new.age := old.age;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;
