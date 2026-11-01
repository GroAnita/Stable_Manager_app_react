-- First optional module built on top of the stable_type / enabled_features
-- plumbing (20261101000000_stable_feature_flags.sql): riding-school lesson
-- slots that owners book a horse into. Gated in the app behind the
-- 'lesson_booking' feature key — invisible unless a stable has it enabled.

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  stable_id uuid not null references public.stables(id) on delete cascade,
  title text not null,
  instructor_name text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer not null default 1 check (capacity > 0),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lessons_ends_after_starts check (ends_at > starts_at)
);

create trigger trg_lessons_updated_at
before update on public.lessons
for each row execute function set_updated_at();

alter table public.lessons enable row level security;

create policy "lessons_select_stable"
on public.lessons for select
using (stable_id = auth_stable_id());

create policy "lessons_insert_staff"
on public.lessons for insert
with check (
  stable_id = auth_stable_id()
  and auth_role() in ('stable_owner', 'stable_employee')
);

create policy "lessons_update_staff"
on public.lessons for update
using (
  stable_id = auth_stable_id()
  and auth_role() in ('stable_owner', 'stable_employee')
)
with check (
  stable_id = auth_stable_id()
  and auth_role() in ('stable_owner', 'stable_employee')
);

create policy "lessons_delete_staff"
on public.lessons for delete
using (
  stable_id = auth_stable_id()
  and auth_role() in ('stable_owner', 'stable_employee')
);

grant select, insert, update, delete on public.lessons to authenticated;

-- A horse owner booking a lesson for a horse they don't own would be a
-- real security hole, and this check (primary owner or shared
-- additional owner) is needed in two separate RLS policies below, so
-- it's a helper function rather than copy-pasted — mirrors the existing
-- auth_role()/auth_stable_id() helper pattern.
create or replace function public.auth_owns_horse(p_horse_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.horses h
    join public.owners o on o.id = h.owner_id
    where h.id = p_horse_id and o.user_id = auth.uid()
  )
  or exists (
    select 1 from public.horse_additional_owners hao
    join public.owners o on o.id = hao.owner_id
    where hao.horse_id = p_horse_id and o.user_id = auth.uid()
  );
$$;

revoke execute on function public.auth_owns_horse(uuid) from public, anon;

create table public.lesson_bookings (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  owner_id uuid not null references public.owners(id) on delete cascade,
  horse_id uuid not null references public.horses(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (lesson_id, horse_id)
);

alter table public.lesson_bookings enable row level security;

create policy "lesson_bookings_select_self_or_staff"
on public.lesson_bookings for select
using (
  exists (
    select 1 from public.owners o
    where o.id = lesson_bookings.owner_id and o.user_id = auth.uid()
  )
  or exists (
    select 1 from public.lessons l
    where l.id = lesson_bookings.lesson_id
      and l.stable_id = auth_stable_id()
      and auth_role() in ('stable_owner', 'stable_employee')
  )
);

create policy "lesson_bookings_insert_self_or_staff"
on public.lesson_bookings for insert
with check (
  (
    exists (
      select 1 from public.owners o
      where o.id = lesson_bookings.owner_id and o.user_id = auth.uid()
    )
    and auth_owns_horse(horse_id)
    and exists (
      select 1 from public.lessons l
      where l.id = lesson_bookings.lesson_id and l.stable_id = auth_stable_id()
    )
  )
  or (
    auth_role() in ('stable_owner', 'stable_employee')
    and exists (
      select 1 from public.lessons l
      where l.id = lesson_bookings.lesson_id and l.stable_id = auth_stable_id()
    )
  )
);

create policy "lesson_bookings_delete_self_or_staff"
on public.lesson_bookings for delete
using (
  exists (
    select 1 from public.owners o
    where o.id = lesson_bookings.owner_id and o.user_id = auth.uid()
  )
  or exists (
    select 1 from public.lessons l
    where l.id = lesson_bookings.lesson_id
      and l.stable_id = auth_stable_id()
      and auth_role() in ('stable_owner', 'stable_employee')
  )
);

grant select, insert, delete on public.lesson_bookings to authenticated;

-- Capacity has to be enforced here rather than just in the app: locking
-- the lesson row serializes concurrent bookings so two owners racing for
-- the last spot can't both succeed.
create or replace function public.enforce_lesson_capacity()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_capacity integer;
  v_count integer;
begin
  select capacity into v_capacity from public.lessons where id = new.lesson_id for update;
  if v_capacity is null then
    raise exception 'Lesson not found';
  end if;

  select count(*) into v_count from public.lesson_bookings where lesson_id = new.lesson_id;

  if v_count >= v_capacity then
    raise exception 'This lesson is fully booked.';
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_lesson_capacity() from public, anon, authenticated;

create trigger trg_lesson_bookings_capacity
before insert on public.lesson_bookings
for each row execute function public.enforce_lesson_capacity();

notify pgrst, 'reload schema';
