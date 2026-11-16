-- Test accounts can be given an end date. When it passes, the stable gets a
-- month's trial like any new stable and must choose a subscription to go on.
-- Until then the stable owner sees a notice in the app, and the tester-notice
-- function emails them once (tester_notice_sent_at).
alter table public.stable_billing
  add column tester_until timestamptz,
  add column tester_notice_sent_at timestamptz;

drop function public.get_stable_billing_state();

create function public.get_stable_billing_state()
returns table (
  status text,
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean,
  past_due_since timestamptz,
  has_subscription boolean,
  read_only boolean,
  billing_interval text,
  tester_until timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.status, b.trial_ends_at, b.current_period_end, b.cancel_at_period_end,
    b.past_due_since, b.stripe_subscription_id is not null,
    public.stable_is_read_only(b.stable_id), b.billing_interval, b.tester_until
  from public.stable_billing b
  where b.stable_id = public.auth_stable_id();
$$;

revoke execute on function public.get_stable_billing_state() from public, anon;
grant execute on function public.get_stable_billing_state() to authenticated;

create function public.end_tester_accounts()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.stable_billing
  set status = 'trial',
    -- A calendar month in Norwegian time, whatever the session's time zone.
    trial_ends_at = ((tester_until at time zone 'Europe/Oslo') + interval '1 month')
      at time zone 'Europe/Oslo',
    tester_until = null
  where status = 'tester'
    and tester_until is not null
    and tester_until <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.end_tester_accounts() from public, anon, authenticated;

-- Daily at 23:05 UTC, which is just after midnight in Norway in winter.
select cron.schedule(
  'end-tester-accounts',
  '5 23 * * *',
  $$select public.end_tester_accounts();$$
);

-- The test period ends at midnight 1 December 2026 (Norwegian time) for every
-- tester except Nestun Digital's own stable, so the trial runs to 1 January 2027.
update public.stable_billing
set tester_until = timestamptz '2026-12-01 00:00 Europe/Oslo'
where status = 'tester'
  and stable_id <> 'ddd43217-9d50-41d6-b8e2-6c4f26ba8a67';
