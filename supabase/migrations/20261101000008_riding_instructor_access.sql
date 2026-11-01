-- Grant the new riding_instructor role exactly the lesson-related
-- surface (courses, sessions, bookings, enrolments, riders, blocked
-- dates, and read-only access to horses/owners needed to show names
-- and pick a horse) — nothing else. Every other staff-gated table in
-- the app (medical records, owners write access, payments, stalls,
-- tasks, etc.) is untouched, so a riding instructor simply has no
-- access there at all.

-- ---------------------------------------------------------------------
-- blocked_dates
alter policy "blocked_dates_insert_staff" on public.blocked_dates
with check (
  stable_id = auth_stable_id()
  and auth_role() in ('stable_owner', 'stable_employee', 'riding_instructor')
);

alter policy "blocked_dates_delete_staff" on public.blocked_dates
using (
  stable_id = auth_stable_id()
  and auth_role() in ('stable_owner', 'stable_employee', 'riding_instructor')
);

-- ---------------------------------------------------------------------
-- courses
alter policy "courses_insert_staff" on public.courses
with check (
  stable_id = auth_stable_id()
  and auth_role() in ('stable_owner', 'stable_employee', 'riding_instructor')
);

alter policy "courses_update_staff" on public.courses
using (
  stable_id = auth_stable_id()
  and auth_role() in ('stable_owner', 'stable_employee', 'riding_instructor')
)
with check (
  stable_id = auth_stable_id()
  and auth_role() in ('stable_owner', 'stable_employee', 'riding_instructor')
);

-- ---------------------------------------------------------------------
-- enrolments
alter policy "enrolments_select_self_or_staff" on public.enrolments
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
      and auth_role() in ('stable_owner', 'stable_employee', 'riding_instructor')
  )
);

-- ---------------------------------------------------------------------
-- lesson_sessions (read-write) and lesson_bookings (read + status/horse
-- updates), the roster embeds (horses, owners) read-only
alter policy "lessons_insert_staff" on public.lesson_sessions
with check (
  stable_id = auth_stable_id()
  and auth_role() in ('stable_owner', 'stable_employee', 'riding_instructor')
);

alter policy "lessons_update_staff" on public.lesson_sessions
using (
  stable_id = auth_stable_id()
  and auth_role() in ('stable_owner', 'stable_employee', 'riding_instructor')
)
with check (
  stable_id = auth_stable_id()
  and auth_role() in ('stable_owner', 'stable_employee', 'riding_instructor')
);

alter policy "lessons_delete_staff" on public.lesson_sessions
using (
  stable_id = auth_stable_id()
  and auth_role() in ('stable_owner', 'stable_employee', 'riding_instructor')
);

alter policy "lesson_bookings_select_self_or_staff" on public.lesson_bookings
using (
  exists (select 1 from public.owners o where o.id = lesson_bookings.owner_id and o.user_id = auth.uid())
  or exists (
    select 1 from public.lesson_sessions s
    where s.id = lesson_bookings.session_id and s.stable_id = auth_stable_id()
      and auth_role() in ('stable_owner', 'stable_employee', 'riding_instructor')
  )
);

alter policy "lesson_bookings_update_self_or_staff" on public.lesson_bookings
using (
  exists (select 1 from public.owners o where o.id = lesson_bookings.owner_id and o.user_id = auth.uid())
  or exists (
    select 1 from public.lesson_sessions s
    where s.id = lesson_bookings.session_id and s.stable_id = auth_stable_id()
      and auth_role() in ('stable_owner', 'stable_employee', 'riding_instructor')
  )
)
with check (
  exists (select 1 from public.owners o where o.id = lesson_bookings.owner_id and o.user_id = auth.uid())
  or exists (
    select 1 from public.lesson_sessions s
    where s.id = lesson_bookings.session_id and s.stable_id = auth_stable_id()
      and auth_role() in ('stable_owner', 'stable_employee', 'riding_instructor')
  )
);

alter policy "lesson_bookings_delete_staff" on public.lesson_bookings
using (
  exists (
    select 1 from public.lesson_sessions s
    where s.id = lesson_bookings.session_id and s.stable_id = auth_stable_id()
      and auth_role() in ('stable_owner', 'stable_employee', 'riding_instructor')
  )
);

