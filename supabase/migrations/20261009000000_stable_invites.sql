-- Lets a stable owner invite a boarder (linking an existing owners row to
-- a real login) or a staff member (granting stable_employee access) via a
-- shareable token link. Acceptance runs as the invited user themselves,
-- via a SECURITY DEFINER function, matching the existing create_stable /
-- link_horse_owner_account / assign_staff_role pattern (bypassing
-- protect_profile_fields the same way they do).

create table public.stable_invites (
  id uuid primary key default gen_random_uuid(),
  token uuid not null default gen_random_uuid() unique,
  stable_id uuid not null references public.stables(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('owner', 'staff')),
  owner_id uuid references public.owners(id) on delete cascade,
  role public.user_role,
  used_at timestamptz,
  used_by uuid references public.profiles(id),
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now(),
  constraint owner_invite_has_owner_id
    check (kind <> 'owner' or owner_id is not null)
);

alter table public.stable_invites enable row level security;

create policy "stable members manage their own invites"
on public.stable_invites for all
using (stable_id = (select stable_id from public.profiles where id = auth.uid()))
with check (stable_id = (select stable_id from public.profiles where id = auth.uid()));

create or replace function public.accept_stable_invite(p_token uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_invite public.stable_invites;
begin
  select * into v_invite from public.stable_invites
  where token = p_token
    and used_at is null
    and expires_at > now();

  if v_invite is null then
    raise exception 'This invite link is invalid or has expired.';
  end if;

  perform set_config('app.bypass_profile_guard', 'true', true);

  if v_invite.kind = 'owner' then
    update public.profiles
    set stable_id = v_invite.stable_id, role = 'horse_owner'
    where id = auth.uid();

    update public.owners
    set user_id = auth.uid()
    where id = v_invite.owner_id;
  else
    update public.profiles
    set stable_id = v_invite.stable_id, role = coalesce(v_invite.role, 'stable_employee')
    where id = auth.uid();
  end if;

  update public.stable_invites
  set used_at = now(), used_by = auth.uid()
  where id = v_invite.id;
end;
$$;
