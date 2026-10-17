-- Fixes "infinite recursion detected in policy for relation horses"
-- (broke dashboard_stats and other views for every stable_owner/employee).
--
-- horses_select_additional_owner (added in the prior migration) queries
-- horse_additional_owners. That table's own staff policies queried back
-- into horses to check stable scoping, so evaluating horses' RLS could
-- re-trigger horses' RLS: horses -> horse_additional_owners -> horses -> ...
--
-- Fix: scope horse_additional_owners's staff policies off a SECURITY
-- DEFINER helper that reads horses.stable_id directly (same bypass-RLS
-- pattern as auth_stable_id()/auth_role() on profiles), so evaluating
-- them never re-enters horses' own RLS.

create or replace function public.horse_stable_id(p_horse_id uuid)
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select stable_id from public.horses where id = p_horse_id;
$$;

drop policy "horse_additional_owners_select_staff" on public.horse_additional_owners;
drop policy "horse_additional_owners_insert_staff" on public.horse_additional_owners;
drop policy "horse_additional_owners_delete_staff" on public.horse_additional_owners;

create policy "horse_additional_owners_select_staff"
on public.horse_additional_owners for select
using (
  auth_role() in ('stable_owner', 'stable_employee')
  and public.horse_stable_id(horse_additional_owners.horse_id) = auth_stable_id()
);

create policy "horse_additional_owners_insert_staff"
on public.horse_additional_owners for insert
with check (
  auth_role() in ('stable_owner', 'stable_employee')
  and public.horse_stable_id(horse_additional_owners.horse_id) = auth_stable_id()
  and exists (
    select 1 from public.owners o
    where o.id = horse_additional_owners.owner_id
      and o.stable_id = auth_stable_id()
  )
);

create policy "horse_additional_owners_delete_staff"
on public.horse_additional_owners for delete
using (
  auth_role() in ('stable_owner', 'stable_employee')
  and public.horse_stable_id(horse_additional_owners.horse_id) = auth_stable_id()
);
