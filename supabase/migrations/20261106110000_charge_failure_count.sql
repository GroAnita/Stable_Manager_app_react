-- Counts real failed charges on an invoice, so retries can stop after a limit.
-- charge_attempts can't be used for this: it also counts payment pages a boarder
-- opened with Betal nå.

alter table public.payments
  add column charge_failure_count integer not null default 0;
