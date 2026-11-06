-- Credit notes and additional invoices. A sent invoice is never changed: a credit
-- note reduces it, in full or line by line, and an additional invoice adds to it.
-- Credit notes have their own running number series per stable. A refund is still
-- done in Stripe and recorded separately, because the credit note corrects the sale
-- and the refund only moves the money.

alter table public.payments
  add column credited_amount numeric(10, 2) not null default 0,
  -- The part credited once the invoice was already paid, so it should go back.
  add column credited_after_payment numeric(10, 2) not null default 0,
  add column corrects_payment_id uuid references public.payments (id) on delete set null;

create table public.credit_note_counters (
  stable_id uuid primary key references public.stables (id) on delete cascade,
  last_number integer not null default 0
);

alter table public.credit_note_counters enable row level security;
revoke all on public.credit_note_counters from anon, authenticated;

create table public.credit_notes (
  id uuid primary key default gen_random_uuid(),
  stable_id uuid not null references public.stables (id) on delete cascade,
  payment_id uuid not null references public.payments (id) on delete cascade,
  credit_note_number text not null,
  issued_on date not null,
  reason text not null check (length(trim(reason)) > 0),
  amount_net numeric(10, 2) not null,
  vat_amount numeric(10, 2) not null,
  amount_gross numeric(10, 2) not null check (amount_gross > 0),
  invoice_was_paid boolean not null,
  email_sent_at timestamptz,
  email_sent_to text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (stable_id, credit_note_number)
);

create index credit_notes_payment_idx on public.credit_notes (payment_id);

create table public.credit_note_lines (
  id uuid primary key default gen_random_uuid(),
  credit_note_id uuid not null references public.credit_notes (id) on delete cascade,
  invoice_line_id uuid not null references public.invoice_lines (id) on delete cascade,
  position integer not null,
  description text not null,
  vat_code text not null,
  vat_rate numeric(5, 2) not null,
  amount_net numeric(10, 2) not null,
  vat_amount numeric(10, 2) not null,
  amount_gross numeric(10, 2) not null check (amount_gross > 0),
  unique (credit_note_id, position),
  check (amount_net + vat_amount = amount_gross)
);

create index credit_note_lines_invoice_line_idx on public.credit_note_lines (invoice_line_id);

alter table public.credit_notes enable row level security;
alter table public.credit_note_lines enable row level security;

-- Whoever can see the invoice can see its credit notes.
create policy "credit_notes_select_with_invoice"
on public.credit_notes for select
using (exists (select 1 from public.payments p where p.id = credit_notes.payment_id));

create policy "credit_note_lines_select_with_note"
on public.credit_note_lines for select
using (exists (select 1 from public.credit_notes n where n.id = credit_note_lines.credit_note_id));

revoke insert, update, delete on public.credit_notes from anon, authenticated;
revoke insert, update, delete on public.credit_note_lines from anon, authenticated;

create function public.apply_credit_note_to_invoice()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.payments
  set credited_amount = credited_amount + new.amount_gross,
      credited_after_payment = credited_after_payment
        + case when new.invoice_was_paid then new.amount_gross else 0 end
  where id = new.payment_id;
  return new;
end;
$$;

revoke execute on function public.apply_credit_note_to_invoice() from public, anon, authenticated;

