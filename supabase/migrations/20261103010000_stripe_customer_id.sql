-- Readiness for Stripe-based subscription billing (not wired to checkout
-- yet — SubscriptionPanel's plan picker still just writes `plan` directly).
-- Each stable gets at most one Stripe Customer once billing goes live.
alter table public.stables
  add column stripe_customer_id text unique;
