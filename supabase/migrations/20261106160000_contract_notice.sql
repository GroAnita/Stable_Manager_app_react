-- Ending a stable place. A contract gets a notice period, and either side can give
-- notice: the boarder in the app, or the stable owner when it came another way. The
-- contract stays active until its end date, and the last invoice covers what's left.
-- Automatic payment ends once nothing is left to pay, and removing the saved card is
-- tracked and retried, because it depends on Stripe.
--
-- A contract marked "ending soon" still runs: it used to stop being invoiced.

alter table public.contracts
  add column notice_months integer check (notice_months between 0 and 24),
  add column notice_given_at timestamptz,
  add column notice_given_by uuid references auth.users (id) on delete set null,
  add column notice_given_by_role text check (notice_given_by_role in ('boarder', 'stable'));

alter table public.payments
  add column is_final_invoice boolean not null default false;

alter table public.card_agreements
  add column card_removed_at timestamptz,
  add column card_removal_error text;

-- Agreements that never got a card have nothing to remove.
update public.card_agreements
set card_removed_at = withdrawn_at
where withdrawn_at is not null and stripe_payment_method_id is null;

create or replace function public.protect_addon_invoices()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
    or pg_trigger_depth() > 1
    or not (
      public.stable_has_payments_addon(old.stable_id)
      -- An invoice with real lines stays locked even if the stable leaves the add-on.
      or exists (select 1 from public.invoice_lines l where l.payment_id = old.id)
    ) then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    raise exception 'invoice_locked';
  end if;
  if new.amount is distinct from old.amount
    or new.notes is distinct from old.notes
    or new.due_date is distinct from old.due_date
    or new.owner_id is distinct from old.owner_id
    or new.contract_id is distinct from old.contract_id
    or new.stable_id is distinct from old.stable_id
    or new.invoice_email_required is distinct from old.invoice_email_required
    or new.invoice_email_sent_at is distinct from old.invoice_email_sent_at
    or new.invoice_email_sent_to is distinct from old.invoice_email_sent_to
    or new.invoice_email_error is distinct from old.invoice_email_error
    or new.invoice_email_delivery_status is distinct from old.invoice_email_delivery_status
    or new.invoice_email_delivered_at is distinct from old.invoice_email_delivered_at
    or new.charge_status is distinct from old.charge_status
    or new.charge_attempts is distinct from old.charge_attempts
    or new.charge_error is distinct from old.charge_error
    or new.charge_started_at is distinct from old.charge_started_at
    or new.charged_at is distinct from old.charged_at
    or new.stripe_payment_intent_id is distinct from old.stripe_payment_intent_id
    or new.stripe_checkout_session_id is distinct from old.stripe_checkout_session_id
    or new.charge_failure_notified_attempt is distinct from old.charge_failure_notified_attempt
    or new.charge_retry_not_before is distinct from old.charge_retry_not_before
    or new.stripe_fee is distinct from old.stripe_fee
    or new.stripe_net is distinct from old.stripe_net
    or new.refunded_amount is distinct from old.refunded_amount
    or new.refunded_at is distinct from old.refunded_at
    or new.dispute_id is distinct from old.dispute_id
    or new.dispute_status is distinct from old.dispute_status
    or new.dispute_reason is distinct from old.dispute_reason
    or new.dispute_amount is distinct from old.dispute_amount
    or new.dispute_evidence_due_by is distinct from old.dispute_evidence_due_by
    or new.dispute_notified_at is distinct from old.dispute_notified_at
    or new.dispute_lost_at is distinct from old.dispute_lost_at
    or new.dispute_fee is distinct from old.dispute_fee
    or new.dispute_opened_at is distinct from old.dispute_opened_at
    or new.credited_amount is distinct from old.credited_amount
    or new.credited_after_payment is distinct from old.credited_after_payment
    or new.corrects_payment_id is distinct from old.corrects_payment_id
    or new.is_final_invoice is distinct from old.is_final_invoice then
    raise exception 'invoice_locked';
  end if;
  if old.charge_status = 'processing'
    and new.status is distinct from old.status then
    raise exception 'charge_in_progress';
  end if;
  return new;
