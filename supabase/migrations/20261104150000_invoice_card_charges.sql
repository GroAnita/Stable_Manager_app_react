-- Charging an invoice to a boarder's saved card. A charge is claimed here before
-- Stripe is called, so a double click or two staff members can't charge twice.
-- App users can read these columns; only Edge Functions can change them.

alter table public.payments
  add column charge_status text
    check (charge_status in ('processing', 'succeeded', 'failed')),
  add column charge_attempts integer not null default 0,
  add column charge_error text,
  add column charge_started_at timestamptz,
  add column charged_at timestamptz,
  add column stripe_payment_intent_id text unique;

-- Returns the attempt number to charge under, or null if the invoice can't be
-- claimed. A claim stuck with no Stripe payment means the function died or lost
-- contact with Stripe. It keeps its attempt number, so Stripe's idempotency key
-- returns the original payment if one was in fact created.
create function public.claim_invoice_charge(p_payment_id uuid)
returns integer
language sql
security definer
set search_path = ''
as $$
  update public.payments p
  set charge_status = 'processing',
      charge_started_at = now(),
      charge_error = null,
      stripe_payment_intent_id = null,
      charge_attempts = case
        when p.charge_status = 'processing' then p.charge_attempts
        else p.charge_attempts + 1
      end
  where p.id = p_payment_id
    and p.status <> 'paid'
    and (
      p.charge_status is null
      or p.charge_status = 'failed'
      or (
        p.charge_status = 'processing'
        and p.stripe_payment_intent_id is null
        and p.charge_started_at < now() - interval '15 minutes'
      )
    )
  returning p.charge_attempts;
$$;

revoke execute on function public.claim_invoice_charge(uuid) from public, anon, authenticated;
grant execute on function public.claim_invoice_charge(uuid) to service_role;

-- Adds the charge columns to the lock, and stops an invoice being marked paid by
-- hand while a card charge is under way, which could collect it twice.
create or replace function public.protect_addon_invoices()
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
    or new.stripe_payment_intent_id is distinct from old.stripe_payment_intent_id then
    raise exception 'invoice_locked';
  end if;
  if old.charge_status = 'processing'
    and new.status is distinct from old.status then
    raise exception 'charge_in_progress';
  end if;
  return new;
end;
$$;
