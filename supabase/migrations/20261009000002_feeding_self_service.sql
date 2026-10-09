-- Matches the existing self-service read pattern (medical_records, tasks):
-- a horse_owner can read their own horse's feeding plan and times, which
-- was missing entirely - only staff could read these before.

create policy "feeding_plans_select_self_service"
on public.feeding_plans for select
using (
  exists (
    select 1 from public.horses h
    join public.owners o on o.id = h.owner_id
    where h.id = feeding_plans.horse_id and o.user_id = auth.uid()
  )
);

create policy "feeding_times_select_self_service"
on public.feeding_times for select
using (
  exists (
    select 1 from public.horses h
    join public.owners o on o.id = h.owner_id
    where h.id = feeding_times.horse_id and o.user_id = auth.uid()
  )
);