-- Read-only: lets a riding instructor see horse/owner names in rosters
-- and pick a horse to assign, without granting any horses/owners
-- write access.
alter policy "horses_select_stable" on public.horses
using (
  stable_id = auth_stable_id()
  and auth_role() in ('stable_owner', 'stable_employee', 'riding_instructor')
);

alter policy "owners_select_stable" on public.owners
using (
  stable_id = auth_stable_id()
  and auth_role() in ('stable_owner', 'stable_employee', 'riding_instructor')
);

-- ---------------------------------------------------------------------
-- riders
alter policy "riders_select_self_or_staff" on public.riders
using (
  exists (select 1 from public.owners o where o.id = riders.owner_id and o.user_id = auth.uid())
  or exists (
    select 1 from public.owners o
    where o.id = riders.owner_id and o.stable_id = auth_stable_id()
      and auth_role() in ('stable_owner', 'stable_employee', 'riding_instructor')
  )
);

alter policy "riders_insert_self_or_staff" on public.riders
with check (
  exists (select 1 from public.owners o where o.id = riders.owner_id and o.user_id = auth.uid())
  or exists (
    select 1 from public.owners o
    where o.id = riders.owner_id and o.stable_id = auth_stable_id()
      and auth_role() in ('stable_owner', 'stable_employee', 'riding_instructor')
  )
);

alter policy "riders_update_self_or_staff" on public.riders
using (
  exists (select 1 from public.owners o where o.id = riders.owner_id and o.user_id = auth.uid())
  or exists (
    select 1 from public.owners o
    where o.id = riders.owner_id and o.stable_id = auth_stable_id()
      and auth_role() in ('stable_owner', 'stable_employee', 'riding_instructor')
  )
)
with check (
  exists (select 1 from public.owners o where o.id = riders.owner_id and o.user_id = auth.uid())
  or exists (
    select 1 from public.owners o
    where o.id = riders.owner_id and o.stable_id = auth_stable_id()
      and auth_role() in ('stable_owner', 'stable_employee', 'riding_instructor')
  )
);

alter policy "riders_delete_self_or_staff" on public.riders
using (
  exists (select 1 from public.owners o where o.id = riders.owner_id and o.user_id = auth.uid())
  or exists (
    select 1 from public.owners o
    where o.id = riders.owner_id and o.stable_id = auth_stable_id()
      and auth_role() in ('stable_owner', 'stable_employee', 'riding_instructor')
  )
);

-- ---------------------------------------------------------------------
-- SECURITY DEFINER functions with their own explicit role checks
-- (RLS doesn't apply inside them, so these have to be updated too).

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
      auth_role() in ('stable_owner', 'stable_employee', 'riding_instructor')
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
  if not (auth_stable_id() = v_course.stable_id and auth_role() in ('stable_owner', 'stable_employee', 'riding_instructor')) then
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
    or (auth_role() in ('stable_owner', 'stable_employee', 'riding_instructor') and auth_stable_id() = v_course.stable_id)
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
        and auth_role() in ('stable_owner', 'stable_employee', 'riding_instructor')
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
    or (auth_role() in ('stable_owner', 'stable_employee', 'riding_instructor') and auth_stable_id() = v_session.stable_id)
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

create or replace function public.protect_lesson_booking_fields()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  v_session_stable_id uuid;
begin
  if auth_role() not in ('stable_owner', 'stable_employee', 'riding_instructor') then
    new.session_id := old.session_id;
    new.owner_id := old.owner_id;
    new.rider_id := old.rider_id;
    new.horse_id := old.horse_id;
    new.enrolment_id := old.enrolment_id;
  elsif new.horse_id is distinct from old.horse_id and new.horse_id is not null then
    select stable_id into v_session_stable_id
    from public.lesson_sessions where id = new.session_id;

    if not exists (
      select 1 from public.horses h
      where h.id = new.horse_id and h.stable_id = v_session_stable_id
    ) then
      raise exception 'Horse does not belong to this stable';
    end if;
  end if;
  return new;
end;
$$;

-- A stable owner can now also set a staff member's role to
-- riding_instructor, not just admin/employee.
create or replace function public.set_staff_role(p_staff_id uuid, p_role user_role)
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

  if p_role not in ('stable_owner', 'stable_employee', 'riding_instructor') then
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

notify pgrst, 'reload schema';