end;
$$;

create or replace function public.generate_addon_invoices()
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
    where c.status in ('active', 'ending_soon')
      -- An ended contract can still owe for extras that were waiting.
      or exists (
        select 1 from public.invoice_extras ie
        where ie.contract_id = c.id and ie.payment_id is null
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
    continue when v_due_date - current_date > 8;

    continue when v_contract.status in ('active', 'ending_soon') and exists (
      select 1 from public.payments p
      where p.contract_id = v_contract.id and p.is_final_invoice
    );

    continue when v_contract.status not in ('active', 'ending_soon') and not exists (
      select 1 from public.invoice_extras ie
      where ie.contract_id = v_contract.id
        and ie.payment_id is null
        and ie.bills_on <= v_due_date
    );
    continue when not v_final and exists (
      select 1 from public.payments p
      where p.contract_id = v_contract.id and p.due_date = v_due_date
        and p.corrects_payment_id is null
    );
    -- Moving the charge day must not bill a second rent within the same
    -- month, whether the other invoice falls before or after this one. Anything
    -- waiting stays queued for the next invoice.
    continue when not v_final and v_contract.status in ('active', 'ending_soon') and exists (
      select 1 from public.payments p
      where p.contract_id = v_contract.id
        and p.due_date > v_due_date - 28
        and p.due_date < v_due_date + 28
        and p.corrects_payment_id is null
    );

    v_period_start := (v_due_date - interval '1 month')::date + 1;
    v_ratio := 1;
    v_nothing_left := false;
    if v_final then
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
        v_ratio := least(
          (v_period_end - v_period_start + 1)::numeric
            / ((v_period_start + interval '1 month')::date - v_period_start),
          1
        );
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
        || case when v_final then 'Sluttoppgjør: ' else '' end || v_notes;
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
        and (v_final or ie.bills_on <= v_due_date)
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

create or replace function public.generate_monthly_invoices()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_contract record;
  v_due_date date;
  v_cycle_start date;
  v_cycle_days int;
  v_sequence int;
  v_bedding_amount numeric(10, 2);
  v_hay_amount numeric(10, 2);
  v_rent numeric(10, 2);
  v_mucking_amount numeric(10, 2);
  v_turnout_amount numeric(10, 2);
  v_notes text;
begin
  v_due_date := (date_trunc('month', current_date) + interval '1 month' + interval '24 days')::date;
  v_cycle_start := (date_trunc('month', v_due_date) - interval '1 month' + interval '25 days')::date;
  v_cycle_days := v_due_date - v_cycle_start + 1;

  for v_contract in
    select
      c.id, c.stable_id, c.owner_id, c.monthly_rent,
      h.away as horse_away,
      c.bedding_quantity, bpli.price as bedding_item_price, bpli.vat_exempt as bedding_item_vat_exempt,
      c.included_hay_kg, hpli.price as hay_item_price, hpli.vat_exempt as hay_item_vat_exempt,
      c.mucking_schedule, mpli.price as mucking_price, mpli.unit as mucking_unit, mpli.vat_code as mucking_vat_code,
      c.turnout_schedule, tpli.price as turnout_price, tpli.unit as turnout_unit, tpli.vat_code as turnout_vat_code,
      rpli.vat_exempt as boarding_item_vat_exempt,
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
      ) as empty_box_vat_exempt
    from public.contracts c
    join public.horses h on h.id = c.horse_id
    left join public.price_list_items bpli on bpli.id = c.bedding_price_list_item_id
    left join public.price_list_items hpli on hpli.id = c.hay_price_list_item_id
    left join public.price_list_items rpli on rpli.id = c.boarding_price_list_item_id
    left join public.price_list_items mpli on mpli.id = c.mucking_price_list_item_id
    left join public.price_list_items tpli on tpli.id = c.turnout_price_list_item_id
    where c.status in ('active', 'ending_soon')
      and not public.stable_has_payments_addon(c.stable_id)
    order by c.stable_id, c.id
  loop
    if not exists (
      select 1 from public.payments
      where contract_id = v_contract.id and due_date = v_due_date
    ) then
      select count(*) + 1 into v_sequence
      from public.payments
      where stable_id = v_contract.stable_id and due_date = v_due_date;

      if v_contract.horse_away then
        v_bedding_amount := 0;
        v_hay_amount := 0;
        v_mucking_amount := 0;
        v_turnout_amount := 0;
        v_rent := coalesce(v_contract.empty_box_price, 0);
        v_notes := case
          when coalesce(v_contract.empty_box_vat_exempt, false) and public.stable_vat_registered(v_contract.stable_id)
            then 'Empty box fee (horse away, no VAT)'
          else 'Empty box fee (horse away)'
        end;
      else
        v_rent := v_contract.monthly_rent;
        v_bedding_amount := round(
          coalesce(v_contract.bedding_quantity, 0) * coalesce(v_contract.bedding_item_price, 0)
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
          v_cycle_start, v_due_date, public.invoice_vat_code(v_contract.stable_id, v_contract.mucking_vat_code));
        v_turnout_amount := public.contract_service_amount(v_contract.turnout_schedule, v_contract.turnout_price, v_contract.turnout_unit,
          v_cycle_start, v_due_date, public.invoice_vat_code(v_contract.stable_id, v_contract.turnout_vat_code));
        v_notes := case
          when coalesce(v_contract.boarding_item_vat_exempt, false) and public.stable_vat_registered(v_contract.stable_id)
            then 'Monthly board fee (no VAT)'
          else 'Monthly board fee'
        end;
        if v_hay_amount > 0 then
          v_notes := v_notes || chr(10)
            || (case
                 when not public.stable_vat_registered(v_contract.stable_id) then 'Hay — '
               when coalesce(v_contract.hay_item_vat_exempt, false) then 'Hay (no VAT) — '
                 else 'Hay (incl. 25% VAT) — '
               end)
            || to_char(v_hay_amount, 'FM999999990.00');
        end if;
        if v_bedding_amount > 0 then
          v_notes := v_notes || chr(10)
            || (case
                 when not public.stable_vat_registered(v_contract.stable_id) then 'Bedding — '
               when coalesce(v_contract.bedding_item_vat_exempt, false) then 'Bedding (no VAT) — '
                 else 'Bedding (incl. 25% VAT) — '
               end)
            || to_char(v_bedding_amount, 'FM999999990.00');
        end if;
        if v_mucking_amount > 0 then
          v_notes := v_notes || chr(10)
            || public.contract_service_label('Mucking', v_contract.mucking_schedule, v_contract.mucking_unit, v_cycle_start, v_due_date, false)
            || (case public.invoice_vat_code(v_contract.stable_id, v_contract.mucking_vat_code)
                 when 'standard' then ' (incl. 25% VAT)'
                 when 'exempt' then ' (no VAT)'
                 else ''
               end)
            || ' — ' || to_char(v_mucking_amount, 'FM999999990.00');
        end if;
        if v_turnout_amount > 0 then
          v_notes := v_notes || chr(10)
            || public.contract_service_label('Turnout', v_contract.turnout_schedule, v_contract.turnout_unit, v_cycle_start, v_due_date, false)
            || (case public.invoice_vat_code(v_contract.stable_id, v_contract.turnout_vat_code)
                 when 'standard' then ' (incl. 25% VAT)'
                 when 'exempt' then ' (no VAT)'
                 else ''
               end)
            || ' — ' || to_char(v_turnout_amount, 'FM999999990.00');
        end if;
      end if;

      insert into public.payments (
        stable_id, contract_id, owner_id, amount, due_date, status, invoice_number, notes
      ) values (
        v_contract.stable_id,
        v_contract.id,
        v_contract.owner_id,
        v_rent + v_hay_amount + v_bedding_amount + v_mucking_amount + v_turnout_amount,
        v_due_date,
        'due',
        'INV-' || to_char(v_due_date, 'YYYYMM') || '-' || lpad(v_sequence::text, 3, '0'),
        v_notes
      );
    end if;
  end loop;
