-- The new plan names for subscriptions that include card payments. Postgres can't
-- use a new enum value in the same transaction that adds it, so this runs first
-- and on its own, before 20261105090001_payment_plans.sql.

alter type public.stable_plan add value if not exists 'small_payments';
alter type public.stable_plan add value if not exists 'medium_payments';
alter type public.stable_plan add value if not exists 'large_payments';
alter type public.stable_plan add value if not exists 'xlarge_payments';
