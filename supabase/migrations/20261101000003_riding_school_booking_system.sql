-- Riding-school booking system: term enrolment + drop-in booking sharing
-- one capacity/roster per session. Builds on 20261101000001_lessons.sql,
-- which only supported single ad-hoc lessons. Renames that table to
-- lesson_sessions and layers courses/enrolments/riders on top, rather
-- than building a second, parallel booking system.
--
-- Payments/credits and automated cancellation-policy rules (makeup
-- credits, late-cancellation handling) are intentionally NOT part of
-- this migration — cancelling just frees the seat. That's a separate
-- subsystem for a later pass.

-- ---------------------------------------------------------------------
-- Riders: family members a parent/owner books lessons for. Mirrors how
-- horses already belong to an owner. A booking with no rider_id means
-- the owner is riding themselves, so this stays optional, not a new
-- mandatory step for every existing single-adult account.
create table public.riders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete cascade,
  full_name text not null,
  birthday date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_riders_updated_at
before update on public.riders
for each row execute function set_updated_at();

alter table public.riders enable row level security;

create policy "riders_select_self_or_staff"
on public.riders for select
using (
  exists (select 1 from public.owners o where o.id = riders.owner_id and o.user_id = auth.uid())
  or exists (
    select 1 from public.owners o
    where o.id = riders.owner_id and o.stable_id = auth_stable_id()
      and auth_role() in ('stable_owner', 'stable_employee')
  )
);

create policy "riders_insert_self_or_staff"
on public.riders for insert
with check (
  exists (select 1 from public.owners o where o.id = riders.owner_id and o.user_id = auth.uid())
  or exists (
    select 1 from public.owners o
    where o.id = riders.owner_id and o.stable_id = auth_stable_id()
      and auth_role() in ('stable_owner', 'stable_employee')
  )
);

create policy "riders_update_self_or_staff"
on public.riders for update
using (
  exists (select 1 from public.owners o where o.id = riders.owner_id and o.user_id = auth.uid())
  or exists (
    select 1 from public.owners o
    where o.id = riders.owner_id and o.stable_id = auth_stable_id()
      and auth_role() in ('stable_owner', 'stable_employee')
  )
)
with check (
  exists (select 1 from public.owners o where o.id = riders.owner_id and o.user_id = auth.uid())
  or exists (
    select 1 from public.owners o
    where o.id = riders.owner_id and o.stable_id = auth_stable_id()
      and auth_role() in ('stable_owner', 'stable_employee')
  )
);

create policy "riders_delete_self_or_staff"
on public.riders for delete
using (
  exists (select 1 from public.owners o where o.id = riders.owner_id and o.user_id = auth.uid())
  or exists (
    select 1 from public.owners o
    where o.id = riders.owner_id and o.stable_id = auth_stable_id()
      and auth_role() in ('stable_owner', 'stable_employee')
  )
);

grant select, insert, update, delete on public.riders to authenticated;

-- ---------------------------------------------------------------------
-- Courses: a recurring term group. Sessions get generated from this
-- (weekday + time + term dates); the course itself is never deleted
-- once sessions exist, only cancelled.
create type public.course_booking_mode as enum ('term_only', 'dropin_only', 'mixed');
create type public.course_status as enum ('draft', 'active', 'completed', 'cancelled');

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  stable_id uuid not null references public.stables(id) on delete cascade,
  title text not null,
  level text,
  instructor_name text,
  location text,
  capacity integer not null default 1 check (capacity > 0),
  price numeric(10, 2),
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  term_start_date date not null,
  term_end_date date not null,
  booking_mode public.course_booking_mode not null default 'mixed',
  spare_release_days_before integer not null default 7 check (spare_release_days_before >= 0),
  status public.course_status not null default 'active',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint courses_term_dates_valid check (term_end_date >= term_start_date),
  constraint courses_time_valid check (end_time > start_time)
);

create trigger trg_courses_updated_at
before update on public.courses
for each row execute function set_updated_at();

alter table public.courses enable row level security;

create policy "courses_select_stable"
on public.courses for select
using (stable_id = auth_stable_id());

create policy "courses_insert_staff"
on public.courses for insert
with check (
  stable_id = auth_stable_id() and auth_role() in ('stable_owner', 'stable_employee')
);

create policy "courses_update_staff"
on public.courses for update
using (
  stable_id = auth_stable_id() and auth_role() in ('stable_owner', 'stable_employee')
)
with check (
  stable_id = auth_stable_id() and auth_role() in ('stable_owner', 'stable_employee')
);

grant select, insert, update on public.courses to authenticated;

