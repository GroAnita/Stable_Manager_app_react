-- Mucking and letting horses in and out, chosen per contract as a set of weekdays
-- and a price list item. Each becomes its own invoice line. Per day or visit the
-- price counts the matching days in the invoice period, and per month it's fixed.
-- A horse that is away isn't charged. Invoices already created aren't changed.

alter table public.contracts
  add column mucking_schedule text not null default 'none'
    check (mucking_schedule in ('none', 'mon_fri', 'mon_sun', 'sat_sun')),
  add column mucking_price_list_item_id uuid
    references public.price_list_items (id) on delete set null,
  add column turnout_schedule text not null default 'none'
    check (turnout_schedule in ('none', 'mon_fri', 'mon_sun', 'sat_sun')),
  add column turnout_price_list_item_id uuid
    references public.price_list_items (id) on delete set null;

create function public.schedule_days_in_period(
  p_schedule text,
  p_start date,
  p_end date
)
returns integer
language sql
immutable
set search_path = ''
as $$
  select count(*)::integer
  from generate_series(p_start, p_end, interval '1 day') as d
  where case p_schedule
    when 'mon_fri' then extract(isodow from d) between 1 and 5
    when 'mon_sun' then true
    when 'sat_sun' then extract(isodow from d) in (6, 7)
    else false
  end;
$$;

-- The price list price is without VAT, like hay and bedding.
create function public.contract_service_amount(
  p_schedule text,
  p_price numeric,
  p_unit text,
  p_start date,
  p_end date,
  p_vat_code text
)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case
    when p_schedule = 'none' or p_price is null then 0
    else round(
      (case lower(coalesce(p_unit, ''))
        when 'per month' then p_price
        when 'per week' then p_price * (p_end - p_start + 1) / 7
        else p_price * public.schedule_days_in_period(p_schedule, p_start, p_end)
      end)
      * (case when p_vat_code = 'standard' then 1.25 else 1 end),
      2
    )
  end;
$$;

create function public.contract_service_label(
  p_name text,
  p_schedule text,
  p_unit text,
  p_start date,
  p_end date,
  p_norwegian boolean
)
returns text
language sql
immutable
set search_path = ''
as $$
  select p_name || ' (' ||
    case p_schedule
      when 'mon_fri' then case when p_norwegian then 'man–fre' else 'Mon–Fri' end
      when 'mon_sun' then case when p_norwegian then 'man–søn' else 'Mon–Sun' end
      when 'sat_sun' then case when p_norwegian then 'lør–søn' else 'Sat–Sun' end
      else ''
    end ||
    case when lower(coalesce(p_unit, '')) in ('per month', 'per week') then ''
      else ', ' || public.schedule_days_in_period(p_schedule, p_start, p_end)::text
        || case when p_norwegian then ' dager' else ' days' end
    end || ')';
$$;

