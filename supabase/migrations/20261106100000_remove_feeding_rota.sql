-- Lets staff take back a published rota and make a new one. Only shifts from today
-- on that nobody has started are removed, so the record of work already done stays.
-- Each owner who loses shifts gets one notice. Swap requests on those shifts go with
-- them, because they're linked with on delete cascade.

create function public.remove_feeding_rota(
  p_date_from date,
  p_date_to date,
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
    select v_stable_id, owner_id, 'feeding_shift_changed', p_notice_title,
      replace(p_notice_message, '{count}', shifts::text)
    from per_owner
    returning 1
  )
  select count(*) into v_removed from removed;

  return v_removed;
end;
$$;

revoke execute on function public.remove_feeding_rota(date, date, text, text) from public, anon;
grant execute on function public.remove_feeding_rota(date, date, text, text) to authenticated;
