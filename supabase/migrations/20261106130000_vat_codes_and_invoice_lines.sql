-- VAT codes and real invoice lines. Each price list item gets a VAT code, chosen
-- with the stable's accountant, and each new add-on invoice stores its lines with
-- period, code, rate, net and VAT, so credit notes and reports can refer to them.
-- Invoices already created have no lines and keep showing their text.
--
-- vat_exempt stays and follows vat_code, because older iPhone builds still use it.

alter table public.price_list_items
  add column vat_code text not null default 'standard'
    check (vat_code in ('standard', 'exempt', 'none'));

update public.price_list_items
set vat_code = 'exempt'
where vat_exempt;

create function public.sync_price_list_vat()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- An older app only knows vat_exempt, so a change there moves the code.
  if tg_op = 'INSERT' then
    if new.vat_exempt and new.vat_code = 'standard' then
      new.vat_code := 'exempt';
    end if;
  elsif new.vat_code is not distinct from old.vat_code
    and new.vat_exempt is distinct from old.vat_exempt then
    new.vat_code := case when new.vat_exempt then 'exempt' else 'standard' end;
  end if;
  new.vat_exempt := new.vat_code <> 'standard';
  return new;
end;
$$;

create trigger trg_price_list_items_sync_vat
before insert or update on public.price_list_items
for each row execute function public.sync_price_list_vat();

-- An extra keeps the code it had when it was bought, matching what it was priced at.
alter table public.invoice_extras
  add column vat_code text
    check (vat_code in ('standard', 'exempt', 'none'));

update public.invoice_extras ie
set vat_code = case
  when not public.stable_vat_registered(ie.stable_id) then 'none'
  else coalesce(
    (select pli.vat_code from public.price_list_items pli where pli.id = ie.price_list_item_id),
    'standard'
  )
end
where ie.payment_id is null;

create table public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete cascade,
  stable_id uuid not null references public.stables (id) on delete cascade,
  position integer not null,
  description text not null,
  period_start date,
  period_end date,
  vat_code text not null check (vat_code in ('standard', 'exempt', 'none')),
  vat_rate numeric(5, 2) not null,
  amount_net numeric(10, 2) not null,
  vat_amount numeric(10, 2) not null,
  amount_gross numeric(10, 2) not null,
  created_at timestamptz not null default now(),
  unique (payment_id, position),
  check (amount_net + vat_amount = amount_gross)
);

create index invoice_lines_stable_idx on public.invoice_lines (stable_id);

alter table public.invoice_lines enable row level security;

-- Whoever can see the invoice can see its lines.
create policy "invoice_lines_select_with_invoice"
on public.invoice_lines for select
using (
  exists (select 1 from public.payments p where p.id = invoice_lines.payment_id)
);

revoke insert, update, delete on public.invoice_lines from anon, authenticated;

create function public.invoice_vat_code(p_stable_id uuid, p_item_code text)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when not public.stable_vat_registered(p_stable_id) then 'none'
    else coalesce(p_item_code, 'standard')
  end;
$$;

-- Amounts on invoices include VAT, so net and VAT are worked out from the total.
-- Net is rounded and VAT takes the rest, so the two always add up to the total.
create function public.add_invoice_line(
  p_payment_id uuid,
  p_stable_id uuid,
  p_position integer,
  p_description text,
  p_period_start date,
  p_period_end date,
  p_vat_code text,
  p_amount_gross numeric
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_rate numeric(5, 2) := case when p_vat_code = 'standard' then 25 else 0 end;
  v_net numeric(10, 2) := round(p_amount_gross / (1 + v_rate / 100), 2);
begin
  insert into public.invoice_lines (
    payment_id, stable_id, position, description, period_start, period_end,
    vat_code, vat_rate, amount_net, vat_amount, amount_gross
  ) values (
    p_payment_id, p_stable_id, p_position, p_description, p_period_start, p_period_end,
    p_vat_code, v_rate, v_net, p_amount_gross - v_net, p_amount_gross
  );
end;
$$;

revoke execute on function public.sync_price_list_vat() from public, anon, authenticated;
revoke execute on function public.invoice_vat_code(uuid, text) from public, anon, authenticated;
revoke execute on function public.add_invoice_line(uuid, uuid, integer, text, date, date, text, numeric) from public, anon, authenticated;

create or replace function public.queue_invoice_extra(
  p_contract_id uuid,
  p_price_list_item_id uuid,
  p_quantity numeric,
  p_purchased_on date,
  p_description text
)
returns table (id uuid, amount numeric, bills_on date)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stable_id uuid := public.auth_stable_id();
  v_stable_charge_day integer;
  v_charge_day integer;
  v_price numeric;
  v_vat_code text;
begin
  if public.auth_role() is null
    or public.auth_role() not in ('stable_owner', 'stable_employee') then
    raise exception 'Only stable staff can do this';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'The quantity must be above zero';
  end if;
  if p_purchased_on is null then
    raise exception 'The date is required';
  end if;

  select spa.charge_day into v_stable_charge_day
  from public.stable_payment_accounts spa
  where spa.stable_id = v_stable_id and spa.addon_enabled;
  if not found then
    raise exception 'The payments add-on is not enabled';
  end if;

  select coalesce(c.charge_day, v_stable_charge_day) into v_charge_day
  from public.contracts c
  where c.id = p_contract_id and c.stable_id = v_stable_id;
  if not found then
    raise exception 'Contract not found';
  end if;

  select pli.price, public.invoice_vat_code(v_stable_id, pli.vat_code) into v_price, v_vat_code
  from public.price_list_items pli
  where pli.id = p_price_list_item_id and pli.stable_id = v_stable_id;
  if not found then
    raise exception 'Price list item not found';
  end if;

  return query
  insert into public.invoice_extras as ie (
    stable_id, contract_id, price_list_item_id, description, amount,
    purchased_on, bills_on, created_by, vat_code
  ) values (
    v_stable_id,
    p_contract_id,
    p_price_list_item_id,
    p_description,
    round(
      coalesce(v_price, 0) * p_quantity
        * (case when v_vat_code = 'standard' then 1.25 else 1 end),
      2
    ),
    p_purchased_on,
    public.extra_billing_date(p_purchased_on, v_charge_day),
    auth.uid(),
    v_vat_code
  )
  returning ie.id, ie.amount, ie.bills_on;
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
    elsif v_rent + v_hay_amount + v_bedding_amount = 0 then
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
