-- Lets a boarder (horse_owner) edit their own owner record, mirroring the
-- existing owners_select_self_service read policy. The with check stops
-- them reassigning the row to a different user or stable.

create policy "owners_update_self_service"
on public.owners for update
using (user_id = auth.uid())
with check (user_id = auth.uid() and stable_id = auth_stable_id());