end;
$$;

create function public.contract_notice_end_date(p_notice_months integer, p_today date)
returns date
language sql
immutable
set search_path = ''
as $$
  select (p_today + make_interval(months => p_notice_months))::date;
$$;

revoke execute on function public.contract_notice_end_date(integer, date) from public, anon;
grant execute on function public.contract_notice_end_date(integer, date) to authenticated;

-- A boarder gets the end date the notice period gives. The stable owner can choose
-- one, because the notice may have been given earlier or by agreement.
create function public.give_contract_notice(p_contract_id uuid, p_end_date date default null)
returns date
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contract public.contracts%rowtype;
  v_today date := (now() at time zone 'Europe/Oslo')::date;
  v_is_boarder boolean;
  v_is_stable_owner boolean;
  v_end_date date;
begin
  select * into v_contract from public.contracts where id = p_contract_id for update;
  if not found then
    raise exception 'Contract not found';
  end if;

  v_is_boarder := exists (
    select 1 from public.owners o
    where o.id = v_contract.owner_id and o.user_id = auth.uid()
  );
  v_is_stable_owner := public.auth_role() is not distinct from 'stable_owner'
    and public.auth_stable_id() = v_contract.stable_id;
  if not v_is_boarder and not v_is_stable_owner then
    raise exception 'Contract not found';
  end if;

  if v_contract.status not in ('active', 'ending_soon') then
    raise exception 'contract_not_running';
  end if;
  if v_contract.notice_given_at is not null then
    raise exception 'notice_already_given';
  end if;

  if v_is_stable_owner and p_end_date is not null then
    v_end_date := p_end_date;
  elsif v_contract.notice_months is null then
    raise exception 'notice_period_missing';
  else
    v_end_date := public.contract_notice_end_date(v_contract.notice_months, v_today);
  end if;
  if v_end_date < v_today then
    raise exception 'notice_end_date_past';
  end if;

  update public.contracts
  set notice_given_at = now(),
      notice_given_by = auth.uid(),
      notice_given_by_role = case when v_is_stable_owner then 'stable' else 'boarder' end,
      end_date = v_end_date
  where id = p_contract_id;

  return v_end_date;
