-- Boarders need to read price list items referenced by their own contract
-- (hay/bedding/boarding) so the contract total they see matches staff's.

create policy "price_list_items_select_self_service"
on public.price_list_items for select
using (
  stable_id = auth_stable_id()
  and auth_role() = 'horse_owner'::user_role
);
