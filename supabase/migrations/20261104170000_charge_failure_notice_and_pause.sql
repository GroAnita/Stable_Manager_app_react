-- Keeps two promises in the card agreement. Section 5: a boarder is told when a
-- charge fails, and about any new attempt, with amount and date, beforehand.
-- Section 4: charges can be paused while a question about an invoice is settled.

alter table public.payments
  add column charge_failure_notified_attempt integer,
  add column charge_retry_not_before date;

alter table public.card_agreements
  add column paused_at timestamptz,
  add column paused_by uuid references auth.users (id) on delete set null;

create function public.set_card_agreement_paused(p_contract_id uuid, p_paused boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.auth_role() is distinct from 'stable_owner' then
    raise exception 'Only the stable owner can do this';
  end if;
  if p_paused is null then
    raise exception 'Missing pause setting';
  end if;

  update public.card_agreements ca
  set paused_at = case when p_paused then now() else null end,
      paused_by = case when p_paused then auth.uid() else null end
  where ca.contract_id = p_contract_id
    and ca.stable_id = public.auth_stable_id()
    and ca.activated_at is not null
    and ca.withdrawn_at is null;

  if not found then
    raise exception 'No active agreement on this contract';
  end if;
end;
$$;

revoke execute on function public.set_card_agreement_paused(uuid, boolean) from public, anon;
grant execute on function public.set_card_agreement_paused(uuid, boolean) to authenticated;

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
    or new.charge_retry_not_before is distinct from old.charge_retry_not_before then
    raise exception 'invoice_locked';
  end if;
  if old.charge_status = 'processing'
    and new.status is distinct from old.status then
    raise exception 'charge_in_progress';
  end if;
  return new;
end;
$$;
