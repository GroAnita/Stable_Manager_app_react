-- Stable-wide dates (holidays, closures) that course session generation
-- skips. Deliberately not course-specific — a holiday blocks the whole
-- stable, not one course — and deliberately not enforced again inside
-- generate_course_sessions(): skipping a date is a scheduling
-- convenience, not a security boundary, so the client filters its
-- candidate date list against this table before calling the RPC.
create table public.blocked_dates (
  id uuid primary key default gen_random_uuid(),
  stable_id uuid not null references public.stables(id) on delete cascade,
  date date not null,
  label text,
  created_at timestamptz not null default now(),
  unique (stable_id, date)
);

alter table public.blocked_dates enable row level security;

create policy "blocked_dates_select_stable"
on public.blocked_dates for select
using (stable_id = auth_stable_id());

create policy "blocked_dates_insert_staff"
on public.blocked_dates for insert
with check (
  stable_id = auth_stable_id() and auth_role() in ('stable_owner', 'stable_employee')
);

create policy "blocked_dates_delete_staff"
on public.blocked_dates for delete
using (
  stable_id = auth_stable_id() and auth_role() in ('stable_owner', 'stable_employee')
);

grant select, insert, delete on public.blocked_dates to authenticated;

notify pgrst, 'reload schema';
