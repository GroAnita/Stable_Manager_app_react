-- Lets a horse owner (primary or additional/co-owner, via auth_owns_horse)
-- manage calendar events tied to their own horse — e.g. vet/farrier
-- appointments they book themselves — same mechanism as the feeding
-- times and vaccinations access added earlier today. These are the same
-- calendar_events rows the stable-wide calendar reads, so anything an
-- owner adds here shows up there too. Staff keep their existing full
-- access (separate policies, unaffected); events with no horse_id
-- (stable-wide events) are untouched since auth_owns_horse(null) is
-- never true.

create policy "calendar_events_select_horse_owner"
on public.calendar_events for select
using (auth_owns_horse(horse_id));

create policy "calendar_events_insert_horse_owner"
on public.calendar_events for insert
with check (auth_owns_horse(horse_id));

create policy "calendar_events_update_horse_owner"
on public.calendar_events for update
using (auth_owns_horse(horse_id))
with check (auth_owns_horse(horse_id));

create policy "calendar_events_delete_horse_owner"
on public.calendar_events for delete
using (auth_owns_horse(horse_id));
