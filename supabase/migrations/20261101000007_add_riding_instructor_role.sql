-- A staff role scoped to only the riding-school/lessons area (Calendar,
-- Riding lessons, Courses, Riders, School horses) — everything else in
-- the app (horses, owners, stalls, payments, etc.) stays off-limits.
-- Split into its own migration: a new enum value can't be referenced
-- in policies/functions in the same transaction it's added in.
alter type public.user_role add value 'riding_instructor';
