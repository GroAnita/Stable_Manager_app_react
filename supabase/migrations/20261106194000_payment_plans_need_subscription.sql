-- A stable can't get card payments just by choosing a plan: not on a trial, and not
-- as a tester. It has to have paid, and a tester is switched on by hand in SQL.

create or replace function public.check_stable_plan_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new public.subscription_plans%rowtype;
  v_old_includes boolean := false;
  v_signed integer;
begin
  if auth.uid() is null then
    return new;
  end if;

  select * into v_new from public.subscription_plans where key = new.plan;
  if not found or not v_new.visible then
    raise exception 'plan_not_available';
  end if;

  if tg_op = 'UPDATE' then
    select includes_payments into v_old_includes
    from public.subscription_plans where key = old.plan;
  end if;

  -- Card payments start only when a stable has paid: its subscription then sets the
  -- plan through the webhook, which isn't an app user. A tester gets them by hand.
  if v_new.includes_payments and not coalesce(v_old_includes, false) then
    raise exception 'payment_plan_needs_subscription';
  end if;

  if tg_op = 'UPDATE' then

    -- A paying stable's plan follows its Stripe subscription, so it's changed there.
    if exists (
      select 1 from public.stable_billing b
      where b.stable_id = old.id and b.stripe_subscription_id is not null
        and b.status in ('active', 'past_due')
    ) then
      raise exception 'plan_change_through_billing';
    end if;

    if tg_op = 'UPDATE' and exists (
      select 1 from public.stable_payment_accounts spa
      where spa.stable_id = old.id and spa.plan_change_status in ('scheduled', 'failed')
    ) then
      raise exception 'plan_change_scheduled';
    end if;

    -- Leaving card payments has to go through a planned switch while anything is
    -- running, so boarders are told and nothing is billed twice or missed.
    if coalesce(v_old_includes, false) and not v_new.includes_payments then
      select count(*) into v_signed
      from public.card_agreements ca
      where ca.stable_id = old.id and ca.withdrawn_at is null;
      if v_signed > 0
        or exists (
          select 1 from public.contracts c
          where c.stable_id = old.id and c.status in ('active', 'ending_soon')
        )
        or exists (
          select 1 from public.invoice_extras ie
          where ie.stable_id = old.id and ie.payment_id is null
        ) then
        raise exception 'plan_change_needs_schedule' using detail = v_signed::text;
      end if;
    end if;
  end if;

  return new;
end;
$$;