end;
$$;

revoke execute on function public.give_contract_notice(uuid, date) from public, anon;
grant execute on function public.give_contract_notice(uuid, date) to authenticated;

-- Refused once the last invoice exists, which would have to be credited first.
create function public.cancel_contract_notice(p_contract_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.auth_role() is distinct from 'stable_owner' then
    raise exception 'Only the stable owner can do this';
  end if;
  if exists (
    select 1 from public.payments p
    where p.contract_id = p_contract_id and p.is_final_invoice
  ) then
    raise exception 'final_invoice_exists';
  end if;

  update public.contracts
  set notice_given_at = null,
      notice_given_by = null,
      notice_given_by_role = null,
      end_date = null
  where id = p_contract_id
    and stable_id = public.auth_stable_id()
    and notice_given_at is not null
    and status in ('active', 'ending_soon');
  if not found then
    raise exception 'contract_not_running';
  end if;
end;
$$;

revoke execute on function public.cancel_contract_notice(uuid) from public, anon;
grant execute on function public.cancel_contract_notice(uuid) to authenticated;

-- After the morning invoices, so the last invoice is made before the contract ends.
create function public.finish_ended_contracts()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.contracts
  set status = 'expired'
  where notice_given_at is not null
    and end_date < (now() at time zone 'Europe/Oslo')::date
    and status in ('active', 'ending_soon');
$$;

revoke execute on function public.finish_ended_contracts() from public, anon, authenticated;

select cron.schedule(
  'finish-ended-contracts',
  '30 5 * * *',
  $$select public.finish_ended_contracts();$$
);

create function public.trigger_card_cleanup()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'invoice_email_trigger_secret';

  perform net.http_post(
    url := 'https://kutsqjkjnzyfmoidafet.supabase.co/functions/v1/card-cleanup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Invoice-Email-Secret', coalesce(v_secret, '')
    ),
    body := '{}'::jsonb
  );
end;
$$;

revoke execute on function public.trigger_card_cleanup() from public, anon, authenticated;

select cron.schedule(
  'card-cleanup',
  '45 5 * * *',
  $$select public.trigger_card_cleanup();$$
);
