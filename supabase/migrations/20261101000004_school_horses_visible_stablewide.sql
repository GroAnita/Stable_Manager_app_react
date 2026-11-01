-- Owners need to see which horses are tagged as school horses to pick
-- one when booking a lesson, but the existing horses RLS only lets an
-- owner see their own (or a rota-participant's) horses. School horses
-- belong to the stable, not to any owner, so make them visible to any
-- authenticated member of the stable.
create policy "horses_select_school_horses"
on public.horses for select
using (stable_id = auth_stable_id() and is_school_horse = true);
