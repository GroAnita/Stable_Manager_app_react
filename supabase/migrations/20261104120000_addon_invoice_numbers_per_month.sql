-- Fixes generate_addon_invoices: invoice numbers were counted per due date, so
-- two invoices with different charge days in the same month got the same number.

-- Runs daily. Creates each invoice 8 days before the contract's charge day. An
-- outage could make it run later than that, so whatever charges the card must
-- check invoice_email_sent_at rather than assume it from this schedule.
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
  v_notes text;
  v_extras_total numeric(10, 2);
  v_extra_lines text;
  v_payment_id uuid;
begin
  for v_contract in
    select
      c.id, c.stable_id, c.owner_id, c.monthly_rent, c.status,
      coalesce(c.charge_day, spa.charge_day) as charge_day,
      h.away as horse_away,
      c.bedding_quantity, bpli.price as bedding_item_price, bpli.vat_exempt as bedding_item_vat_exempt,
      c.included_hay_kg, hpli.price as hay_item_price, hpli.vat_exempt as hay_item_vat_exempt,
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
    join public.stable_payment_accounts spa
      on spa.stable_id = c.stable_id and spa.addon_enabled
    join public.horses h on h.id = c.horse_id
    left join public.price_list_items bpli on bpli.id = c.bedding_price_list_item_id
    left join public.price_list_items hpli on hpli.id = c.hay_price_list_item_id
    left join public.price_list_items rpli on rpli.id = c.boarding_price_list_item_id
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
    v_notes := null;

    if v_contract.status <> 'active' then
      null;
    elsif v_contract.horse_away then
      v_rent := coalesce(v_contract.empty_box_price, 0);
      v_notes := case
        when coalesce(v_contract.empty_box_vat_exempt, false)
          then 'Tom boks (hest borte, mva-fritatt)'
        else 'Tom boks (hest borte)'
      end;
    else
      v_rent := v_contract.monthly_rent;
      v_bedding_amount := round(
        coalesce(v_contract.bedding_quantity, 0) * coalesce(v_contract.bedding_item_price, 0)
          * (case when coalesce(v_contract.bedding_item_vat_exempt, false) then 1 else 1.25 end),
        2
      );
      v_hay_amount := round(
        coalesce(v_contract.included_hay_kg, 0) * v_cycle_days
          * coalesce(v_contract.hay_item_price, 0)
          * (case when coalesce(v_contract.hay_item_vat_exempt, false) then 1 else 1.25 end),
        2
      );
      v_notes := case
        when coalesce(v_contract.boarding_item_vat_exempt, false)
          then 'Månedlig oppstalling (mva-fritatt)'
        else 'Månedlig oppstalling'
      end;
      if v_hay_amount > 0 then
        v_notes := v_notes || chr(10)
          || (case
               when coalesce(v_contract.hay_item_vat_exempt, false) then 'Høy (mva-fritatt) — '
               else 'Høy (inkl. 25 % mva) — '
             end)
          || to_char(v_hay_amount, 'FM999999990.00');
      end if;
      if v_bedding_amount > 0 then
        v_notes := v_notes || chr(10)
          || (case
               when coalesce(v_contract.bedding_item_vat_exempt, false) then 'Strø (mva-fritatt) — '
               else 'Strø (inkl. 25 % mva) — '
             end)
          || to_char(v_bedding_amount, 'FM999999990.00');
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
      v_rent + v_hay_amount + v_bedding_amount,
      v_due_date,
      'due',
      'INV-' || to_char(v_due_date, 'YYYYMM') || '-' || lpad(v_sequence::text, 3, '0'),
      v_notes,
      true
    )
    returning id into v_payment_id;

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

    if v_extras_total > 0 then
      update public.payments p
      set amount = p.amount + v_extras_total,
          notes = case
            when p.notes is null then v_extra_lines
            else p.notes || chr(10) || v_extra_lines
          end
      where p.id = v_payment_id;
    elsif v_rent + v_hay_amount + v_bedding_amount = 0 then
      -- Nothing to bill, such as an empty box with no price set.
      delete from public.payments p where p.id = v_payment_id;
    end if;
  end loop;
end;
$$;
