-- Lets any stable member comment on and acknowledge ("seen it") a
-- announcement, so staff can tell whether people actually noticed a
-- notice. Comment threads and the acknowledger list only load when a
-- specific announcement is opened — the board itself only shows counts,
-- per GroAnita's request not to crowd the dashboard.

create table public.announcement_comments (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  stable_id uuid not null references public.stables(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index announcement_comments_announcement_id_created_at_idx
on public.announcement_comments (announcement_id, created_at);

-- One row per (announcement, user) — acknowledging again just toggles it
-- off client-side rather than creating duplicates.
create table public.announcement_acknowledgments (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  stable_id uuid not null references public.stables(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (announcement_id, user_id)
);

create index announcement_acknowledgments_announcement_id_idx
on public.announcement_acknowledgments (announcement_id);

alter table public.announcement_comments enable row level security;
alter table public.announcement_acknowledgments enable row level security;

grant select, insert, delete on public.announcement_comments to authenticated;
grant select, insert, delete on public.announcement_acknowledgments to authenticated;

create policy "announcement_comments_select_stable"
on public.announcement_comments for select
using (stable_id = auth_stable_id());

create policy "announcement_comments_insert_self"
on public.announcement_comments for insert
with check (stable_id = auth_stable_id() and author_id = auth.uid());

-- A commenter can remove their own comment; staff can moderate anyone's.
create policy "announcement_comments_delete_self_or_staff"
on public.announcement_comments for delete
using (
  stable_id = auth_stable_id()
  and (
    author_id = auth.uid()
    or auth_role() = any (array['stable_owner', 'stable_employee']::user_role[])
  )
);

create policy "announcement_acknowledgments_select_stable"
on public.announcement_acknowledgments for select
using (stable_id = auth_stable_id());

create policy "announcement_acknowledgments_insert_self"
on public.announcement_acknowledgments for insert
with check (stable_id = auth_stable_id() and user_id = auth.uid());

create policy "announcement_acknowledgments_delete_self"
on public.announcement_acknowledgments for delete
using (stable_id = auth_stable_id() and user_id = auth.uid());
