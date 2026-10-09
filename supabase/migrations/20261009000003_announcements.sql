-- Stable-wide notice board: staff post messages, everyone in the stable
-- (including horse_owner boarders) can read them.

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  stable_id uuid not null references public.stables(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index announcements_stable_id_created_at_idx
on public.announcements (stable_id, created_at desc);

alter table public.announcements enable row level security;

create trigger trg_announcements_updated_at
before update on public.announcements
for each row execute function public.set_updated_at();

create policy "announcements_select_stable"
on public.announcements for select
using (stable_id = auth_stable_id());

create policy "announcements_insert_staff"
on public.announcements for insert
with check (
  stable_id = auth_stable_id()
  and auth_role() = any (array['stable_owner', 'stable_employee']::user_role[])
);

create policy "announcements_update_staff"
on public.announcements for update
using (
  stable_id = auth_stable_id()
  and auth_role() = any (array['stable_owner', 'stable_employee']::user_role[])
)
with check (
  stable_id = auth_stable_id()
  and auth_role() = any (array['stable_owner', 'stable_employee']::user_role[])
);

create policy "announcements_delete_staff"
on public.announcements for delete
using (
  stable_id = auth_stable_id()
  and auth_role() = any (array['stable_owner', 'stable_employee']::user_role[])
);
