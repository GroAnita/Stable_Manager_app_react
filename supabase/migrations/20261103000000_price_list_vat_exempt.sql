-- Norwegian VAT treatment for stables isn't uniform: pure box/stall rental
-- (boksleie) is exempt as real-estate rental, while feed, bedding, care and
-- training stay taxable at 25% — but only if the exempt portion is billed
-- as a genuinely separate line, not bundled into one "oppstalling" price.
-- This lets a stable owner mark any price list item as VAT-exempt (e.g. a
-- pure box-rent or riding-lesson line) so invoices and contracts label it
-- correctly. Defaults to false so every existing item keeps today's
-- behavior (taxable, 25% VAT) until an owner opts a specific line in.
alter table public.price_list_items
  add column vat_exempt boolean not null default false;

-- Recreated with the hay/bedding VAT math and invoice note text now
-- conditional on each item's vat_exempt flag (previously always taxed at
-- 25%), and the rent/empty-box lines now note when the underlying price
-- list item is VAT-exempt.
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
    where c.status = 'active'
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
        v_rent := coalesce(v_contract.empty_box_price, 0);
        v_notes := case
          when coalesce(v_contract.empty_box_vat_exempt, false)
            then 'Empty box fee (horse away, VAT-exempt)'
          else 'Empty box fee (horse away)'
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
            then 'Monthly board fee (VAT-exempt)'
          else 'Monthly board fee'
        end;
        if v_hay_amount > 0 then
          v_notes := v_notes || chr(10)
            || (case
                 when coalesce(v_contract.hay_item_vat_exempt, false) then 'Hay (VAT-exempt) — '
                 else 'Hay (incl. 25% VAT) — '
               end)
            || to_char(v_hay_amount, 'FM999999990.00');
        end if;
        if v_bedding_amount > 0 then
          v_notes := v_notes || chr(10)
            || (case
                 when coalesce(v_contract.bedding_item_vat_exempt, false) then 'Bedding (VAT-exempt) — '
                 else 'Bedding (incl. 25% VAT) — '
               end)
            || to_char(v_bedding_amount, 'FM999999990.00');
        end if;
      end if;

      insert into public.payments (
        stable_id, contract_id, owner_id, amount, due_date, status, invoice_number, notes
      ) values (
        v_contract.stable_id,
        v_contract.id,
        v_contract.owner_id,
        v_rent + v_hay_amount + v_bedding_amount,
        v_due_date,
        'due',
        'INV-' || to_char(v_due_date, 'YYYYMM') || '-' || lpad(v_sequence::text, 3, '0'),
        v_notes
      );
    end if;
  end loop;
end;
$$;
