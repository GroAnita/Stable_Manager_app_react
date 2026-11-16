-- A stable can pay its StallOrg subscription monthly or for a year at a time
-- (eleven months' price). stripe-billing-webhook keeps this column in step with
-- the subscription's price in Stripe.
alter table public.stable_billing
  add column billing_interval text not null default 'month'
    check (billing_interval in ('month', 'year'));

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
  billing_interval text
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.status, b.trial_ends_at, b.current_period_end, b.cancel_at_period_end,
    b.past_due_since, b.stripe_subscription_id is not null,
    public.stable_is_read_only(b.stable_id), b.billing_interval
  from public.stable_billing b
  where b.stable_id = public.auth_stable_id();
$$;

revoke execute on function public.get_stable_billing_state() from public, anon;
grant execute on function public.get_stable_billing_state() to authenticated;
