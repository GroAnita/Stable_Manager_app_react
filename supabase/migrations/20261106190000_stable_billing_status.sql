-- Whether a stable pays for its subscription, kept apart from public.stables because
-- stable owners can update every column there, and they shouldn't set this themselves.
--
-- 'tester' is free with no end date, for the stables testing Stalldrift now. New
-- stables get a 30-day trial. To move a tester to a trial later, run in the SQL editor:
--   select public.start_stable_trial('PUT_STABLE_ID_HERE', 30);

create table public.stable_billing (
  stable_id uuid primary key references public.stables (id) on delete cascade,
  status text not null default 'trial'
    check (status in ('tester', 'trial', 'active', 'past_due', 'canceled')),
  trial_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_stable_billing_updated_at
before update on public.stable_billing
for each row execute function public.set_updated_at();

alter table public.stable_billing enable row level security;

create policy "stable_billing_select_stable_owner"
on public.stable_billing for select
using (stable_id = public.auth_stable_id() and public.auth_role()::text = 'stable_owner');

revoke insert, update, delete on public.stable_billing from anon, authenticated;

-- Every stable that exists today is testing, so it stays free.
insert into public.stable_billing (stable_id, status)
select id, 'tester' from public.stables;

create function public.create_stable_billing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.stable_billing (stable_id, status, trial_ends_at)
  values (new.id, 'trial', new.created_at + interval '30 days');
  return new;
end;
$$;

revoke execute on function public.create_stable_billing() from public, anon, authenticated;

create trigger trg_stables_create_billing
after insert on public.stables
for each row execute function public.create_stable_billing();

create function public.start_stable_trial(p_stable_id uuid, p_days integer default 30)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_days is null or p_days <= 0 then
    raise exception 'The trial must be at least one day';
  end if;
  update public.stable_billing
  set status = 'trial', trial_ends_at = now() + make_interval(days => p_days)
  where stable_id = p_stable_id and status in ('tester', 'trial');
  if not found then
    raise exception 'Stable not found, or it already has a subscription';
  end if;
end;
$$;

revoke execute on function public.start_stable_trial(uuid, integer) from public, anon, authenticated;
