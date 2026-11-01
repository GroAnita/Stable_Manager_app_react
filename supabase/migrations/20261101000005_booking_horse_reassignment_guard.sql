-- Staff can already update a booking's horse_id directly (per-session
-- horse reassignment), but the field-protection trigger only resets
-- fields for non-staff — it never validated that the new horse_id, for
-- staff, actually belongs to the session's stable. Tighten that now
-- that the UI exercises this path for real.
create or replace function public.protect_lesson_booking_fields()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  v_session_stable_id uuid;
begin
  if auth_role() not in ('stable_owner', 'stable_employee') then
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
