-- A horse_owner could previously only read their own owners row, so other
-- rotation participants' names came back blank anywhere the feeding rota
-- needs to show them (swap target picker, calendar assignments, swap
-- requests). Let any stable member see the owner record of anyone who is
-- an active rota participant in the same stable — scoped to that overlap,
-- not a blanket "see every owner" grant.

create policy "owners_select_rota_participants"
on public.owners for select
using (
  exists (
    select 1 from public.feeding_rota_participants fp
    where fp.owner_id = owners.id
      and fp.stable_id = auth_stable_id()
      and fp.active = true
  )
);
