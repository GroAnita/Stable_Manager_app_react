-- Notifications (and so push messages) are written in the language each
-- recipient has chosen in the app, which is now kept on their profile.
-- Norwegian is the default, as in the app. Before this, the feeding reminders
-- and swap messages were always English, and the rota notices were in the
-- language of whoever published the rota.
alter table public.profiles
  add column language text not null default 'no'
    check (language in ('no', 'en'));

create function public.set_my_language(p_language text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles
  set language = p_language
  where id = auth.uid()
    and p_language in ('no', 'en')
    and language is distinct from p_language;
$$;

revoke execute on function public.set_my_language(text) from public, anon;
grant execute on function public.set_my_language(text) to authenticated;

-- An owner without an account gets Norwegian; they get no push anyway.
create function public.owner_language(p_owner_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select p.language
    from public.owners o
    join public.profiles p on p.id = o.user_id
    where o.id = p_owner_id
  ), 'no');
$$;

revoke execute on function public.owner_language(uuid) from public, anon, authenticated;

-- "fredag 24. oktober" / "Friday 24 October"
create function public.notice_date(p_date date, p_language text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_language = 'en' then
    (array['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'])[extract(isodow from p_date)::int]
      || ' ' || extract(day from p_date)::int || ' '
      || (array['January','February','March','April','May','June','July','August','September','October','November','December'])[extract(month from p_date)::int]
  else
    (array['mandag','tirsdag','onsdag','torsdag','fredag','lørdag','søndag'])[extract(isodow from p_date)::int]
      || ' ' || extract(day from p_date)::int || '. '
      || (array['januar','februar','mars','april','mai','juni','juli','august','september','oktober','november','desember'])[extract(month from p_date)::int]
  end;
$$;

revoke execute on function public.notice_date(date, text) from public, anon, authenticated;

create or replace function public.send_feeding_shift_reminders()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tz text := 'Europe/Oslo';
  v_shift record;
  v_due_day boolean;
  v_due_hour boolean;
  v_en boolean;
  v_time text;
begin
  for v_shift in
    select fs.id, fs.stable_id, fs.assigned_owner_id, fs.date,
           fs.reminder_day_before_sent_at, fs.reminder_hour_before_sent_at,
           st.label, st.time_of_day,
           (fs.date::timestamp + st.time_of_day) at time zone v_tz as shift_at
    from public.feeding_shifts fs
    join public.feeding_shift_types st on st.id = fs.shift_type_id
    where fs.status = 'published'
      and fs.assigned_owner_id is not null
      and fs.completed_at is null
  loop
    v_due_day := v_shift.reminder_day_before_sent_at is null
      and now() >= v_shift.shift_at - interval '1 day'
      and now() < v_shift.shift_at;

    v_due_hour := v_shift.reminder_hour_before_sent_at is null
      and now() >= v_shift.shift_at - interval '1 hour'
      and now() < v_shift.shift_at;

    if v_due_day or v_due_hour then
      v_en := public.owner_language(v_shift.assigned_owner_id) = 'en';
      v_time := to_char(v_shift.time_of_day, 'HH24:MI');
    end if;

    if v_due_day then
      insert into public.notifications (stable_id, owner_id, notification_type, title, message)
      values (
        v_shift.stable_id, v_shift.assigned_owner_id, 'feeding_shift_reminder',
        case when v_en then 'Feeding duty tomorrow' else 'Fôringsvakt i morgen' end,
        case when v_en then v_shift.label || ' tomorrow at ' || v_time
          else v_shift.label || ' i morgen kl. ' || v_time end
      );
      update public.feeding_shifts
      set reminder_day_before_sent_at = now()
      where id = v_shift.id;
    end if;

    if v_due_hour then
      insert into public.notifications (stable_id, owner_id, notification_type, title, message)
      values (
        v_shift.stable_id, v_shift.assigned_owner_id, 'feeding_shift_reminder',
        case when v_en then 'Feeding duty in 1 hour' else 'Fôringsvakt om én time' end,
        case when v_en then v_shift.label || ' at ' || v_time
          else v_shift.label || ' kl. ' || v_time end
      );
      update public.feeding_shifts
      set reminder_hour_before_sent_at = now()
      where id = v_shift.id;
    end if;
  end loop;
end;
$function$;

create or replace function public.request_feeding_shift_swap(p_shift_id uuid, p_to_owner_id uuid)
returns feeding_shift_swap_requests
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_shift public.feeding_shifts;
  v_requester_owner_id uuid;
  v_swap public.feeding_shift_swap_requests;
  v_lang text;
begin
  select id into v_requester_owner_id from public.owners where user_id = auth.uid();
  if v_requester_owner_id is null then
    raise exception 'No owner record linked to your account.';
  end if;

  select * into v_shift from public.feeding_shifts where id = p_shift_id and status = 'published';
  if v_shift is null then
    raise exception 'Shift not found.';
  end if;
  if v_shift.assigned_owner_id is distinct from v_requester_owner_id then
    raise exception 'You can only request a swap for your own shift.';
  end if;
  if not exists (
    select 1 from public.feeding_rota_participants
    where stable_id = v_shift.stable_id and owner_id = p_to_owner_id and active = true
  ) then
    raise exception 'That owner is not an active rotation participant.';
  end if;

  insert into public.feeding_shift_swap_requests (
    stable_id, shift_id, requested_by_owner_id, requested_to_owner_id
  ) values (
    v_shift.stable_id, p_shift_id, v_requester_owner_id, p_to_owner_id
  )
  returning * into v_swap;

  v_lang := public.owner_language(p_to_owner_id);
  insert into public.notifications (stable_id, owner_id, notification_type, title, message)
  values (
    v_shift.stable_id, p_to_owner_id, 'feeding_shift_swap_requested',
    case when v_lang = 'en' then 'Feeding shift swap request'
      else 'Forespørsel om å bytte fôringsvakt' end,
    case when v_lang = 'en'
      then 'You have been asked to take over a feeding shift on ' || public.notice_date(v_shift.date, v_lang) || '.'
      else 'Du er spurt om å ta over en fôringsvakt ' || public.notice_date(v_shift.date, v_lang) || '.' end
  );

  return v_swap;
end;
$function$;

create or replace function public.respond_feeding_shift_swap(p_swap_id uuid, p_accept boolean)
returns feeding_shift_swap_requests
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_swap public.feeding_shift_swap_requests;
  v_responder_owner_id uuid;
  v_shift public.feeding_shifts;
  v_by text;
  v_to text;
begin
  select id into v_responder_owner_id from public.owners where user_id = auth.uid();

  select * into v_swap from public.feeding_shift_swap_requests
  where id = p_swap_id and status = 'pending';
  if v_swap is null then
    raise exception 'Swap request not found or already resolved.';
  end if;
  if v_swap.requested_to_owner_id is distinct from v_responder_owner_id then
    raise exception 'This swap request is not addressed to you.';
  end if;

  update public.feeding_shift_swap_requests
  set status = case when p_accept then 'accepted' else 'declined' end,
      responded_at = now()
  where id = p_swap_id
  returning * into v_swap;

  select * into v_shift from public.feeding_shifts where id = v_swap.shift_id;
  v_by := public.owner_language(v_swap.requested_by_owner_id);
  v_to := public.owner_language(v_swap.requested_to_owner_id);

  if p_accept then
    update public.feeding_shifts
    set assigned_owner_id = v_swap.requested_to_owner_id
    where id = v_swap.shift_id;

    insert into public.notifications (stable_id, owner_id, notification_type, title, message)
    values
      (v_shift.stable_id, v_swap.requested_by_owner_id, 'feeding_shift_swap_accepted',
       case when v_by = 'en' then 'Feeding shift swap accepted' else 'Byttet er godtatt' end,
       case when v_by = 'en'
         then 'Your feeding shift on ' || public.notice_date(v_shift.date, v_by) || ' has been taken over.'
         else 'Fôringsvakten din ' || public.notice_date(v_shift.date, v_by) || ' er tatt over.' end),
      (v_shift.stable_id, v_swap.requested_to_owner_id, 'feeding_shift_assigned',
       case when v_to = 'en' then 'Feeding shift assigned to you' else 'Du har fått en fôringsvakt' end,
       case when v_to = 'en'
         then 'You are now responsible for the feeding shift on ' || public.notice_date(v_shift.date, v_to) || '.'
         else 'Du har nå ansvaret for fôringsvakten ' || public.notice_date(v_shift.date, v_to) || '.' end);
  else
    insert into public.notifications (stable_id, owner_id, notification_type, title, message)
    values (
      v_shift.stable_id, v_swap.requested_by_owner_id, 'feeding_shift_swap_declined',
      case when v_by = 'en' then 'Feeding shift swap declined' else 'Byttet ble avslått' end,
      case when v_by = 'en'
        then 'Your swap request for the shift on ' || public.notice_date(v_shift.date, v_by) || ' was declined.'
        else 'Forespørselen om å bytte vakten ' || public.notice_date(v_shift.date, v_by) || ' ble avslått.' end
    );
  end if;

  return v_swap;
end;
$function$;

-- When staff move a shift to someone else. Was written by the app in the
-- language of the staff member.
create function public.notify_feeding_shift_assigned(p_shift_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shift public.feeding_shifts;
  v_lang text;
begin
  select * into v_shift from public.feeding_shifts where id = p_shift_id;
  if v_shift is null or v_shift.assigned_owner_id is null then
    return;
  end if;
  if v_shift.stable_id is distinct from public.auth_stable_id()
    or public.auth_role() not in ('stable_owner', 'stable_employee') then
    raise exception 'Not allowed';
  end if;
  v_lang := public.owner_language(v_shift.assigned_owner_id);
  insert into public.notifications (stable_id, owner_id, notification_type, title, message)
  values (
    v_shift.stable_id, v_shift.assigned_owner_id, 'feeding_shift_assigned',
    case when v_lang = 'en' then 'Feeding shift assigned to you' else 'Du har fått en fôringsvakt' end,
    case when v_lang = 'en'
      then 'You have been given a feeding shift on ' || public.notice_date(v_shift.date, v_lang) || '.'
      else 'Du har fått en fôringsvakt ' || public.notice_date(v_shift.date, v_lang) || '.' end
  );
end;
$$;

revoke execute on function public.notify_feeding_shift_assigned(uuid) from public, anon;
grant execute on function public.notify_feeding_shift_assigned(uuid) to authenticated;

-- The rota notices no longer use the text passed in (kept in the signature so
-- older app versions still work); each owner gets their own language.
CREATE OR REPLACE FUNCTION public.publish_feeding_rota(p_date_from date, p_date_to date, p_plans jsonb, p_excluded_owner_ids uuid[], p_notice_title text, p_notice_message text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_stable_id uuid := public.auth_stable_id();
  v_created integer;
begin
  if public.auth_role() is null
    or public.auth_role()::text not in ('stable_owner', 'stable_employee')
    or v_stable_id is null then
    raise exception 'Only stable staff can publish a rota';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_plans) as p(shift_type_id uuid, date date, owner_id uuid)
    where p.date is null
      or p.date < p_date_from
      or p.date > p_date_to
      or not exists (
        select 1 from public.feeding_shift_types st
        where st.id = p.shift_type_id and st.stable_id = v_stable_id
      )
      or (
        p.owner_id is not null
        and not exists (
          select 1 from public.owners o
          where o.id = p.owner_id and o.stable_id = v_stable_id
        )
      )
  ) then
    raise exception 'The rota contains a date, feeding time or owner that does not belong here';
  end if;

  delete from public.feeding_shifts
  where stable_id = v_stable_id
    and status = 'draft'
    and date between p_date_from and p_date_to;

  update public.feeding_rota_participants
  set active = false
  where stable_id = v_stable_id
    and owner_id = any (coalesce(p_excluded_owner_ids, '{}'::uuid[]));

  with new_rows as (
    insert into public.feeding_shifts
      (stable_id, shift_type_id, date, assigned_owner_id, unassignable, status, created_by)
    select v_stable_id, p.shift_type_id, p.date, p.owner_id, p.owner_id is null,
      'published', auth.uid()
    from jsonb_to_recordset(p_plans) as p(shift_type_id uuid, date date, owner_id uuid)
    on conflict (shift_type_id, date) do update
      set assigned_owner_id = excluded.assigned_owner_id,
          unassignable = excluded.unassignable,
          status = 'published',
          created_by = excluded.created_by
      where public.feeding_shifts.status = 'cancelled'
    returning assigned_owner_id
  ),
  per_owner as (
    select assigned_owner_id as owner_id, count(*) as shifts
    from new_rows
    where assigned_owner_id is not null
    group by assigned_owner_id
  ),
  participants as (
    insert into public.feeding_rota_participants (stable_id, owner_id, active)
    select v_stable_id, owner_id, true from per_owner
    on conflict (stable_id, owner_id) do update set active = true
    returning 1
  ),
  notices as (
    insert into public.notifications (stable_id, owner_id, notification_type, title, message)
    select v_stable_id, owner_id, 'feeding_shift_assigned',
      case when public.owner_language(owner_id) = 'en'
        then 'New feeding rota' else 'Ny fôringsturnus' end,
      case when public.owner_language(owner_id) = 'en'
        then 'You have ' || shifts || ' feedings in the new rota. See them under My feeding rota.'
        else 'Du har fått ' || shifts || ' fôringer i den nye turnusen. Se dem under Min fôringsturnus.' end
    from per_owner
    returning 1
  )
  select count(*) into v_created from new_rows;

  return v_created;
end;
$function$;

CREATE OR REPLACE FUNCTION public.remove_feeding_rota(p_date_from date, p_date_to date, p_notice_title text, p_notice_message text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_stable_id uuid := public.auth_stable_id();
  v_removed integer;
begin
  if public.auth_role() is null
    or public.auth_role()::text not in ('stable_owner', 'stable_employee')
    or v_stable_id is null then
    raise exception 'Only stable staff can remove a rota';
  end if;

  with removed as (
    delete from public.feeding_shifts
    where stable_id = v_stable_id
      and status = 'published'
      and date between p_date_from and p_date_to
      and date >= (now() at time zone 'Europe/Oslo')::date
      and completed_at is null
      and let_out_at is null
      and let_in_at is null
    returning assigned_owner_id
  ),
  per_owner as (
    select assigned_owner_id as owner_id, count(*) as shifts
    from removed
    where assigned_owner_id is not null
    group by assigned_owner_id
  ),
  notices as (
    insert into public.notifications (stable_id, owner_id, notification_type, title, message)
    select v_stable_id, owner_id, 'feeding_shift_changed',
      case when public.owner_language(owner_id) = 'en'
        then 'The feeding rota has changed' else 'Fôringsturnusen er endret' end,
      case when public.owner_language(owner_id) = 'en'
        then shifts || ' of your feedings have been removed from the rota. You’ll be told when a new rota is ready.'
        else shifts || ' av fôringene dine er fjernet fra turnusen. Du får beskjed når en ny turnus er klar.' end
    from per_owner
    returning 1
  )
  select count(*) into v_removed from removed;

  return v_removed;
end;
$function$;
