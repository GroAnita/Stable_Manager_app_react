-- Device push tokens, scoped to owners only (matches the existing
-- notifications table, which is owner-only today — feeding rota events).
-- Staff/admin push is a separate future extension if ever needed.
create extension if not exists pg_net;

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete cascade,
  platform text not null default 'ios' check (platform in ('ios')),
  token text not null,
  created_at timestamptz not null default now(),
  unique (owner_id, token)
);

alter table public.push_tokens enable row level security;

create policy "push_tokens_select_self_service"
on public.push_tokens for select
using (
  exists (
    select 1 from public.owners o
    where o.id = push_tokens.owner_id and o.user_id = auth.uid()
  )
);

create policy "push_tokens_insert_self_service"
on public.push_tokens for insert
with check (
  exists (
    select 1 from public.owners o
    where o.id = push_tokens.owner_id and o.user_id = auth.uid()
  )
);

create policy "push_tokens_delete_self_service"
on public.push_tokens for delete
using (
  exists (
    select 1 from public.owners o
    where o.id = push_tokens.owner_id and o.user_id = auth.uid()
  )
);

grant select, insert, delete on public.push_tokens to authenticated;

-- Fire off a push attempt whenever a notification is created. The Edge
-- Function (supabase/functions/send-push-notification) looks up
-- push_tokens for NEW.owner_id itself — this trigger doesn't know or care
-- whether the owner has a registered device.
--
-- Auth is a shared secret, set directly on the database outside of
-- migrations (never committed to git) via:
--   alter database postgres set app.settings.push_trigger_secret = '...';
-- rather than the service role key, since this call never needs to act
-- as a particular user.
create or replace function public.trigger_push_notification()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  perform net.http_post(
    url := 'https://kutsqjkjnzyfmoidafet.supabase.co/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Push-Secret', coalesce(current_setting('app.settings.push_trigger_secret', true), '')
    ),
    body := to_jsonb(NEW)
  );
  return NEW;
end;
$$;

revoke execute on function public.trigger_push_notification() from public, anon, authenticated;

create trigger trg_notifications_push
after insert on public.notifications
for each row execute function public.trigger_push_notification();

notify pgrst, 'reload schema';
