-- For stables with the payments add-on: the charge day is stated on each
-- contract, with the stable's day as the default for contracts without one.
-- Each invoice from generate_addon_invoices is emailed by the
-- send-invoice-emails Edge Function. Its send time and recipient are stored
-- because whatever charges the card must check that notice was really given.
--
-- Seed the secret separately, outside of migrations (never committed to git):
--   select vault.create_secret('...', 'invoice_email_trigger_secret', '...');

alter table public.contracts
  add column charge_day integer check (charge_day between 1 and 28);

alter table public.payments
  add column invoice_email_required boolean not null default false,
  add column invoice_email_sent_at timestamptz,
  add column invoice_email_sent_to text,
  add column invoice_email_error text;

create index payments_invoice_email_pending_idx
on public.payments (due_date)
where invoice_email_required and invoice_email_sent_at is null;

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
    -- month. Anything waiting stays queued for the next invoice.
    continue when v_contract.status = 'active' and exists (
      select 1 from public.payments p
      where p.contract_id = v_contract.id
        and p.due_date > v_due_date - 28
        and p.due_date < v_due_date
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

    select count(*) + 1 into v_sequence
    from public.payments
    where stable_id = v_contract.stable_id and due_date = v_due_date;

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

create function public.trigger_invoice_emails()
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
    url := 'https://kutsqjkjnzyfmoidafet.supabase.co/functions/v1/send-invoice-emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Invoice-Email-Secret', coalesce(v_secret, '')
    ),
    body := '{}'::jsonb
  );
end;
$$;

revoke execute on function public.generate_addon_invoices() from public, anon, authenticated;
revoke execute on function public.trigger_invoice_emails() from public, anon, authenticated;

-- Hourly so a failed send retries the same day. Runs start after the 05:00
-- invoice job.
select cron.schedule(
  'send-invoice-emails',
  '0 6-20 * * *',
  $$select public.trigger_invoice_emails();$$
);