-- ---------------------------------------------------------------------
-- lessons -> lesson_sessions: a single ad-hoc lesson is now also what a
-- course's term generates one instance of per date. course_id is null
-- for a standalone/ad-hoc session.
alter table public.lessons rename to lesson_sessions;

alter table public.lesson_sessions
  add column course_id uuid references public.courses(id) on delete cascade,
  add column status text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
  add constraint lesson_sessions_course_starts_at_unique unique (course_id, starts_at);

-- ---------------------------------------------------------------------
-- Enrolments: a rider's place in a course. Generates a lesson_booking
-- for every remaining session when created (see enrol_in_course below).
create table public.enrolments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  rider_id uuid references public.riders(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'withdrawn')),
  enrolled_at timestamptz not null default now(),
  withdrawn_at timestamptz
);

alter table public.enrolments enable row level security;

-- Writes only via enrol_in_course()/withdraw_from_course() below, so
-- authenticated gets select only; the functions run as their owner and
-- bypass this. The select policy itself is added further down, once
-- lesson_bookings has the enrolment_id column it references.
grant select on public.enrolments to authenticated;

-- ---------------------------------------------------------------------
-- lesson_bookings: extend with who's actually riding (rider_id, may be
-- null = the owner themselves), which enrolment generated it (if any),
-- and a status so cancelling preserves history instead of deleting it.
alter table public.lesson_bookings rename column lesson_id to session_id;

alter table public.lesson_bookings
  add column rider_id uuid references public.riders(id) on delete set null,
  add column enrolment_id uuid references public.enrolments(id) on delete set null,
  add column status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  add column cancelled_at timestamptz,
  alter column horse_id drop not null;

-- All booking creation now goes through enrol_in_course()/
-- book_dropin_session() so the term-vs-drop-in timing and horse
-- eligibility rules live in one place instead of being duplicated
-- between an RLS policy and the client.
drop policy if exists "lesson_bookings_insert_self_or_staff" on public.lesson_bookings;
drop policy if exists "lesson_bookings_select_self_or_staff" on public.lesson_bookings;
drop policy if exists "lesson_bookings_delete_self_or_staff" on public.lesson_bookings;

create policy "lesson_bookings_select_self_or_staff"
on public.lesson_bookings for select
using (
  exists (select 1 from public.owners o where o.id = lesson_bookings.owner_id and o.user_id = auth.uid())
  or exists (
    select 1 from public.lesson_sessions s
    where s.id = lesson_bookings.session_id and s.stable_id = auth_stable_id()
      and auth_role() in ('stable_owner', 'stable_employee')
  )
);

create policy "lesson_bookings_update_self_or_staff"
on public.lesson_bookings for update
using (
  exists (select 1 from public.owners o where o.id = lesson_bookings.owner_id and o.user_id = auth.uid())
  or exists (
    select 1 from public.lesson_sessions s
    where s.id = lesson_bookings.session_id and s.stable_id = auth_stable_id()
      and auth_role() in ('stable_owner', 'stable_employee')
  )
)
with check (
  exists (select 1 from public.owners o where o.id = lesson_bookings.owner_id and o.user_id = auth.uid())
  or exists (
    select 1 from public.lesson_sessions s
    where s.id = lesson_bookings.session_id and s.stable_id = auth_stable_id()
      and auth_role() in ('stable_owner', 'stable_employee')
  )
);

create policy "lesson_bookings_delete_staff"
on public.lesson_bookings for delete
using (
  exists (
    select 1 from public.lesson_sessions s
    where s.id = lesson_bookings.session_id and s.stable_id = auth_stable_id()
      and auth_role() in ('stable_owner', 'stable_employee')
  )
);

revoke insert on public.lesson_bookings from authenticated;
grant update on public.lesson_bookings to authenticated;

-- The update policy above authorizes self-service owners to update
-- their own booking row at all, but a raw PATCH could otherwise swap
-- in a horse_id/rider_id that was never checked against
-- can_assign_horse_to_booking(). Lock self-service updates down to
-- status/cancelled_at only; staff can still correct anything.
create or replace function public.protect_lesson_booking_fields()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if auth_role() not in ('stable_owner', 'stable_employee') then
    new.session_id := old.session_id;
    new.owner_id := old.owner_id;
    new.rider_id := old.rider_id;
    new.horse_id := old.horse_id;
    new.enrolment_id := old.enrolment_id;
  end if;
  return new;
end;
$$;

create trigger trg_lesson_bookings_protect_fields
before update on public.lesson_bookings
for each row execute function public.protect_lesson_booking_fields();

