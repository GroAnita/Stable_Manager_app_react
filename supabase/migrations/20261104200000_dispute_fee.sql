-- Stripe charges a fee on a dispute, on top of holding back the disputed amount.
-- It belongs in reports, or a dispute costs more than they show.

alter table public.payments
  add column dispute_fee numeric(10, 2),
  add column dispute_opened_at timestamptz;

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
    or new.dispute_opened_at is distinct from old.dispute_opened_at then
    raise exception 'invoice_locked';
  end if;
  if old.charge_status = 'processing'
    and new.status is distinct from old.status then
    raise exception 'charge_in_progress';
  end if;
  return new;
end;
$$;
