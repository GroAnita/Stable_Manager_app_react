-- Co-riders ("forryttere"): people who ride someone else's horse under an
-- informal lease/sharing arrangement — not a horse owner, not stable staff.
-- They get a card like a horse owner's; staff link them to one or more
-- horses with payment terms and stable duties recorded per link. No app
-- login/self-service yet — user_id is reserved for that, unused for now.

create type public.co_rider_billing_frequency as enum ('per_session', 'monthly');

create table public.co_riders (
  id uuid primary key default gen_random_uuid(),
  stable_id uuid not null references public.stables(id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  notes text,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.co_rider_agreements (
  id uuid primary key default gen_random_uuid(),
  stable_id uuid not null references public.stables(id) on delete cascade,
  co_rider_id uuid not null references public.co_riders(id) on delete cascade,
  horse_id uuid not null references public.horses(id) on delete cascade,
  fee_amount numeric,
  billing_frequency public.co_rider_billing_frequency,
  start_date date,
  end_date date,
  stable_duties text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.co_riders enable row level security;
alter table public.co_rider_agreements enable row level security;

create trigger co_riders_set_updated_at
before update on public.co_riders
for each row execute function public.set_updated_at();

create trigger co_rider_agreements_set_updated_at
before update on public.co_rider_agreements
for each row execute function public.set_updated_at();

create policy "co_riders_select_staff"
on public.co_riders for select
using (
  auth_role() in ('stable_owner', 'stable_employee')
  and stable_id = auth_stable_id()
);

create policy "co_riders_insert_staff"
on public.co_riders for insert
with check (
  auth_role() in ('stable_owner', 'stable_employee')
  and stable_id = auth_stable_id()
);

create policy "co_riders_update_staff"
on public.co_riders for update
using (
  auth_role() in ('stable_owner', 'stable_employee')
  and stable_id = auth_stable_id()
)
with check (
  auth_role() in ('stable_owner', 'stable_employee')
  and stable_id = auth_stable_id()
);

create policy "co_riders_delete_staff"
on public.co_riders for delete
using (
  auth_role() in ('stable_owner', 'stable_employee')
  and stable_id = auth_stable_id()
);

create policy "co_rider_agreements_select_staff"
on public.co_rider_agreements for select
using (
  auth_role() in ('stable_owner', 'stable_employee')
  and stable_id = auth_stable_id()
);

create policy "co_rider_agreements_insert_staff"
on public.co_rider_agreements for insert
with check (
  auth_role() in ('stable_owner', 'stable_employee')
  and stable_id = auth_stable_id()
  and exists (
    select 1 from public.co_riders cr
    where cr.id = co_rider_agreements.co_rider_id
      and cr.stable_id = auth_stable_id()
  )
  and exists (
    select 1 from public.horses h
    where h.id = co_rider_agreements.horse_id
      and h.stable_id = auth_stable_id()
  )
);

create policy "co_rider_agreements_update_staff"
on public.co_rider_agreements for update
using (
  auth_role() in ('stable_owner', 'stable_employee')
  and stable_id = auth_stable_id()
)
with check (
  auth_role() in ('stable_owner', 'stable_employee')
  and stable_id = auth_stable_id()
  and exists (
    select 1 from public.co_riders cr
    where cr.id = co_rider_agreements.co_rider_id
      and cr.stable_id = auth_stable_id()
  )
  and exists (
    select 1 from public.horses h
    where h.id = co_rider_agreements.horse_id
      and h.stable_id = auth_stable_id()
  )
);

create policy "co_rider_agreements_delete_staff"
on public.co_rider_agreements for delete
using (
  auth_role() in ('stable_owner', 'stable_employee')
  and stable_id = auth_stable_id()
);

grant select, insert, update, delete on public.co_riders to authenticated;
grant select, insert, update, delete on public.co_rider_agreements to authenticated;
