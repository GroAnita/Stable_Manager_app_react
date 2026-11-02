-- Supabase Security Advisor findings (2026-11-02):
-- these three trigger functions have no schema-qualified references in
-- their bodies (only NEW/OLD fields and built-ins), so pinning search_path
-- to empty removes the "mutable search_path" warning with no behavior change.
alter function public.set_updated_at() set search_path = '';
alter function public.protect_profile_fields() set search_path = '';
alter function public.reset_feeding_shift_reminders() set search_path = '';

-- pg_net does not support `ALTER EXTENSION ... SET SCHEMA` (not relocatable);
-- moving it would require DROP/CREATE EXTENSION, which risks the push
-- notification trigger's in-flight requests. Left as-is; its functions
-- already live in their own `net` schema and are always called
-- schema-qualified (net.http_post), so the public-schema registration is
-- cosmetic, not a functional exposure.
