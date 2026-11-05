-- Billing rules for stables with the payments add-on, matching the card-charge
-- agreement boarders accept. Other stables keep today's billing unchanged.
--
-- * The owner chooses the monthly charge day (1-28, so it exists every month).
-- * A billing period runs from the day after one charge day through the next.
--   Extras go on the invoice after their period ends: with the 25th, an extra
--   bought from 26 October through 25 November is charged on 25 December.
-- * Extras wait in invoice_extras until the invoice is created, 8 days before
--   the charge day. That leaves one spare day for the 7 days' notice.
-- * An invoice can't be changed by app users once issued. Later extras go on a
--   later invoice.

alter table public.stable_payment_accounts
  add column charge_day integer not null default 25
    check (charge_day between 1 and 28);

create table public.invoice_extras (
  id uuid primary key default gen_random_uuid(),
  stable_id uuid not null references public.stables (id) on delete cascade,
  contract_id uuid not null references public.contracts (id) on delete cascade,
  price_list_item_id uuid references public.price_list_items (id) on delete set null,
  description text not null,
  amount numeric(10, 2) not null check (amount > 0),
  purchased_on date not null,
  bills_on date not null,
  payment_id uuid references public.payments (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index invoice_extras_pending_idx
on public.invoice_extras (contract_id, bills_on)
where payment_id is null;

create index invoice_extras_payment_idx
on public.invoice_extras (payment_id)
where payment_id is not null;

alter table public.invoice_extras enable row level security;

create policy "invoice_extras_select_staff"
on public.invoice_extras for select
using (
  stable_id = auth_stable_id()
  and auth_role() in ('stable_owner', 'stable_employee')
);

revoke insert, update, delete on public.invoice_extras from anon, authenticated;

create function public.stable_has_payments_addon(p_stable_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select spa.addon_enabled from public.stable_payment_accounts spa
     where spa.stable_id = p_stable_id),
    false
  );
$$;

-- The charge date an extra lands on. It moves forward if that month's invoice
-- has already been issued, so an extra logged late can't change an issued invoice.
create function public.extra_billing_date(
  p_purchased_on date,
  p_charge_day integer,
  p_today date default current_date
)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_period_end date;
  v_bills_on date;
begin
  v_period_end := make_date(
    extract(year from p_purchased_on)::int,
    extract(month from p_purchased_on)::int,
    p_charge_day
  );
  if p_purchased_on > v_period_end then
    v_period_end := (v_period_end + interval '1 month')::date;
  end if;

  v_bills_on := (v_period_end + interval '1 month')::date;
  while v_bills_on - 8 <= p_today loop
    v_bills_on := (v_bills_on + interval '1 month')::date;
  end loop;
  return v_bills_on;
end;
$$;

-- Any staff member needs these to log extras, but only owners can read
-- stable_payment_accounts directly.
create function public.get_billing_rules()
returns table (addon_enabled boolean, charge_day integer)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(spa.addon_enabled, false), coalesce(spa.charge_day, 25)
  from (select public.auth_stable_id() as stable_id) caller
  left join public.stable_payment_accounts spa
    on spa.stable_id = caller.stable_id
  where public.auth_role() in ('stable_owner', 'stable_employee');
$$;

create function public.set_charge_day(p_charge_day integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.auth_role() is distinct from 'stable_owner' then
    raise exception 'Only the stable owner can do this';
  end if;
  if p_charge_day is null or p_charge_day not between 1 and 28 then
    raise exception 'The charge day must be between 1 and 28';
  end if;

  update public.stable_payment_accounts
  set charge_day = p_charge_day
  where stable_id = public.auth_stable_id() and addon_enabled;

  if not found then
    raise exception 'The payments add-on is not enabled';
  end if;
end;
$$;

-- The amount is worked out here because it will be charged to a card.
create function public.queue_invoice_extra(
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
  v_charge_day integer;
  v_price numeric;
  v_vat_exempt boolean;
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

  select spa.charge_day into v_charge_day
  from public.stable_payment_accounts spa
  where spa.stable_id = v_stable_id and spa.addon_enabled;
  if not found then
    raise exception 'The payments add-on is not enabled';
  end if;

  perform 1 from public.contracts c
  where c.id = p_contract_id and c.stable_id = v_stable_id;
  if not found then
    raise exception 'Contract not found';
  end if;

  select pli.price, pli.vat_exempt into v_price, v_vat_exempt
  from public.price_list_items pli
  where pli.id = p_price_list_item_id and pli.stable_id = v_stable_id;
  if not found then
    raise exception 'Price list item not found';
  end if;

  return query
  insert into public.invoice_extras as ie (
    stable_id, contract_id, price_list_item_id, description, amount,
    purchased_on, bills_on, created_by
  ) values (
    v_stable_id,
    p_contract_id,
    p_price_list_item_id,
    p_description,
    round(
      coalesce(v_price, 0) * p_quantity
        * (case when coalesce(v_vat_exempt, false) then 1 else 1.25 end),
      2
    ),
    p_purchased_on,
    public.extra_billing_date(p_purchased_on, v_charge_day),
    auth.uid()
  )
  returning ie.id, ie.amount, ie.bills_on;
end;
$$;

create function public.remove_invoice_extra(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.auth_role() is null
    or public.auth_role() not in ('stable_owner', 'stable_employee') then
    raise exception 'Only stable staff can do this';
  end if;

  delete from public.invoice_extras ie
  where ie.id = p_id
    and ie.stable_id = public.auth_stable_id()
    and ie.payment_id is null;

  if not found then
    raise exception 'extra_already_invoiced';
  end if;
end;
$$;

-- Runs daily. Creates each invoice 8 days before the stable's charge day. An
-- outage could make it run later than that, so whatever charges the card must
-- check the notice actually given rather than assume it from this schedule.
create function public.generate_addon_invoices()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_stable record;
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
  for v_stable in
    select stable_id, charge_day
    from public.stable_payment_accounts
    where addon_enabled
  loop
    v_due_date := make_date(
      extract(year from current_date)::int,
      extract(month from current_date)::int,
      v_stable.charge_day
    );
    if v_due_date < current_date then
      v_due_date := (v_due_date + interval '1 month')::date;
    end if;
    continue when v_due_date - current_date > 8;

    v_period_start := (v_due_date - interval '1 month')::date + 1;
    v_cycle_days := v_due_date - v_period_start + 1;

    for v_contract in
      select
        c.id, c.stable_id, c.owner_id, c.monthly_rent, c.status,
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
      where c.stable_id = v_stable.stable_id
        and (
          c.status = 'active'
          -- An ended contract can still owe for extras that were waiting.
          or exists (
            select 1 from public.invoice_extras ie
            where ie.contract_id = c.id
              and ie.payment_id is null
              and ie.bills_on <= v_due_date
          )
        )
      order by c.id
    loop
      continue when exists (
        select 1 from public.payments p
        where p.contract_id = v_contract.id and p.due_date = v_due_date
      );
      -- Moving the charge day must not bill a second rent within the same
      -- month. Anything waiting stays queued for the next invoice.
      continue when v_contract.status = 'active' and exists (
        select 1 from public.payments p
        where p.contract_id = v_contract.id
          and p.due_date > v_due_date - 28
          and p.due_date < v_due_date
      );

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

      if v_notes is not null then
        v_notes := to_char(v_period_start, 'DD.MM.YYYY') || ' – '
          || to_char(v_due_date, 'DD.MM.YYYY') || ': ' || v_notes;
      end if;

      select count(*) + 1 into v_sequence
      from public.payments
      where stable_id = v_contract.stable_id and due_date = v_due_date;

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
  end loop;
end;
$$;

-- App users can still mark an issued invoice paid, but not change what it says
-- or delete it. Cron jobs and cascading deletes have no signed-in user or run
-- inside another trigger, so they aren't affected.
create function public.protect_addon_invoices()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
    or pg_trigger_depth() > 1
    or not public.stable_has_payments_addon(old.stable_id) then
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
    or new.stable_id is distinct from old.stable_id then
    raise exception 'invoice_locked';
  end if;
  return new;
end;
$$;

create trigger trg_protect_addon_invoices
before update or delete on public.payments
for each row execute function public.protect_addon_invoices();

-- Unchanged apart from leaving add-on stables to generate_addon_invoices.
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

revoke execute on function public.stable_has_payments_addon(uuid) from public, anon, authenticated;
revoke execute on function public.extra_billing_date(date, integer, date) from public, anon, authenticated;
revoke execute on function public.generate_addon_invoices() from public, anon, authenticated;
revoke execute on function public.generate_monthly_invoices() from public, anon, authenticated;
revoke execute on function public.protect_addon_invoices() from public, anon, authenticated;

revoke execute on function public.get_billing_rules() from public, anon;
revoke execute on function public.set_charge_day(integer) from public, anon;
revoke execute on function public.queue_invoice_extra(uuid, uuid, numeric, date, text) from public, anon;
revoke execute on function public.remove_invoice_extra(uuid) from public, anon;
grant execute on function public.get_billing_rules() to authenticated;
grant execute on function public.set_charge_day(integer) to authenticated;
grant execute on function public.queue_invoice_extra(uuid, uuid, numeric, date, text) to authenticated;
grant execute on function public.remove_invoice_extra(uuid) to authenticated;

select cron.schedule(
  'generate-addon-invoices',
  '0 5 * * *',
  $$select public.generate_addon_invoices();$$
);
