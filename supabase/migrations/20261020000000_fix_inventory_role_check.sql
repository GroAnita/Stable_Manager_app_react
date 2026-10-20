-- Security fix: inventory_items and inventory_deliveries each had a
-- single ALL policy scoped only by stable_id, with no role check at
-- all — unlike every other business table in the app. Any authenticated
-- member of the stable, including a horse_owner (boarder), could
-- create, edit, or delete inventory records. Verified live before this
-- fix: a real horse_owner account inserted a row and then deleted every
-- inventory_items row for the stable.
--
-- The frontend shows the same edit/delete controls to stable_owner and
-- stable_employee alike with no distinction (Inventory.tsx has no role
-- gating at all — the page is simply unreachable in the nav for
-- horse_owner), so the fix keeps that intent: any staff member can
-- fully manage inventory, no one else can touch it at all.
-- inventory_deliveries has no updated_at and the app never edits a
-- delivery after logging it, so it gets no UPDATE policy, matching how
-- the frontend actually uses it.

drop policy "stable members manage their inventory items" on public.inventory_items;

create policy "inventory_items_select_staff"
on public.inventory_items for select
using (
  stable_id = auth_stable_id()
  and auth_role() in ('stable_owner', 'stable_employee')
);

create policy "inventory_items_insert_staff"
on public.inventory_items for insert
with check (
  stable_id = auth_stable_id()
  and auth_role() in ('stable_owner', 'stable_employee')
);

create policy "inventory_items_update_staff"
on public.inventory_items for update
using (
  stable_id = auth_stable_id()
  and auth_role() in ('stable_owner', 'stable_employee')
)
with check (
  stable_id = auth_stable_id()
  and auth_role() in ('stable_owner', 'stable_employee')
);

create policy "inventory_items_delete_staff"
on public.inventory_items for delete
using (
  stable_id = auth_stable_id()
  and auth_role() in ('stable_owner', 'stable_employee')
);

drop policy "stable members manage their inventory deliveries" on public.inventory_deliveries;

create policy "inventory_deliveries_select_staff"
on public.inventory_deliveries for select
using (
  stable_id = auth_stable_id()
  and auth_role() in ('stable_owner', 'stable_employee')
);

create policy "inventory_deliveries_insert_staff"
on public.inventory_deliveries for insert
with check (
  stable_id = auth_stable_id()
  and auth_role() in ('stable_owner', 'stable_employee')
);

create policy "inventory_deliveries_delete_staff"
on public.inventory_deliveries for delete
using (
  stable_id = auth_stable_id()
  and auth_role() in ('stable_owner', 'stable_employee')
);
