-- Generating a course's sessions again after its time, weekday or term changed
-- added the new sessions but left the old ones, so the course showed twice on
-- every date. Now the sessions follow the schedule: future sessions that are no
-- longer in it are removed, unless someone has booked them, so no booking is
-- ever lost. The same goes for dates that have since been blocked.
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

  delete from public.lesson_sessions s
  where s.course_id = p_course_id
    and s.starts_at > now()
    and s.starts_at not in (
      select (value ->> 'starts_at')::timestamptz from jsonb_array_elements(p_sessions)
    )
    and not exists (
      select 1 from public.lesson_bookings b where b.session_id = s.id
    );

  return query select * from public.lesson_sessions where course_id = p_course_id order by starts_at;
end;
$$;

revoke execute on function public.generate_course_sessions(uuid, jsonb) from public, anon;