revoke execute on function public.protect_lesson_booking_fields() from public, anon, authenticated;

create policy "enrolments_select_self_or_staff"
on public.enrolments for select
using (
  (
    rider_id is not null
    and exists (
      select 1 from public.riders r
      join public.owners o on o.id = r.owner_id
      where r.id = enrolments.rider_id and o.user_id = auth.uid()
    )
  )
  or exists (
    select 1 from public.lesson_bookings b
    join public.owners o on o.id = b.owner_id
    where b.enrolment_id = enrolments.id and o.user_id = auth.uid()
  )
  or exists (
    select 1 from public.courses c
    where c.id = enrolments.course_id and c.stable_id = auth_stable_id()
      and auth_role() in ('stable_owner', 'stable_employee')
  )
);

-- Capacity trigger now only counts confirmed bookings (a cancelled one
-- frees the seat) and uses the renamed column.
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
  select capacity into v_capacity from public.lesson_sessions where id = new.session_id for update;
  if v_capacity is null then
    raise exception 'Lesson session not found';
  end if;

  select count(*) into v_count
  from public.lesson_bookings
  where session_id = new.session_id and status = 'confirmed';

  if v_count >= v_capacity then
    raise exception 'This lesson is fully booked.';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Horse eligibility, shared by enrol_in_course() and
