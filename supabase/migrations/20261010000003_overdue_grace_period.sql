-- A "due" payment becomes "overdue" only after a 7-day grace period past
-- its due date, not the instant the due date passes. Also schedules the
-- refresh function daily — it previously existed but nothing ever called
-- it, so stored payment status never actually flipped to "overdue" on its
-- own (the dashboard only looked right because its views recompute the
-- same condition live).

create or replace function public.refresh_overdue_payments()
returns void
language sql
security definer
set search_path to 'public'
as $$
  update public.payments
  set status = 'overdue'
  where status = 'due' and due_date < current_date - 7;
$$;

create or replace view public.dashboard_stats
with (security_invoker = true) as
select
  (select count(*) from horses where horses.active = true) as total_horses,
  (select count(*) from stalls where stalls.status = 'occupied') as occupied_stalls,
  (select count(*) from stalls where stalls.status = 'available') as available_stalls,
  (select count(*) from payments
    where payments.status = 'due'
      and payments.due_date >= current_date
      and payments.due_date <= (current_date + interval '7 days')) as upcoming_payments,
  (select count(*) from payments
    where payments.status = 'overdue'
      or (payments.status = 'due' and payments.due_date < current_date - 7)) as overdue_payments,
  (select count(*) from tasks
    where tasks.completed = false and tasks.due_date = current_date) as today_tasks,
  (select count(*) from calendar_events
    where calendar_events.event_type = 'vet'
      and calendar_events.start_time >= now()
      and calendar_events.start_time <= (now() + interval '14 days')) as upcoming_vet_visits,
  (select count(*) from calendar_events
    where calendar_events.event_type = 'farrier'
      and calendar_events.start_time >= now()
      and calendar_events.start_time <= (now() + interval '14 days')) as upcoming_farrier_visits;

create or replace view public.overdue_payments_list
with (security_invoker = true) as
select
  p.id, p.stable_id, p.contract_id, p.owner_id, p.amount, p.due_date,
  p.paid_date, p.payment_method, p.invoice_number, p.status, p.notes,
  p.created_at, p.updated_at,
  h.name as horse_name,
  o.full_name as owner_name
from payments p
join contracts c on c.id = p.contract_id
join horses h on h.id = c.horse_id
join owners o on o.id = p.owner_id
where p.status = 'overdue'
   or (p.status = 'due' and p.due_date < current_date - 7)
order by p.due_date;

select cron.schedule(
  'refresh-overdue-payments',
  '0 6 * * *',
  $$select public.refresh_overdue_payments();$$
);
