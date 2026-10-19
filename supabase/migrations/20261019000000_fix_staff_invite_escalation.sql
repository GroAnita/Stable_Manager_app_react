-- Security fix: stable_invites_manage_staff let ANY stable_employee
-- create/read/update/delete ANY invite row, with no check on `kind`.
-- Combined with accept_stable_invite() granting the role straight from
-- the staff row the invite's staff_id points to, and staff_select_stable
-- letting employees see every staff row (including Admin/stable_owner
-- ones), a plain employee could create a kind='staff' invite pointing at
-- an existing Admin staff row, hand the token to anyone, and that person
-- would become a full stable_owner on accept. Verified live before this
-- fix: an employee account successfully minted such a token.
--
-- Fix: split the single policy by kind. Owner-kind invites (inviting a
-- horse owner) keep the existing, non-sensitive behavior — any staff
-- member can manage those. Staff-kind invites (which can grant admin
-- access) are now owner-only for every operation, and creating one
-- additionally requires the target staff_id to belong to the caller's
-- own stable and not already be linked to a user.

drop policy "stable_invites_manage_staff" on public.stable_invites;

create policy "stable_invites_manage_owner_invites"
on public.stable_invites for all
using (
  kind = 'owner'
  and stable_id = auth_stable_id()
  and auth_role() in ('stable_owner', 'stable_employee')
)
with check (
  kind = 'owner'
  and stable_id = auth_stable_id()
  and auth_role() in ('stable_owner', 'stable_employee')
);

create policy "stable_invites_manage_staff_invites"
on public.stable_invites for all
using (
  kind = 'staff'
  and stable_id = auth_stable_id()
  and auth_role() = 'stable_owner'
)
with check (
  kind = 'staff'
  and stable_id = auth_stable_id()
  and auth_role() = 'stable_owner'
  and exists (
    select 1 from public.staff s
    where s.id = stable_invites.staff_id
      and s.stable_id = auth_stable_id()
      and s.user_id is null
  )
);
