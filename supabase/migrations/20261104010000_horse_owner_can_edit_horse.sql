-- Lets a horse owner (primary or additional/co-owner, via auth_owns_horse)
-- edit their own horse's care details — breed, medical notes, allergies,
-- feeding notes, documents, hoof sizes, photo, general notes. Everything
-- administrative or with cross-cutting effects (name, active/away status —
-- away auto-switches billing to the empty-box rate — stall/paddock/
-- turnout_shelter assignment, ownership, school-horse flag, status,
-- arrival date, vaccination status, computed age) stays staff-only: the
-- trigger silently reverts those fields instead of erroring, so a payload
-- that also happens to include them doesn't fail outright.

create policy "horses_update_owner"
on public.horses for update
using (auth_owns_horse(id))
with check (auth_owns_horse(id));

create or replace function public.protect_horse_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.auth_role() = 'horse_owner' then
    new.id := old.id;
    new.name := old.name;
    new.active := old.active;
    new.away := old.away;
    new.stall_id := old.stall_id;
    new.paddock_id := old.paddock_id;
    new.turnout_shelter_id := old.turnout_shelter_id;
    new.owner_id := old.owner_id;
    new.stable_id := old.stable_id;
    new.is_school_horse := old.is_school_horse;
    new.status := old.status;
    new.arrival_date := old.arrival_date;
    new.vaccination_status := old.vaccination_status;
    new.age := old.age;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

create trigger trg_protect_horse_fields
before update on public.horses
for each row execute function public.protect_horse_fields();