-- book_dropin_session(): a school horse, a horse the caller themselves
-- owns, or (for staff booking on someone's behalf) a horse the
-- specified owner owns.
create or replace function public.can_assign_horse_to_booking(p_horse_id uuid, p_owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    exists (select 1 from public.horses h where h.id = p_horse_id and h.is_school_horse = true)
    or auth_owns_horse(p_horse_id)
    or (
      auth_role() in ('stable_owner', 'stable_employee')
      and exists (
        select 1 from public.horses h
        where h.id = p_horse_id
          and (
            h.owner_id = p_owner_id
            or exists (
              select 1 from public.horse_additional_owners hao
              where hao.horse_id = h.id and hao.owner_id = p_owner_id
            )
          )
      )
    );
$$;

revoke execute on function public.can_assign_horse_to_booking(uuid, uuid) from public, anon;

-- ---------------------------------------------------------------------
-- generate_course_sessions: client computes the actual session
-- datetimes (it already knows the stable's local time zone the same
-- way the existing ad-hoc "add lesson" form does), this just inserts
-- them idempotently against the course.
create or replace function public.generate_course_sessions(p_course_id uuid, p_sessions jsonb)
returns setof public.lesson_sessions
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_course public.courses;
  v_session jsonb;
begin
  select * into v_course from public.courses where id = p_course_id;
  if v_course is null then
    raise exception 'Course not found';
  end if;
  if not (auth_stable_id() = v_course.stable_id and auth_role() in ('stable_owner', 'stable_employee')) then
    raise exception 'Not authorized';
  end if;

  for v_session in select * from jsonb_array_elements(p_sessions)
  loop
    insert into public.lesson_sessions (stable_id, course_id, title, instructor_name, starts_at, ends_at, capacity, created_by)
    values (
      v_course.stable_id,
      v_course.id,
      v_course.title,
      v_course.instructor_name,
      (v_session ->> 'starts_at')::timestamptz,
      (v_session ->> 'ends_at')::timestamptz,
      v_course.capacity,
      auth.uid()
    )
    on conflict (course_id, starts_at) do nothing;
  end loop;

  return query select * from public.lesson_sessions where course_id = p_course_id order by starts_at;
end;
$$;

revoke execute on function public.generate_course_sessions(uuid, jsonb) from public, anon;

-- ---------------------------------------------------------------------
-- enrol_in_course: reserves a place on every remaining session of the
-- course in one transaction — if any date is already full, the whole
-- enrolment is rolled back rather than leaving a partial term booking.
create or replace function public.enrol_in_course(
  p_course_id uuid,
  p_owner_id uuid,
  p_rider_id uuid default null,
  p_horse_id uuid default null
)
returns public.enrolments
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_course public.courses;
  v_enrolment public.enrolments;
  v_session record;
begin
  select * into v_course from public.courses where id = p_course_id;
  if v_course is null then
    raise exception 'Course not found';
  end if;
  if v_course.booking_mode = 'dropin_only' then
    raise exception 'This course does not accept term enrolment';
  end if;

  if not (
    exists (select 1 from public.owners o where o.id = p_owner_id and o.user_id = auth.uid())
    or (auth_role() in ('stable_owner', 'stable_employee') and auth_stable_id() = v_course.stable_id)
  ) then
    raise exception 'Not authorized';
  end if;

  if p_rider_id is not null and not exists (
    select 1 from public.riders where id = p_rider_id and owner_id = p_owner_id
  ) then
    raise exception 'Rider does not belong to this account';
  end if;

  if p_horse_id is not null and not can_assign_horse_to_booking(p_horse_id, p_owner_id) then
    raise exception 'Horse is not available for this booking';
  end if;

  insert into public.enrolments (course_id, rider_id, status)
  values (p_course_id, p_rider_id, 'active')
  returning * into v_enrolment;

  for v_session in
    select * from public.lesson_sessions
    where course_id = p_course_id and status = 'scheduled' and starts_at > now()
  loop
    insert into public.lesson_bookings (session_id, owner_id, rider_id, horse_id, enrolment_id, status)
    values (v_session.id, p_owner_id, p_rider_id, p_horse_id, v_enrolment.id, 'confirmed');
  end loop;

  return v_enrolment;
end;
$$;

revoke execute on function public.enrol_in_course(uuid, uuid, uuid, uuid) from public, anon;

-- ---------------------------------------------------------------------
-- withdraw_from_course: separate from cancelling a single session —
-- cancels only this enrolment's future bookings, past ones stay as
-- attendance history.
create or replace function public.withdraw_from_course(p_enrolment_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_course_id uuid;
  v_owner_id uuid;
begin
  select course_id into v_course_id from public.enrolments where id = p_enrolment_id;
  if v_course_id is null then
    raise exception 'Enrolment not found';
  end if;

  select owner_id into v_owner_id from public.lesson_bookings where enrolment_id = p_enrolment_id limit 1;

  if not (
    (v_owner_id is not null and exists (select 1 from public.owners o where o.id = v_owner_id and o.user_id = auth.uid()))
    or exists (
      select 1 from public.courses c
      where c.id = v_course_id and c.stable_id = auth_stable_id()
        and auth_role() in ('stable_owner', 'stable_employee')
    )
  ) then
    raise exception 'Not authorized';
  end if;

  update public.enrolments set status = 'withdrawn', withdrawn_at = now() where id = p_enrolment_id;

  update public.lesson_bookings b
  set status = 'cancelled', cancelled_at = now()
  from public.lesson_sessions s
  where b.enrolment_id = p_enrolment_id
    and b.status = 'confirmed'
    and s.id = b.session_id
    and s.starts_at > now();
end;
$$;

revoke execute on function public.withdraw_from_course(uuid) from public, anon;

-- ---------------------------------------------------------------------
-- book_dropin_session: the single path for a one-off booking, whether
-- it's a standalone session, a dedicated drop-in session, or a spare
-- seat in a mixed course session once the release window has opened.
create or replace function public.book_dropin_session(
  p_session_id uuid,
  p_owner_id uuid,
  p_rider_id uuid default null,
  p_horse_id uuid default null
)
returns public.lesson_bookings
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_session public.lesson_sessions;
  v_course public.courses;
  v_booking public.lesson_bookings;
begin
  select * into v_session from public.lesson_sessions where id = p_session_id;
  if v_session is null or v_session.status <> 'scheduled' then
    raise exception 'Session not available';
  end if;

  if not (
    exists (select 1 from public.owners o where o.id = p_owner_id and o.user_id = auth.uid())
    or (auth_role() in ('stable_owner', 'stable_employee') and auth_stable_id() = v_session.stable_id)
  ) then
    raise exception 'Not authorized';
  end if;

  if p_rider_id is not null and not exists (
    select 1 from public.riders where id = p_rider_id and owner_id = p_owner_id
  ) then
    raise exception 'Rider does not belong to this account';
  end if;

  if v_session.course_id is not null then
    select * into v_course from public.courses where id = v_session.course_id;
    if v_course.booking_mode = 'term_only' then
      raise exception 'This session only accepts term enrolment';
    end if;
    if v_course.booking_mode = 'mixed'
       and now() < v_session.starts_at - (v_course.spare_release_days_before || ' days')::interval
    then
      raise exception 'Spare places for this session are not open yet';
    end if;
  end if;

  if p_horse_id is not null and not can_assign_horse_to_booking(p_horse_id, p_owner_id) then
    raise exception 'Horse is not available for this booking';
  end if;

  insert into public.lesson_bookings (session_id, owner_id, rider_id, horse_id, status)
  values (p_session_id, p_owner_id, p_rider_id, p_horse_id, 'confirmed')
  returning * into v_booking;

  return v_booking;
end;
$$;

revoke execute on function public.book_dropin_session(uuid, uuid, uuid, uuid) from public, anon;

notify pgrst, 'reload schema';
