-- Security fix: Postgres grants EXECUTE to PUBLIC on every new function
-- by default, and none of this project's migrations ever revoked it.
-- Since PostgREST exposes every public-schema function as an RPC
-- endpoint, anyone holding just the anon key could call any of them
-- directly. Verified live before this fix: the anon key could call
-- generate_monthly_invoices(), which generates the month's invoices for
-- every stable in the system with no caller check at all.
--
-- Classified every function in the public schema (confirmed via
-- pg_proc + information_schema.triggers) into four groups and locked
-- each down to exactly what it needs:
--
-- 1. Pure trigger functions (never meant to be called directly) are
--    revoked from anon/authenticated/public entirely. Verified live
--    beforehand that triggers still fire with EXECUTE fully revoked —
--    Postgres doesn't check the invoking role's function privilege for
--    trigger firing, only for direct calls.
-- 2. RLS helper functions (auth_role/auth_stable_id/horse_stable_id)
--    are called implicitly by RLS policies evaluated as the querying
--    role, so `authenticated` must keep EXECUTE or every policy in the
--    app breaks. Only anon/public are revoked.
-- 3. RPC functions meant for logged-in users (invites, swaps, staff
--    role changes, etc.) already check the caller's identity/role
--    internally — authenticated keeps EXECUTE, anon/public lose it.
-- 4. Cron-only functions (generate_monthly_invoices,
--    refresh_overdue_payments, send_feeding_shift_reminders) are
--    revoked from anon/authenticated/public entirely. Confirmed via
--    cron.job that all three scheduled jobs run as the `postgres`
--    role, which owns these functions and isn't subject to these
--    grants, so this doesn't affect the schedules.

-- 1. Trigger-only functions
revoke execute on function public.enforce_horse_additional_owners() from public, anon, authenticated;
revoke execute on function public.protect_profile_fields() from public, anon, authenticated;
revoke execute on function public.reset_feeding_shift_reminders() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.sync_stall_status() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- 2. RLS helper functions — authenticated must keep EXECUTE
revoke execute on function public.auth_role() from public, anon;
revoke execute on function public.auth_stable_id() from public, anon;
revoke execute on function public.horse_stable_id(uuid) from public, anon;

-- 3. Authenticated-only RPC functions (each checks the caller itself)
revoke execute on function public.accept_stable_invite(uuid) from public, anon;
revoke execute on function public.assign_staff_role(uuid, public.user_role) from public, anon;
revoke execute on function public.create_stable(text, text, text, text, text, text) from public, anon;
revoke execute on function public.link_horse_owner_account(uuid, uuid, uuid) from public, anon;
revoke execute on function public.log_horse_extra(uuid, uuid, numeric, date) from public, anon;
revoke execute on function public.request_feeding_shift_swap(uuid, uuid) from public, anon;
revoke execute on function public.respond_feeding_shift_swap(uuid, boolean) from public, anon;
revoke execute on function public.revoke_staff_access(uuid) from public, anon;
revoke execute on function public.set_staff_role(uuid, public.user_role) from public, anon;

-- 4. Cron-only functions — never meant to be called by a client at all
revoke execute on function public.generate_monthly_invoices() from public, anon, authenticated;
revoke execute on function public.refresh_overdue_payments() from public, anon, authenticated;
revoke execute on function public.send_feeding_shift_reminders() from public, anon, authenticated;
