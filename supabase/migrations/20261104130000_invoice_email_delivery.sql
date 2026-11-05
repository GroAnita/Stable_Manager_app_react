-- Records whether an invoice email really arrived, as reported by Resend through
-- the resend-webhook Edge Function. Being accepted by Resend isn't enough: an
-- address on its block list is accepted and then never delivered.
--
-- card_agreement_accepted_at makes the email promise a card charge only to
-- boarders who have agreed to one. Nothing sets it yet; the signing screen will.

alter table public.payments
  add column invoice_email_delivery_status text
    check (invoice_email_delivery_status in ('delivered', 'bounced', 'suppressed', 'failed')),
  add column invoice_email_delivered_at timestamptz;

alter table public.contracts
  add column card_agreement_accepted_at timestamptz;

-- The email columns are the proof of notice, so app users can't change them
-- either. Edge Functions use the service role, which has no signed-in user.
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
    or new.invoice_email_delivered_at is distinct from old.invoice_email_delivered_at then
    raise exception 'invoice_locked';
  end if;
  return new;
end;
$$;