revoke execute on function public.schedule_days_in_period(text, date, date) from public, anon, authenticated;
revoke execute on function public.contract_service_amount(text, numeric, text, date, date, text) from public, anon, authenticated;
revoke execute on function public.contract_service_label(text, text, text, date, date, boolean) from public, anon, authenticated;

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
begin
  for v_contract in
    select
      c.id, c.stable_id, c.owner_id, c.monthly_rent, c.status,
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
    where c.status = 'active'
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
    continue when v_due_date - current_date > 8;

    continue when v_contract.status <> 'active' and not exists (
      select 1 from public.invoice_extras ie
      where ie.contract_id = v_contract.id
        and ie.payment_id is null
        and ie.bills_on <= v_due_date
    );
    continue when exists (
      select 1 from public.payments p
      where p.contract_id = v_contract.id and p.due_date = v_due_date
    );
    -- Moving the charge day must not bill a second rent within the same
    -- month, whether the other invoice falls before or after this one. Anything
    -- waiting stays queued for the next invoice.
    continue when v_contract.status = 'active' and exists (
      select 1 from public.payments p
      where p.contract_id = v_contract.id
        and p.due_date > v_due_date - 28
        and p.due_date < v_due_date + 28
    );

    v_period_start := (v_due_date - interval '1 month')::date + 1;
    v_cycle_days := v_due_date - v_period_start + 1;
    v_bedding_amount := 0;
    v_hay_amount := 0;
    v_rent := 0;
    v_mucking_amount := 0;
    v_turnout_amount := 0;
    v_notes := null;

    if v_contract.status <> 'active' then
      null;
    elsif v_contract.horse_away then
      v_rent := coalesce(v_contract.empty_box_price, 0);
      v_rent_label := 'Tom boks (hest borte)';
      v_rent_code := public.invoice_vat_code(v_contract.stable_id, v_contract.empty_box_vat_code);
      v_notes := case
        when coalesce(v_contract.empty_box_vat_exempt, false) and public.stable_vat_registered(v_contract.stable_id)
          then 'Tom boks (hest borte, uten mva)'
        else 'Tom boks (hest borte)'
      end;
    else
      v_rent := v_contract.monthly_rent;
      v_rent_label := 'Månedlig oppstalling';
      v_rent_code := public.invoice_vat_code(v_contract.stable_id, v_contract.boarding_item_vat_code);
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
        v_period_start, v_due_date, public.invoice_vat_code(v_contract.stable_id, v_contract.mucking_vat_code));
      v_turnout_amount := public.contract_service_amount(v_contract.turnout_schedule, v_contract.turnout_price, v_contract.turnout_unit,
        v_period_start, v_due_date, public.invoice_vat_code(v_contract.stable_id, v_contract.turnout_vat_code));
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
          || public.contract_service_label('Møkking', v_contract.mucking_schedule, v_contract.mucking_unit, v_period_start, v_due_date, true)
          || (case public.invoice_vat_code(v_contract.stable_id, v_contract.mucking_vat_code)
               when 'standard' then ' (inkl. 25 % mva)'
               when 'exempt' then ' (uten mva)'
               else ''
             end)
          || ' — ' || to_char(v_mucking_amount, 'FM999999990.00');
      end if;
      if v_turnout_amount > 0 then
        v_notes := v_notes || chr(10)
          || public.contract_service_label('Inn- og utslipp', v_contract.turnout_schedule, v_contract.turnout_unit, v_period_start, v_due_date, true)
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
        || to_char(v_due_date, 'DD.MM.YYYY') || ': ' || v_notes;
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
      invoice_email_required
    ) values (
      v_contract.stable_id,
      v_contract.id,
      v_contract.owner_id,
      v_rent + v_hay_amount + v_bedding_amount + v_mucking_amount + v_turnout_amount,
      v_due_date,
      'due',
      'INV-' || to_char(v_due_date, 'YYYYMM') || '-' || lpad(v_sequence::text, 3, '0'),
      v_notes,
      true
    )
    returning id into v_payment_id;

    v_position := 0;
    if v_rent > 0 then
      v_position := v_position + 1;
      perform public.add_invoice_line(v_payment_id, v_contract.stable_id, v_position,
        v_rent_label, v_period_start, v_due_date, v_rent_code, v_rent);
    end if;
    if v_hay_amount > 0 then
      v_position := v_position + 1;
      perform public.add_invoice_line(v_payment_id, v_contract.stable_id, v_position,
        'Høy', v_period_start, v_due_date,
        public.invoice_vat_code(v_contract.stable_id, v_contract.hay_item_vat_code), v_hay_amount);
    end if;
    if v_bedding_amount > 0 then
      v_position := v_position + 1;
      perform public.add_invoice_line(v_payment_id, v_contract.stable_id, v_position,
        'Strø', v_period_start, v_due_date,
        public.invoice_vat_code(v_contract.stable_id, v_contract.bedding_item_vat_code), v_bedding_amount);
    end if;
    if v_mucking_amount > 0 then
      v_position := v_position + 1;
      perform public.add_invoice_line(v_payment_id, v_contract.stable_id, v_position,
        public.contract_service_label('Møkking', v_contract.mucking_schedule, v_contract.mucking_unit, v_period_start, v_due_date, true),
        v_period_start, v_due_date,
        public.invoice_vat_code(v_contract.stable_id, v_contract.mucking_vat_code), v_mucking_amount);
    end if;
    if v_turnout_amount > 0 then
      v_position := v_position + 1;
      perform public.add_invoice_line(v_payment_id, v_contract.stable_id, v_position,
        public.contract_service_label('Inn- og utslipp', v_contract.turnout_schedule, v_contract.turnout_unit, v_period_start, v_due_date, true),
        v_period_start, v_due_date,
        public.invoice_vat_code(v_contract.stable_id, v_contract.turnout_vat_code), v_turnout_amount);
    end if;

    with claimed as (
      update public.invoice_extras ie
      set payment_id = v_payment_id
      where ie.contract_id = v_contract.id
        and ie.payment_id is null
        and ie.bills_on <= v_due_date
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
    where c.status = 'active'
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
