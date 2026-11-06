-- Publishes a worked-out feeding rota in one step, so it can't end up half done:
-- old drafts in the period are cleared, the shifts are created, everyone given a
-- shift takes part in the rota (which lets them see feeding details and swap), and
-- each of them gets one notice. Shifts already published are never changed.

create function public.publish_feeding_rota(
  p_date_from date,
  p_date_to date,
  p_plans jsonb,
  p_excluded_owner_ids uuid[],
  p_notice_title text,
  p_notice_message text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
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
    select v_stable_id, owner_id, 'feeding_shift_assigned', p_notice_title,
      replace(p_notice_message, '{count}', shifts::text)
    from per_owner
    returning 1
  )
  select count(*) into v_created from new_rows;

  return v_created;
end;
$$;

revoke execute on function public.publish_feeding_rota(date, date, jsonb, uuid[], text, text) from public, anon;
grant execute on function public.publish_feeding_rota(date, date, jsonb, uuid[], text, text) to authenticated;
