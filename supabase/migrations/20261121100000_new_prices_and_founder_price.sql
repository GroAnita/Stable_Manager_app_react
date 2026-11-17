-- New prices from now on for every stable that hasn't paid yet. The stables that
-- tested StallOrg keep the old prices as a founder price: if they choose a
-- subscription by 1 January 2027, they pay it for 12 months from the first
-- payment, and then the normal price.
--
-- founder_offer_until: the last moment the stable can take up the founder price.
-- founder_price_until: set by stripe-billing-webhook when a founder subscription
--   starts (first billing date + 12 months); card-cleanup moves the subscription
--   to the normal price just before then.
alter table public.subscription_plans
  add column founder_price_nok integer check (founder_price_nok > 0);

update public.subscription_plans set founder_price_nok = price_nok;

update public.subscription_plans
set price_nok = case key
  when 'small' then 690
  when 'medium' then 1290
  when 'large' then 1890
  when 'xlarge' then 2490
  when 'small_payments' then 940
  when 'medium_payments' then 1540
  when 'large_payments' then 2140
  when 'xlarge_payments' then 2740
  else price_nok
end;

alter table public.stable_billing
  add column founder_offer_until timestamptz,
  add column founder_price_until timestamptz;

-- The 17 testers who were emailed on 16 November 2026, and the stables already
-- in a trial today. Stables signing up after this get the new prices.
update public.stable_billing
set founder_offer_until = timestamptz '2027-01-01 00:00 Europe/Oslo'
where tester_until is not null
  or status = 'trial';

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
  tester_until timestamptz,
  founder_offer_until timestamptz,
  founder_price_until timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.status, b.trial_ends_at, b.current_period_end, b.cancel_at_period_end,
    b.past_due_since, b.stripe_subscription_id is not null,
    public.stable_is_read_only(b.stable_id), b.billing_interval, b.tester_until,
    b.founder_offer_until, b.founder_price_until
  from public.stable_billing b
  where b.stable_id = public.auth_stable_id();
$$;

revoke execute on function public.get_stable_billing_state() from public, anon;
grant execute on function public.get_stable_billing_state() to authenticated;
