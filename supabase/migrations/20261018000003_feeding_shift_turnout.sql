-- Lets the owner on duty mark a shift's horses let out to / in from
-- turnout, alongside the existing "all horses fed" (completed_at)
-- confirmation. No new RLS needed: the existing self-service UPDATE
-- policy (feeding_shifts_complete_self_service) already lets the
-- assigned owner update any column on their own published shift, and
-- the staff ALL policy already covers staff edits.

alter table public.feeding_shifts
  add column let_out_by uuid references public.owners(id),
  add column let_out_at timestamptz,
  add column let_in_by uuid references public.owners(id),
  add column let_in_at timestamptz;
