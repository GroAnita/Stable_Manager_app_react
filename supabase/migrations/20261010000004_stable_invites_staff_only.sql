-- The old policy let ANY stable member (including horse_owner) read,
-- create, or delete invites for their stable, with no role check. That
-- let a boarder read other members' pending tokens, or mint themselves a
-- staff invite and self-accept it. Invite acceptance itself still works
-- for everyone, since accept_stable_invite() is security definer and
-- doesn't rely on the caller having table-level access.

drop policy "stable members manage their own invites" on public.stable_invites;

create policy "stable_invites_manage_staff"
on public.stable_invites for all
using (
  stable_id = auth_stable_id()
  and auth_role() = any (array['stable_owner', 'stable_employee']::user_role[])
)
with check (
  stable_id = auth_stable_id()
  and auth_role() = any (array['stable_owner', 'stable_employee']::user_role[])
);