create trigger trg_credit_notes_apply
after insert on public.credit_notes
for each row execute function public.apply_credit_note_to_invoice();

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
    or new.corrects_payment_id is distinct from old.corrects_payment_id then
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
        and p.corrects_payment_id is null
    );
    -- Moving the charge day must not bill a second rent within the same
    -- month, whether the other invoice falls before or after this one. Anything
    -- waiting stays queued for the next invoice.
    continue when v_contract.status = 'active' and exists (
      select 1 from public.payments p
      where p.contract_id = v_contract.id
        and p.due_date > v_due_date - 28
        and p.due_date < v_due_date + 28
        and p.corrects_payment_id is null
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

-- p_lines holds what to credit: [{ "line_id": "...", "amount_gross": 100 }]. Crediting
-- all that's left of a line uses up its exact net and VAT, so rounding can't leave
-- an øre behind.
create function public.create_credit_note(
  p_payment_id uuid,
  p_reason text,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stable_id uuid := public.auth_stable_id();
  v_payment public.payments%rowtype;
  v_note_id uuid := gen_random_uuid();
  v_number integer;
  v_request record;
  v_line public.invoice_lines%rowtype;
  v_credited_net numeric(10, 2);
  v_credited_gross numeric(10, 2);
  v_remaining_gross numeric(10, 2);
  v_net numeric(10, 2);
  v_position integer := 0;
  v_total_net numeric(10, 2) := 0;
  v_total_gross numeric(10, 2) := 0;
  v_rows jsonb := '[]'::jsonb;
begin
  if public.auth_role() is distinct from 'stable_owner' then
    raise exception 'Only the stable owner can do this';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'credit_note_reason_required';
  end if;

  -- Locking the invoice means two credit notes can't both use the same amount.
  select * into v_payment from public.payments
  where id = p_payment_id and stable_id = v_stable_id
  for update;
  if not found then
    raise exception 'Invoice not found';
  end if;
  if v_payment.charge_status = 'processing' then
    raise exception 'charge_in_progress';
  end if;

  for v_request in
    select r.line_id, r.amount_gross
    from jsonb_to_recordset(coalesce(p_lines, '[]'::jsonb))
      as r(line_id uuid, amount_gross numeric)
  loop
    select * into v_line from public.invoice_lines
    where id = v_request.line_id and payment_id = p_payment_id;
    if not found then
      raise exception 'credit_note_line_not_on_invoice';
    end if;
    if v_request.amount_gross is null
      or v_request.amount_gross <= 0
      or round(v_request.amount_gross, 2) <> v_request.amount_gross then
      raise exception 'credit_note_amount_invalid';
    end if;

    select coalesce(sum(cl.amount_net), 0), coalesce(sum(cl.amount_gross), 0)
    into v_credited_net, v_credited_gross
    from public.credit_note_lines cl
    where cl.invoice_line_id = v_line.id;
    v_remaining_gross := v_line.amount_gross - v_credited_gross;
    if v_rows @> jsonb_build_array(jsonb_build_object('line_id', v_line.id)) then
      raise exception 'credit_note_line_repeated';
    end if;
    if v_request.amount_gross > v_remaining_gross then
      raise exception 'credit_note_amount_too_high';
    end if;

    v_net := case
      when v_request.amount_gross = v_remaining_gross
        then v_line.amount_net - v_credited_net
      else round(v_request.amount_gross / (1 + v_line.vat_rate / 100), 2)
    end;

    v_position := v_position + 1;
    v_rows := v_rows || jsonb_build_array(jsonb_build_object(
      'line_id', v_line.id,
      'position', v_position,
      'description', v_line.description,
      'vat_code', v_line.vat_code,
      'vat_rate', v_line.vat_rate,
      'net', v_net,
      'gross', v_request.amount_gross
    ));
    v_total_net := v_total_net + v_net;
    v_total_gross := v_total_gross + v_request.amount_gross;
  end loop;

  if v_position = 0 then
    raise exception 'credit_note_lines_required';
  end if;

  -- Taken last, so a refused credit note doesn't use up a number.
  insert into public.credit_note_counters (stable_id, last_number)
  values (v_stable_id, 1)
  on conflict (stable_id) do update
    set last_number = public.credit_note_counters.last_number + 1
  returning last_number into v_number;

  insert into public.credit_notes (
    id, stable_id, payment_id, credit_note_number, issued_on, reason,
    amount_net, vat_amount, amount_gross, invoice_was_paid, created_by
  ) values (
    v_note_id, v_stable_id, p_payment_id, 'K-' || lpad(v_number::text, 6, '0'),
    (now() at time zone 'Europe/Oslo')::date, trim(p_reason),
    v_total_net, v_total_gross - v_total_net, v_total_gross,
    v_payment.status = 'paid', auth.uid()
  );

  insert into public.credit_note_lines (
    credit_note_id, invoice_line_id, position, description, vat_code, vat_rate,
    amount_net, vat_amount, amount_gross
  )
  select v_note_id, r.line_id, r.position, r.description, r.vat_code, r.vat_rate,
    r.net, r.gross - r.net, r.gross
  from jsonb_to_recordset(v_rows) as r(
    line_id uuid, position integer, description text, vat_code text,
    vat_rate numeric, net numeric, gross numeric
  );

  return v_note_id;
end;
$$;

revoke execute on function public.create_credit_note(uuid, text, jsonb) from public, anon;
grant execute on function public.create_credit_note(uuid, text, jsonb) to authenticated;

-- For when an invoice charged too little. It's a normal invoice of its own, with the
-- usual notice before any charge, so its due date must leave room for that.
create function public.create_additional_invoice(
  p_payment_id uuid,
  p_description text,
  p_amount_gross numeric,
  p_vat_code text,
  p_period_start date,
  p_period_end date,
  p_due_date date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stable_id uuid := public.auth_stable_id();
  v_original public.payments%rowtype;
  v_today date := (now() at time zone 'Europe/Oslo')::date;
  v_code text;
  v_sequence integer;
  v_description text;
  v_payment_id uuid;
begin
  if public.auth_role() is distinct from 'stable_owner' then
    raise exception 'Only the stable owner can do this';
  end if;
  select * into v_original from public.payments
  where id = p_payment_id and stable_id = v_stable_id;
  if not found then
    raise exception 'Invoice not found';
  end if;
  if not public.stable_has_payments_addon(v_stable_id) then
    raise exception 'The payments add-on is not enabled';
  end if;
  if p_description is null or length(trim(p_description)) = 0 then
    raise exception 'additional_invoice_description_required';
  end if;
  if p_amount_gross is null or p_amount_gross <= 0
    or round(p_amount_gross, 2) <> p_amount_gross then
    raise exception 'credit_note_amount_invalid';
  end if;
  if p_vat_code is null or p_vat_code not in ('standard', 'exempt', 'none') then
    raise exception 'additional_invoice_vat_code_invalid';
  end if;
  if p_period_start is null or p_period_end is null or p_period_end < p_period_start then
    raise exception 'additional_invoice_period_invalid';
  end if;
  if p_due_date is null or p_due_date < v_today + 8 then
    raise exception 'additional_invoice_due_too_soon';
  end if;

  v_code := public.invoice_vat_code(v_stable_id, p_vat_code);
  v_description := trim(p_description)
    || ' (tillegg til ' || coalesce(v_original.invoice_number, 'faktura') || ')';

  select coalesce(
    max(substring(invoice_number from '^INV-[0-9]{6}-([0-9]+)')::int),
    0
  ) + 1 into v_sequence
  from public.payments
  where stable_id = v_stable_id
    and invoice_number like 'INV-' || to_char(p_due_date, 'YYYYMM') || '-%';

  insert into public.payments (
    stable_id, contract_id, owner_id, amount, due_date, status, invoice_number, notes,
    invoice_email_required, corrects_payment_id
  ) values (
    v_stable_id, v_original.contract_id, v_original.owner_id, p_amount_gross, p_due_date, 'due',
    'INV-' || to_char(p_due_date, 'YYYYMM') || '-' || lpad(v_sequence::text, 3, '0'),
    v_description || ' — ' || to_char(p_amount_gross, 'FM999999990.00'),
    true, p_payment_id
  )
  returning id into v_payment_id;

  perform public.add_invoice_line(v_payment_id, v_stable_id, 1, v_description,
    p_period_start, p_period_end, v_code, p_amount_gross);

  return v_payment_id;
end;
$$;

revoke execute on function public.create_additional_invoice(uuid, text, numeric, text, date, date, date) from public, anon;
grant execute on function public.create_additional_invoice(uuid, text, numeric, text, date, date, date) to authenticated;

-- A fully credited invoice has nothing left to pay, so it can't become overdue.
create or replace function public.refresh_overdue_payments()
returns void
language sql
security definer
set search_path to 'public'
as $$
  update public.payments
  set status = 'overdue'
  where status = 'due' and due_date < current_date - 7 and credited_amount < amount;
$$;

create or replace view public.payment_summary
with (security_invoker = true) as
select
  coalesce(
    sum(amount - (credited_amount - credited_after_payment)) filter (
      where status = 'paid'
        and paid_date >= date_trunc('month', current_date)
    ),
    0
  ) as paid_this_month,
  coalesce(sum(amount - credited_amount) filter (where status = 'due'), 0) as total_due,
  coalesce(sum(amount - credited_amount) filter (where status = 'overdue'), 0) as total_overdue
from public.payments
where stable_id = (
  select stable_id from public.profiles where id = auth.uid()
);

create or replace view public.dashboard_stats
with (security_invoker = true) as
select
  (select count(*) from horses where horses.active = true) as total_horses,
  (select count(*) from stalls where stalls.status = 'occupied') as occupied_stalls,
  (select count(*) from stalls where stalls.status = 'available') as available_stalls,
  (select count(*) from payments
    where payments.status = 'due'
      and payments.credited_amount < payments.amount
      and payments.due_date >= current_date
      and payments.due_date <= (current_date + interval '7 days')) as upcoming_payments,
  (select count(*) from payments
    where payments.credited_amount < payments.amount
      and (payments.status = 'overdue'
        or (payments.status = 'due' and payments.due_date < current_date - 7))) as overdue_payments,
  (select count(*) from tasks
    where tasks.completed = false and tasks.due_date = current_date) as today_tasks,
  (select count(*) from calendar_events
    where calendar_events.event_type = 'vet'
      and calendar_events.start_time >= now()
      and calendar_events.start_time <= (now() + interval '14 days')) as upcoming_vet_visits,
  (select count(*) from calendar_events
    where calendar_events.event_type = 'farrier'
      and calendar_events.start_time >= now()
      and calendar_events.start_time <= (now() + interval '14 days')) as upcoming_farrier_visits;

create or replace view public.overdue_payments_list
with (security_invoker = true) as
select
  p.id, p.stable_id, p.contract_id, p.owner_id, p.amount, p.due_date,
  p.paid_date, p.payment_method, p.invoice_number, p.status, p.notes,
  p.created_at, p.updated_at,
  h.name as horse_name,
  o.full_name as owner_name
from payments p
join contracts c on c.id = p.contract_id
join horses h on h.id = c.horse_id
join owners o on o.id = p.owner_id
where p.credited_amount < p.amount
  and (p.status = 'overdue'
    or (p.status = 'due' and p.due_date < current_date - 7))
order by p.due_date;
