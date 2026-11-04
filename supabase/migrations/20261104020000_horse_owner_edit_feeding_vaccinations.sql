-- Lets a horse owner (primary or additional/co-owner, via auth_owns_horse)
-- manage their own horse's feeding times and vaccination records, same
-- mechanism as the horses-table edit access added earlier today. Staff
-- keep their existing full access (separate policies, unaffected).
-- Extra-feed logging (which also creates/updates a payment) stays
-- staff-only — not covered here, and deliberately hidden from the owner
-- UI, since owners billing themselves isn't part of this.

create policy "feeding_times_insert_horse_owner"
on public.feeding_times for insert
with check (auth_owns_horse(horse_id));

create policy "feeding_times_update_horse_owner"
on public.feeding_times for update
using (auth_owns_horse(horse_id))
with check (auth_owns_horse(horse_id));

create policy "feeding_times_delete_horse_owner"
on public.feeding_times for delete
using (auth_owns_horse(horse_id));

create policy "vaccinations_insert_horse_owner"
on public.vaccinations for insert
with check (auth_owns_horse(horse_id));

create policy "vaccinations_update_horse_owner"
on public.vaccinations for update
using (auth_owns_horse(horse_id))
with check (auth_owns_horse(horse_id));

create policy "vaccinations_delete_horse_owner"
on public.vaccinations for delete
using (auth_owns_horse(horse_id));
