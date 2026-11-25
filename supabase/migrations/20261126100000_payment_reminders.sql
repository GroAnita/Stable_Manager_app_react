-- Reminders to horse owners about unpaid invoices, as notifications (which the
-- push trigger also sends to their phones): 3 days before the due date, on the
-- due date, and once 3 days after. In each owner's own language.
--
-- Skipped: paid or fully credited invoices, invoices on a contract with an
-- active card agreement (the stable charges those), and closed stables.
-- payment_reminders records what was sent, so nothing is sent twice.
create table public.payment_reminders (
  payment_id uuid not null references public.payments(id) on delete cascade,
  kind text not null check (kind in ('before', 'due', 'overdue')),
  sent_at timestamptz not null default now(),
  primary key (payment_id, kind)
);

alter table public.payment_reminders enable row level security;
-- Only the job below writes and reads it; no policies for app users.

-- "3 238 kr" / "6 931,25 kr", or "NOK 3,238" / "NOK 6,931.25".
create function public.notice_amount(p_amount numeric, p_language text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_language = 'en' then 'NOK ' || case
      when p_amount = trunc(p_amount) then to_char(p_amount, 'FM999,999,990')
      else to_char(p_amount, 'FM999,999,990.00') end
    else replace(replace(replace(case
      when p_amount = trunc(p_amount) then to_char(p_amount, 'FM999,999,990')
      else to_char(p_amount, 'FM999,999,990.00') end,
      ',', '#'), '.', ','), '#', ' ') || ' kr'
  end;
$$;

revoke execute on function public.notice_amount(numeric, text) from public, anon, authenticated;

create function public.send_payment_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Europe/Oslo')::date;
  v_row record;
  v_lang text;
  v_amount text;
  v_number text;
  v_count integer := 0;
begin
  for v_row in
    select p.id, p.stable_id, p.owner_id, p.invoice_number, p.due_date,
      p.amount - coalesce(p.credited_amount, 0) as amount_due,
      case
        when p.due_date between v_today + 1 and v_today + 3 then 'before'
        when p.due_date = v_today then 'due'
        when p.due_date between v_today - 7 and v_today - 3 then 'overdue'
      end as kind
    from public.payments p
    join public.stables s on s.id = p.stable_id
    where p.status in ('due', 'overdue')
      and p.owner_id is not null
      and s.closed_at is null
      and p.amount - coalesce(p.credited_amount, 0) > 0
      and p.due_date between v_today - 7 and v_today + 3
      and not exists (
        select 1 from public.card_agreements ca
        where ca.contract_id = p.contract_id
          and ca.activated_at is not null
          and ca.withdrawn_at is null
          and ca.paused_at is null
      )
  loop
    continue when v_row.kind is null;
    continue when exists (
      select 1 from public.payment_reminders r
      where r.payment_id = v_row.id and r.kind = v_row.kind
    );
    -- Only the most recent reminder for an invoice: a late first run shouldn't
    -- send "due soon" after "due today".
    continue when v_row.kind = 'before' and exists (
      select 1 from public.payment_reminders r
      where r.payment_id = v_row.id and r.kind in ('due', 'overdue')
    );

    v_lang := public.owner_language(v_row.owner_id);
    v_amount := public.notice_amount(v_row.amount_due, v_lang);
    v_number := coalesce(
      nullif(v_row.invoice_number, ''),
      case when v_lang = 'en' then 'Your invoice' else 'Fakturaen' end
    );

    insert into public.notifications (stable_id, owner_id, notification_type, title, message)
    values (
      v_row.stable_id, v_row.owner_id, 'payment_due',
      case v_row.kind
        when 'before' then case when v_lang = 'en' then 'Stall rent due soon' else 'Stalleie forfaller snart' end
        when 'due' then case when v_lang = 'en' then 'Stall rent due today' else 'Stalleie forfaller i dag' end
        else case when v_lang = 'en' then 'Stall rent not paid' else 'Stalleien er ikke betalt' end
      end,
      case v_row.kind
        when 'before' then case when v_lang = 'en'
          then v_number || ' of ' || v_amount || ' is due on ' || public.notice_date(v_row.due_date, v_lang) || '.'
          else v_number || ' på ' || v_amount || ' forfaller ' || public.notice_date(v_row.due_date, v_lang) || '.' end
        when 'due' then case when v_lang = 'en'
          then v_number || ' of ' || v_amount || ' is due today.'
          else v_number || ' på ' || v_amount || ' forfaller i dag.' end
        else case when v_lang = 'en'
          then v_number || ' of ' || v_amount || ' was due on ' || public.notice_date(v_row.due_date, v_lang) || '. If you have already paid, please contact the stable.'
          else v_number || ' på ' || v_amount || ' forfalt ' || public.notice_date(v_row.due_date, v_lang) || '. Har du allerede betalt, kan du ta kontakt med stallen.' end
      end
    );
    insert into public.payment_reminders (payment_id, kind) values (v_row.id, v_row.kind);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke execute on function public.send_payment_reminders() from public, anon, authenticated;

-- 07:00 UTC is 08:00 in Norway in winter and 09:00 in summer.
select cron.schedule(
  'send-payment-reminders',
  '0 7 * * *',
  $$select public.send_payment_reminders();$$
);
