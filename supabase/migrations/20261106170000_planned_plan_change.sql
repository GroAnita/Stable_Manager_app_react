-- A stable moving to a plan without card payments. It's planned for the 1st of a
-- month at least 8 days ahead, and boarders are told when it's planned. On the day
-- all card agreements end, each contract gets one last invoice, and the stable moves
-- to the new plan. Nightly card-cleanup does this and retries if anything fails, so
-- the stable can see whether the switch is really finished.
--
-- The last invoice runs to the 25th of the switch month. The monthly invoices run on
-- the 26th and bill the period starting that day, so that's exactly where they take
-- over, and no day is billed twice or missed.

alter table public.stable_payment_accounts
  add column scheduled_plan public.stable_plan,
  add column scheduled_plan_on date,
  add column plan_change_status text
    check (plan_change_status in ('scheduled', 'failed', 'done')),
  add column plan_change_error text,
  add column plan_change_completed_at timestamptz;

drop function public.generate_addon_invoices();

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

create function public.generate_addon_invoices(
  p_stable_id uuid default null,
  p_settle_until date default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_contract record;
  v_due_date date;
  v_period_start date;
  v_cycle_days int;
  v_sequence int;
  v_bedding_amount numeric(10, 2);
  v_hay_amount numeric(10, 2);
  v_rent numeric(10, 2);
  v_mucking_amount numeric(10, 2);
  v_turnout_amount numeric(10, 2);
  v_notes text;
  v_extras_total numeric(10, 2);
  v_extra_lines text;
  v_payment_id uuid;
  v_rent_code text;
  v_rent_label text;
  v_position integer;
  v_final boolean;
  v_settlement boolean := p_settle_until is not null;
  v_closing boolean;
  v_period_end date;
  v_ratio numeric;
  v_last_due date;
  v_nothing_left boolean;
begin
  for v_contract in
    select
      c.id, c.stable_id, c.owner_id, c.monthly_rent, c.status,
      c.start_date, c.end_date, c.notice_given_at,
      coalesce(c.charge_day, spa.charge_day) as charge_day,
      h.away as horse_away,
      c.bedding_quantity, bpli.price as bedding_item_price, bpli.vat_exempt as bedding_item_vat_exempt, bpli.vat_code as bedding_item_vat_code,
      c.included_hay_kg, hpli.price as hay_item_price, hpli.vat_exempt as hay_item_vat_exempt, hpli.vat_code as hay_item_vat_code,
      c.mucking_schedule, mpli.price as mucking_price, mpli.unit as mucking_unit, mpli.vat_code as mucking_vat_code,
      c.turnout_schedule, tpli.price as turnout_price, tpli.unit as turnout_unit, tpli.vat_code as turnout_vat_code,
      rpli.vat_exempt as boarding_item_vat_exempt, rpli.vat_code as boarding_item_vat_code,
      (
        select epli.price from public.price_list_items epli
        where epli.stable_id = c.stable_id and epli.category = 'EmptyBox'
        order by epli.created_at
        limit 1
      ) as empty_box_price,
      (
        select epli.vat_exempt from public.price_list_items epli
        where epli.stable_id = c.stable_id and epli.category = 'EmptyBox'
        order by epli.created_at
        limit 1
      ) as empty_box_vat_exempt,
      (
        select epli.vat_code from public.price_list_items epli
        where epli.stable_id = c.stable_id and epli.category = 'EmptyBox'
        order by epli.created_at
        limit 1
      ) as empty_box_vat_code
    from public.contracts c
    join public.stable_payment_accounts spa
      on spa.stable_id = c.stable_id and spa.addon_enabled
    join public.horses h on h.id = c.horse_id
    left join public.price_list_items bpli on bpli.id = c.bedding_price_list_item_id
    left join public.price_list_items hpli on hpli.id = c.hay_price_list_item_id
    left join public.price_list_items rpli on rpli.id = c.boarding_price_list_item_id
    left join public.price_list_items mpli on mpli.id = c.mucking_price_list_item_id
    left join public.price_list_items tpli on tpli.id = c.turnout_price_list_item_id
    where (p_stable_id is null or c.stable_id = p_stable_id)
      and (
        c.status in ('active', 'ending_soon')
        -- An ended contract can still owe for extras that were waiting.
        or exists (
          select 1 from public.invoice_extras ie
          where ie.contract_id = c.id and ie.payment_id is null
        )
      )
    order by c.stable_id, c.id
  loop
    v_due_date := make_date(
      extract(year from current_date)::int,
      extract(month from current_date)::int,
      v_contract.charge_day
    );
    if v_due_date < current_date then
      v_due_date := (v_due_date + interval '1 month')::date;
    end if;

    -- The last invoice after notice is given: it covers up to the end date, and is
    -- due then, or later if that wouldn't leave time for the notice.
    v_final := v_contract.notice_given_at is not null
      and v_contract.end_date is not null
      and v_contract.status in ('active', 'ending_soon')
      and v_contract.end_date <= v_due_date;
    v_period_end := v_due_date;
    if v_final then
      v_period_end := v_contract.end_date;
      v_due_date := greatest(v_contract.end_date, current_date + 8);
    end if;
    -- A stable leaving card payments: bill up to where the monthly invoices take
    -- over, or to the end date if the contract ends before that.
    if v_settlement then
      v_final := v_contract.notice_given_at is not null
        and v_contract.end_date is not null
        and v_contract.status in ('active', 'ending_soon')
        and v_contract.end_date <= p_settle_until;
      v_period_end := case when v_final then v_contract.end_date else p_settle_until end;
      v_due_date := current_date + 8;
    end if;
    v_closing := v_final or v_settlement;
    continue when v_due_date - current_date > 8;

    continue when v_contract.status in ('active', 'ending_soon') and exists (
      select 1 from public.payments p
      where p.contract_id = v_contract.id and p.is_final_invoice
    );

    continue when v_contract.status not in ('active', 'ending_soon') and not exists (
      select 1 from public.invoice_extras ie
      where ie.contract_id = v_contract.id
        and ie.payment_id is null
        and (v_closing or ie.bills_on <= v_due_date)
    );
    continue when not v_closing and exists (
      select 1 from public.payments p
      where p.contract_id = v_contract.id and p.due_date = v_due_date
        and p.corrects_payment_id is null
    );
    -- Moving the charge day must not bill a second rent within the same
    -- month, whether the other invoice falls before or after this one. Anything
    -- waiting stays queued for the next invoice.
    continue when not v_closing and v_contract.status in ('active', 'ending_soon') and exists (
      select 1 from public.payments p
      where p.contract_id = v_contract.id
        and p.due_date > v_due_date - 28
        and p.due_date < v_due_date + 28
        and p.corrects_payment_id is null
    );

    v_period_start := (v_due_date - interval '1 month')::date + 1;
    v_ratio := 1;
    v_nothing_left := false;
    if v_closing then
      -- Starts after whatever was last invoiced. Rent and other monthly amounts are
      -- for the share of a month that's left.
      select max(p.due_date) into v_last_due
      from public.payments p
      where p.contract_id = v_contract.id and p.corrects_payment_id is null;
      v_period_start := coalesce(
        v_last_due + 1,
        greatest(v_contract.start_date, (v_period_end - interval '1 month')::date + 1)
      );
      v_nothing_left := v_period_end < v_period_start;
      if not v_nothing_left then
        v_ratio := (v_period_end - v_period_start + 1)::numeric
          / ((v_period_start + interval '1 month')::date - v_period_start);
        -- Only a settlement can run longer than a month.
        if not v_settlement then
          v_ratio := least(v_ratio, 1);
        end if;
      end if;
    end if;
    v_cycle_days := v_period_end - v_period_start + 1;
    v_bedding_amount := 0;
    v_hay_amount := 0;
    v_rent := 0;
    v_mucking_amount := 0;
    v_turnout_amount := 0;
    v_notes := null;

    if v_contract.status not in ('active', 'ending_soon') or v_nothing_left then
      null;
    elsif v_contract.horse_away then
      v_rent := round(coalesce(v_contract.empty_box_price, 0) * v_ratio, 2);
      v_rent_label := 'Tom boks (hest borte)';
      v_rent_code := public.invoice_vat_code(v_contract.stable_id, v_contract.empty_box_vat_code);
      v_notes := case
        when coalesce(v_contract.empty_box_vat_exempt, false) and public.stable_vat_registered(v_contract.stable_id)
          then 'Tom boks (hest borte, uten mva)'
        else 'Tom boks (hest borte)'
      end;
    else
      v_rent := round(v_contract.monthly_rent * v_ratio, 2);
      v_rent_label := 'Månedlig oppstalling';
      v_rent_code := public.invoice_vat_code(v_contract.stable_id, v_contract.boarding_item_vat_code);
      v_bedding_amount := round(
        coalesce(v_contract.bedding_quantity, 0) * coalesce(v_contract.bedding_item_price, 0) * v_ratio
          * (case when coalesce(v_contract.bedding_item_vat_exempt, false) or not public.stable_vat_registered(v_contract.stable_id) then 1 else 1.25 end),
        2
      );
      v_hay_amount := round(
        coalesce(v_contract.included_hay_kg, 0) * v_cycle_days
          * coalesce(v_contract.hay_item_price, 0)
          * (case when coalesce(v_contract.hay_item_vat_exempt, false) or not public.stable_vat_registered(v_contract.stable_id) then 1 else 1.25 end),
        2
      );
      v_mucking_amount := public.contract_service_amount(v_contract.mucking_schedule, v_contract.mucking_price, v_contract.mucking_unit,
        v_period_start, v_period_end, public.invoice_vat_code(v_contract.stable_id, v_contract.mucking_vat_code));
      v_turnout_amount := public.contract_service_amount(v_contract.turnout_schedule, v_contract.turnout_price, v_contract.turnout_unit,
        v_period_start, v_period_end, public.invoice_vat_code(v_contract.stable_id, v_contract.turnout_vat_code));
      if lower(coalesce(v_contract.mucking_unit, '')) = 'per month' then
        v_mucking_amount := round(v_mucking_amount * v_ratio, 2);
      end if;
      if lower(coalesce(v_contract.turnout_unit, '')) = 'per month' then
        v_turnout_amount := round(v_turnout_amount * v_ratio, 2);
      end if;
      v_notes := case
        when coalesce(v_contract.boarding_item_vat_exempt, false) and public.stable_vat_registered(v_contract.stable_id)
          then 'Månedlig oppstalling (uten mva)'
        else 'Månedlig oppstalling'
      end;
      if v_hay_amount > 0 then
        v_notes := v_notes || chr(10)
          || (case
               when not public.stable_vat_registered(v_contract.stable_id) then 'Høy — '
               when coalesce(v_contract.hay_item_vat_exempt, false) then 'Høy (uten mva) — '
               else 'Høy (inkl. 25 % mva) — '
             end)
          || to_char(v_hay_amount, 'FM999999990.00');
      end if;
      if v_bedding_amount > 0 then
        v_notes := v_notes || chr(10)
          || (case
               when not public.stable_vat_registered(v_contract.stable_id) then 'Strø — '
               when coalesce(v_contract.bedding_item_vat_exempt, false) then 'Strø (uten mva) — '
               else 'Strø (inkl. 25 % mva) — '
             end)
          || to_char(v_bedding_amount, 'FM999999990.00');
      end if;
      if v_mucking_amount > 0 then
        v_notes := v_notes || chr(10)
          || public.contract_service_label('Møkking', v_contract.mucking_schedule, v_contract.mucking_unit, v_period_start, v_period_end, true)
          || (case public.invoice_vat_code(v_contract.stable_id, v_contract.mucking_vat_code)
               when 'standard' then ' (inkl. 25 % mva)'
               when 'exempt' then ' (uten mva)'
               else ''
             end)
          || ' — ' || to_char(v_mucking_amount, 'FM999999990.00');
      end if;
      if v_turnout_amount > 0 then
        v_notes := v_notes || chr(10)
          || public.contract_service_label('Inn- og utslipp', v_contract.turnout_schedule, v_contract.turnout_unit, v_period_start, v_period_end, true)
          || (case public.invoice_vat_code(v_contract.stable_id, v_contract.turnout_vat_code)
               when 'standard' then ' (inkl. 25 % mva)'
               when 'exempt' then ' (uten mva)'
               else ''
             end)
          || ' — ' || to_char(v_turnout_amount, 'FM999999990.00');
      end if;
    end if;

    if v_notes is not null then
      v_notes := to_char(v_period_start, 'DD.MM.YYYY') || ' – '
        || to_char(v_period_end, 'DD.MM.YYYY') || ': '
        || case
          when v_final then 'Sluttoppgjør: '
          when v_settlement then 'Oppgjør ved overgang: '
          else ''
        end || v_notes;
    end if;

    -- Numbered within the stable and month, since contracts in one month can now
    -- have different charge days. Uses the highest number so far because a count
    -- would reuse a number after an invoice was deleted.
    select coalesce(
      max(substring(invoice_number from '^INV-[0-9]{6}-([0-9]+)')::int),
      0
    ) + 1 into v_sequence
    from public.payments
    where stable_id = v_contract.stable_id
      and invoice_number like 'INV-' || to_char(v_due_date, 'YYYYMM') || '-%';

    insert into public.payments (
      stable_id, contract_id, owner_id, amount, due_date, status, invoice_number, notes,
      invoice_email_required, is_final_invoice
    ) values (
      v_contract.stable_id,
      v_contract.id,
      v_contract.owner_id,
      v_rent + v_hay_amount + v_bedding_amount + v_mucking_amount + v_turnout_amount,
      v_due_date,
      'due',
      'INV-' || to_char(v_due_date, 'YYYYMM') || '-' || lpad(v_sequence::text, 3, '0'),
      v_notes,
      true,
      v_final
    )
    returning id into v_payment_id;

    v_position := 0;
    if v_rent > 0 then
      v_position := v_position + 1;
      perform public.add_invoice_line(v_payment_id, v_contract.stable_id, v_position,
        v_rent_label, v_period_start, v_period_end, v_rent_code, v_rent);
    end if;
    if v_hay_amount > 0 then
      v_position := v_position + 1;
      perform public.add_invoice_line(v_payment_id, v_contract.stable_id, v_position,
        'Høy', v_period_start, v_period_end,
        public.invoice_vat_code(v_contract.stable_id, v_contract.hay_item_vat_code), v_hay_amount);
    end if;
    if v_bedding_amount > 0 then
      v_position := v_position + 1;
      perform public.add_invoice_line(v_payment_id, v_contract.stable_id, v_position,
        'Strø', v_period_start, v_period_end,
        public.invoice_vat_code(v_contract.stable_id, v_contract.bedding_item_vat_code), v_bedding_amount);
    end if;
    if v_mucking_amount > 0 then
      v_position := v_position + 1;
      perform public.add_invoice_line(v_payment_id, v_contract.stable_id, v_position,
        public.contract_service_label('Møkking', v_contract.mucking_schedule, v_contract.mucking_unit, v_period_start, v_period_end, true),
        v_period_start, v_period_end,
        public.invoice_vat_code(v_contract.stable_id, v_contract.mucking_vat_code), v_mucking_amount);
    end if;
    if v_turnout_amount > 0 then
      v_position := v_position + 1;
      perform public.add_invoice_line(v_payment_id, v_contract.stable_id, v_position,
        public.contract_service_label('Inn- og utslipp', v_contract.turnout_schedule, v_contract.turnout_unit, v_period_start, v_period_end, true),
        v_period_start, v_period_end,
        public.invoice_vat_code(v_contract.stable_id, v_contract.turnout_vat_code), v_turnout_amount);
    end if;

    with claimed as (
      update public.invoice_extras ie
      set payment_id = v_payment_id
      where ie.contract_id = v_contract.id
        and ie.payment_id is null
        and (v_closing or ie.bills_on <= v_due_date)
      returning ie.description, ie.amount, ie.purchased_on, ie.created_at
    )
    select
      coalesce(sum(claimed.amount), 0),
      string_agg(
        claimed.description || ' — ' || to_char(claimed.amount, 'FM999999990.00'),
        chr(10) order by claimed.purchased_on, claimed.created_at
      )
    into v_extras_total, v_extra_lines
    from claimed;

    perform public.add_invoice_line(v_payment_id, v_contract.stable_id,
      v_position + (row_number() over (order by ie.purchased_on, ie.created_at))::integer,
      ie.description, ie.purchased_on, ie.purchased_on,
      coalesce(ie.vat_code, public.invoice_vat_code(v_contract.stable_id, null)), ie.amount)
    from public.invoice_extras ie
    where ie.payment_id = v_payment_id;

    if v_extras_total > 0 then
      update public.payments p
      set amount = p.amount + v_extras_total,
          notes = case
            when p.notes is null then v_extra_lines
            else p.notes || chr(10) || v_extra_lines
          end
      where p.id = v_payment_id;
    elsif v_rent + v_hay_amount + v_bedding_amount + v_mucking_amount + v_turnout_amount = 0 then
      -- Nothing to bill, such as an empty box with no price set.
      delete from public.payments p where p.id = v_payment_id;
    end if;
  end loop;
end;
$$;

revoke execute on function public.generate_addon_invoices(uuid, date) from public, anon, authenticated;

create function public.schedule_plan_change(p_plan public.stable_plan, p_on date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stable_id uuid := public.auth_stable_id();
  v_current public.stable_plan;
  v_includes boolean;
  v_target_includes boolean;
  v_target_visible boolean;
  v_today date := (now() at time zone 'Europe/Oslo')::date;
  v_signed integer;
begin
  if public.auth_role() is distinct from 'stable_owner' then
    raise exception 'Only the stable owner can do this';
  end if;
  select s.plan into v_current from public.stables s where s.id = v_stable_id;
  select includes_payments into v_includes
  from public.subscription_plans where key = v_current;
  select includes_payments, visible into v_target_includes, v_target_visible
  from public.subscription_plans where key = p_plan;
  if not coalesce(v_includes, false)
    or coalesce(v_target_includes, true)
    or not coalesce(v_target_visible, false) then
    raise exception 'plan_not_available';
  end if;
  if p_on is null or extract(day from p_on) <> 1 or p_on < v_today + 8 then
    raise exception 'plan_change_date_invalid';
  end if;

  update public.stable_payment_accounts
  set scheduled_plan = p_plan,
      scheduled_plan_on = p_on,
      plan_change_status = 'scheduled',
      plan_change_error = null,
      plan_change_completed_at = null
  where stable_id = v_stable_id
    and coalesce(plan_change_status, 'done') = 'done';
  if not found then
    raise exception 'plan_change_scheduled';
  end if;

  select count(*) into v_signed
  from public.card_agreements ca
  where ca.stable_id = v_stable_id
    and ca.withdrawn_at is null
    and ca.activated_at is not null;
  return v_signed;
end;
$$;

revoke execute on function public.schedule_plan_change(public.stable_plan, date) from public, anon;
grant execute on function public.schedule_plan_change(public.stable_plan, date) to authenticated;

-- Can be undone until the day itself. Boarders who were told are told again by the
-- plan-change function.
create function public.cancel_plan_change()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.auth_role() is distinct from 'stable_owner' then
    raise exception 'Only the stable owner can do this';
  end if;
  update public.stable_payment_accounts
  set scheduled_plan = null,
      scheduled_plan_on = null,
      plan_change_status = null,
      plan_change_error = null
  where stable_id = public.auth_stable_id()
    and plan_change_status = 'scheduled'
    and scheduled_plan_on > (now() at time zone 'Europe/Oslo')::date;
  if not found then
    raise exception 'plan_change_too_late';
  end if;
end;
$$;

revoke execute on function public.cancel_plan_change() from public, anon;
grant execute on function public.cancel_plan_change() to authenticated;

-- One transaction, so it either all happens or it's tried again the next night.
-- Called by card-cleanup once every card agreement has ended.
create function public.finish_plan_change(p_stable_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account public.stable_payment_accounts%rowtype;
begin
  select * into v_account from public.stable_payment_accounts
  where stable_id = p_stable_id
    and plan_change_status in ('scheduled', 'failed')
    and scheduled_plan_on <= (now() at time zone 'Europe/Oslo')::date
  for update;
  if not found then
    raise exception 'plan_change_not_due';
  end if;

  perform public.generate_addon_invoices(
    p_stable_id,
    (date_trunc('month', v_account.scheduled_plan_on) + interval '24 days')::date
  );

  update public.stables set plan = v_account.scheduled_plan where id = p_stable_id;

  update public.stable_payment_accounts
  set plan_change_status = 'done',
      plan_change_error = null,
      plan_change_completed_at = now()
  where stable_id = p_stable_id;
end;
$$;

revoke execute on function public.finish_plan_change(uuid) from public, anon, authenticated;
grant execute on function public.finish_plan_change(uuid) to service_role;
