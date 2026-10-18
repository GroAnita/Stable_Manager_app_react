-- Subscription plan selection for a stable. No billing/payment processor
-- is wired up yet (Integrasjoner is still a placeholder) — this just
-- records the stable owner's chosen plan so it's ready for whenever
-- billing gets built. Trial end date is computed in the app as
-- created_at + 30 days rather than stored, so it never needs updating.

create type public.stable_plan as enum ('small', 'medium', 'large');

alter table public.stables
  add column plan public.stable_plan not null default 'small';
