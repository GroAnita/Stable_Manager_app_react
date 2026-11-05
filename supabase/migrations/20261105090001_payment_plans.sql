-- Subscriptions with card payments. Choosing one turns the payments add-on on, and
-- choosing any other plan turns it off, so the add-on now follows stables.plan.
--
-- The new plans start hidden (visible = false) until card payments go live. App
-- users can't choose a hidden plan; to open them:
--   update public.subscription_plans set visible = true where includes_payments;
--
-- As with the invoice lock, these checks don't apply when auth.uid() is null, so
-- the SQL editor can still move a stable between plans.

alter table public.subscription_plans
  add column includes_payments boolean not null default false,
  add column visible boolean not null default true;

insert into public.subscription_plans
  (key, name, horse_min, horse_max, price_nok, sort_order, includes_payments, visible)
values
  ('small_payments', 'Liten med kortbetaling', 1, 10, 499, 5, true, false),
  ('medium_payments', 'Mellomstor med kortbetaling', 11, 20, 799, 6, true, false),
  ('large_payments', 'Stor med kortbetaling', 21, 30, 1099, 7, true, false),
  ('xlarge_payments', 'Ekstra stor med kortbetaling', 31, null, 1399, 8, true, false);

-- Stables that already have the add-on keep it, on the same size with payments.
update public.stables s
set plan = (s.plan::text || '_payments')::public.stable_plan
from public.stable_payment_accounts spa
where spa.stable_id = s.id
  and spa.addon_enabled
  and s.plan::text not like '%\_payments';

create function public.check_stable_plan_change()
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

    -- Boarders in these agreements have saved cards and were promised the billing
    -- rules, so they can't lose them because of a plan change.
    if coalesce(v_old_includes, false) and not v_new.includes_payments then
      select count(*) into v_signed
      from public.card_agreements ca
      where ca.stable_id = old.id and ca.withdrawn_at is null;
      if v_signed > 0 then
        raise exception 'plan_has_card_agreements' using detail = v_signed::text;
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.check_stable_plan_change() from public, anon, authenticated;

create trigger trg_stables_check_plan_change_insert
before insert on public.stables
for each row execute function public.check_stable_plan_change();

create trigger trg_stables_check_plan_change_update
before update of plan on public.stables
for each row
when (new.plan is distinct from old.plan)
execute function public.check_stable_plan_change();

create function public.sync_payments_addon_with_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_includes boolean;
begin
  select includes_payments into v_includes
  from public.subscription_plans where key = new.plan;

  if coalesce(v_includes, false) then
    insert into public.stable_payment_accounts (stable_id, addon_enabled)
    values (new.id, true)
    on conflict (stable_id) do update set addon_enabled = true;
  else
    update public.stable_payment_accounts
    set addon_enabled = false, card_signing_enabled = false
    where stable_id = new.id;
  end if;

  return new;
end;
$$;

revoke execute on function public.sync_payments_addon_with_plan() from public, anon, authenticated;

create trigger trg_stables_sync_addon_insert
after insert on public.stables
for each row execute function public.sync_payments_addon_with_plan();

create trigger trg_stables_sync_addon_update
after update of plan on public.stables
for each row
when (new.plan is distinct from old.plan)
execute function public.sync_payments_addon_with_plan();
