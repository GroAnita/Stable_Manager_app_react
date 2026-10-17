-- Staff roster: lets a stable owner pre-create a staff member's contact
-- info (name/phone/email) and role (Admin/Staff) before they have a
-- login, then send them a personalized invite that links to this record
-- on accept. Mirrors the existing owners + stable_invites(kind='owner')
-- pattern. The original stable creator's own profile is not represented
-- here — this table only covers additional people added later, so there
-- is no "last admin" lockout risk from revoke_staff_access below.

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  stable_id uuid not null references public.stables(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  full_name text not null,
  phone text,
  email text,
  role public.user_role not null default 'stable_employee',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_role_valid check (role in ('stable_owner', 'stable_employee'))
);

create unique index staff_user_id_unique on public.staff (user_id) where user_id is not null;

alter table public.staff enable row level security;

create policy "staff_select_stable"
on public.staff for select
using (
  stable_id = auth_stable_id()
  and auth_role() in ('stable_owner', 'stable_employee')
);

create policy "staff_insert_owner"
on public.staff for insert
with check (
  stable_id = auth_stable_id()
  and auth_role() = 'stable_owner'
);

create policy "staff_update_owner"
on public.staff for update
using (
  stable_id = auth_stable_id()
  and auth_role() = 'stable_owner'
)
with check (
  stable_id = auth_stable_id()
  and auth_role() = 'stable_owner'
);

create policy "staff_delete_owner"
on public.staff for delete
using (
  stable_id = auth_stable_id()
  and auth_role() = 'stable_owner'
);

-- Link invites to a pre-created staff record (same pattern as owner_id).
alter table public.stable_invites
  add column staff_id uuid references public.staff(id) on delete cascade;

alter table public.stable_invites
  add constraint staff_invite_has_staff_id
  check (kind <> 'staff' or staff_id is not null);

create or replace function public.accept_stable_invite(p_token uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_invite public.stable_invites;
  v_staff_role public.user_role;
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
    select role into v_staff_role from public.staff where id = v_invite.staff_id;

    update public.profiles
    set stable_id = v_invite.stable_id,
        role = coalesce(v_staff_role, v_invite.role, 'stable_employee')
    where id = auth.uid();

    if v_invite.staff_id is not null then
      update public.staff
      set user_id = auth.uid(), updated_at = now()
      where id = v_invite.staff_id;
    end if;
  end if;

  update public.stable_invites
  set used_at = now(), used_by = auth.uid()
  where id = v_invite.id;
end;
$$;

create or replace function public.set_staff_role(p_staff_id uuid, p_role public.user_role)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_staff public.staff;
begin
  if auth_role() <> 'stable_owner' then
    raise exception 'Only the stable owner can change staff roles.';
  end if;

  if p_role not in ('stable_owner', 'stable_employee') then
    raise exception 'Invalid role for staff.';
  end if;

  select * into v_staff from public.staff where id = p_staff_id;
  if v_staff is null or v_staff.stable_id <> auth_stable_id() then
    raise exception 'Staff member not found.';
  end if;

  update public.staff set role = p_role, updated_at = now() where id = p_staff_id;

  if v_staff.user_id is not null then
    perform set_config('app.bypass_profile_guard', 'true', true);
    update public.profiles set role = p_role where id = v_staff.user_id;
  end if;
end;
$$;

create or replace function public.revoke_staff_access(p_staff_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_staff public.staff;
begin
  if auth_role() <> 'stable_owner' then
    raise exception 'Only the stable owner can remove staff.';
  end if;

  select * into v_staff from public.staff where id = p_staff_id;
  if v_staff is null or v_staff.stable_id <> auth_stable_id() then
    raise exception 'Staff member not found.';
  end if;

  if v_staff.user_id is not null then
    perform set_config('app.bypass_profile_guard', 'true', true);
    update public.profiles
    set stable_id = null, role = 'stable_owner'
    where id = v_staff.user_id;
  end if;

  delete from public.staff where id = p_staff_id;
end;
$$;
