-- Lets a boarder pay an invoice themselves on Stripe's payment page. The invoice
-- stays claimed while that page is open, so the stable can't charge the saved
-- card at the same time. Stripe expires the page after about 30 minutes.

alter table public.payments
  add column stripe_checkout_session_id text;

-- Whether boarders at the caller's stable can pay online. Uses the same switch as
-- signing, since both are about the stable being ready for boarders to pay by card.
create function public.can_pay_invoices_online()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select spa.addon_enabled
        and spa.card_signing_enabled
        and spa.charges_enabled
        and spa.stripe_account_id is not null
      from public.stable_payment_accounts spa
      where spa.stable_id = public.auth_stable_id()
    ),
    false
  );
$$;

revoke execute on function public.can_pay_invoices_online() from public, anon;
grant execute on function public.can_pay_invoices_online() to authenticated;

-- A claim with an open payment page is released when the page ends, never by age,
-- because the boarder could still pay on it.
create or replace function public.claim_invoice_charge(p_payment_id uuid)
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
      stripe_checkout_session_id = null,
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
        and p.stripe_checkout_session_id is null
        and p.charge_started_at < now() - interval '15 minutes'
      )
    )
  returning p.charge_attempts;
$$;

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
    or new.stripe_checkout_session_id is distinct from old.stripe_checkout_session_id then
    raise exception 'invoice_locked';
  end if;
  if old.charge_status = 'processing'
    and new.status is distinct from old.status then
    raise exception 'charge_in_progress';
  end if;
  return new;
end;
$$;
