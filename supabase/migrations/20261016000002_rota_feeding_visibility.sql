-- An owner doing feeding duty needs to see every relevant horse's feeding
-- plan, not just their own horse's. Being an active rotation participant
-- unlocks read access to all horses (and their feeding plan/times) in
-- their own stable — sidesteps having to special-case "all horses" vs. a
-- specific selection per shift type, since either way a participant needs
-- the full picture to actually do the feeding.

create policy "horses_select_rota_participants"
on public.horses for select
using (
  stable_id = auth_stable_id()
  and exists (
    select 1 from public.feeding_rota_participants fp
    join public.owners o on o.user_id = auth.uid()
    where fp.owner_id = o.id
      and fp.stable_id = horses.stable_id
      and fp.active = true
  )
);

create policy "feeding_plans_select_rota_participants"
on public.feeding_plans for select
using (
  exists (
    select 1 from public.feeding_rota_participants fp
    join public.owners o on o.user_id = auth.uid()
    where fp.owner_id = o.id
      and fp.stable_id = feeding_plans.stable_id
      and fp.active = true
  )
);

create policy "feeding_times_select_rota_participants"
on public.feeding_times for select
using (
  exists (
    select 1 from public.feeding_rota_participants fp
    join public.owners o on o.user_id = auth.uid()
    where fp.owner_id = o.id
      and fp.stable_id = feeding_times.stable_id
      and fp.active = true
  )
);
