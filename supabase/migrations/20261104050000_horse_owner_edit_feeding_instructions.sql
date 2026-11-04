-- Lets a horse owner save feeding instructions on their own horse.
-- Extra-feed logging lives in feeding_plans.extras and is tied to payments,
-- so the trigger keeps that column staff-only.

create policy "feeding_plans_insert_horse_owner"
on public.feeding_plans for insert
with check (auth_owns_horse(horse_id));

create policy "feeding_plans_update_horse_owner"
on public.feeding_plans for update
using (auth_owns_horse(horse_id))
with check (auth_owns_horse(horse_id));

create or replace function public.protect_feeding_plan_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.auth_role() = 'horse_owner' then
    if tg_op = 'INSERT' then
      new.extras := null;
      select h.stable_id into new.stable_id
      from public.horses h where h.id = new.horse_id;
    else
      new.id := old.id;
      new.horse_id := old.horse_id;
      new.stable_id := old.stable_id;
      new.extras := old.extras;
      new.created_at := old.created_at;
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_protect_feeding_plan_fields
before insert or update on public.feeding_plans
for each row execute function public.protect_feeding_plan_fields();
