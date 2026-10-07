-- Aggregates payment totals in SQL instead of fetching every payment row
-- client-side, mirroring the existing dashboard_stats view pattern.
create or replace view public.payment_summary
with (security_invoker = true) as
select
  coalesce(
    sum(amount) filter (
      where status = 'paid'
        and paid_date >= date_trunc('month', current_date)
    ),
    0
  ) as paid_this_month,
  coalesce(sum(amount) filter (where status = 'due'), 0) as total_due,
  coalesce(sum(amount) filter (where status = 'overdue'), 0) as total_overdue
from public.payments
where stable_id = (
  select stable_id from public.profiles where id = auth.uid()
);
