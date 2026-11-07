-- Account deletion, which the App Store requires and the privacy statement promises.
--
-- A member (horse owner, employee, co-rider, instructor) loses the login and profile.
-- What the stable registered about them stays with the stable, which is responsible
-- for it and must keep its accounts. The delete-account function does the work.
--
-- A stable owner's stable is closed straight away and deleted after 3 months, so the
-- owner can change their mind through support. Until then the owner's login is
-- blocked, and the owner's user is deleted together with the stable.

-- 1. Links that would stop a profile from being deleted, plus notice board posts,
--    which belong to the stable and shouldn't vanish with the person who wrote them.
do $$
declare
  r record;
  v_changed integer := 0;
begin
  for r in
    select c.conname, c.conrelid::regclass as tbl, a.attname
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f'
      and c.confrelid = 'public.profiles'::regclass
      and (
        (c.conrelid = 'public.feeding_shifts'::regclass and a.attname = 'created_by')
        or (c.conrelid = 'public.stable_invites'::regclass and a.attname = 'used_by')
        or (c.conrelid = 'public.vaccinations'::regclass and a.attname = 'created_by')
        or (c.conrelid = 'public.announcements'::regclass and a.attname = 'created_by')
      )
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    execute format('alter table %s alter column %I drop not null', r.tbl, r.attname);
    execute format(
      'alter table %s add constraint %I foreign key (%I) references public.profiles (id) on delete set null',
      r.tbl, r.conname, r.attname
    );
    v_changed := v_changed + 1;
  end loop;
  if v_changed <> 4 then
    raise exception 'Expected 4 links to change, found %', v_changed;
  end if;
end;
$$;

-- 2. Deleting a horse owner from the register used to delete their invoices too,
--    which the bookkeeping rules don't allow. Block it while the stable exists; when a
--    closed stable is finally deleted, the stable row is already gone, so it's allowed.
create function public.keep_owner_with_invoices()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.stables s where s.id = old.stable_id)
     and exists (select 1 from public.payments p where p.owner_id = old.id) then
    raise exception 'owner_has_invoices';
  end if;
  return old;
end;
$$;

create trigger trg_keep_owner_with_invoices
before delete on public.owners
for each row execute function public.keep_owner_with_invoices();

-- 3. Closed stables.
alter table public.stables
  add column closed_at timestamptz,
  add column delete_after timestamptz;

-- Only the delete-account function and support (no signed-in user) may close or reopen.
create function public.protect_stable_closure()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and (new.closed_at is distinct from old.closed_at
          or new.delete_after is distinct from old.delete_after) then
    raise exception 'stable_closure_is_locked';
  end if;
  return new;
end;
$$;

create trigger trg_protect_stable_closure
before update on public.stables
for each row execute function public.protect_stable_closure();

-- A closed stable can't be changed by anyone still signed in to it.
create or replace function public.stable_is_read_only(p_stable_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
      select 1 from public.stables s
      where s.id = p_stable_id and s.closed_at is not null
    )
    or coalesce((
      select case b.status
        when 'trial' then b.trial_ends_at is not null
          and now() > b.trial_ends_at + interval '14 days'
        when 'past_due' then now() > coalesce(b.past_due_since, b.updated_at) + interval '14 days'
        when 'canceled' then now() > coalesce(b.current_period_end, b.updated_at) + interval '14 days'
        else false
      end
      from public.stable_billing b
      where b.stable_id = p_stable_id
    ), false);
$$;

revoke execute on function public.stable_is_read_only(uuid) from public, anon, authenticated;

-- 4. Nightly: delete-account deletes stables whose 3 months are up.
create function public.trigger_account_purge()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'invoice_email_trigger_secret';

  perform net.http_post(
    url := 'https://kutsqjkjnzyfmoidafet.supabase.co/functions/v1/delete-account',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Invoice-Email-Secret', coalesce(v_secret, '')
    ),
    body := '{"action":"purge"}'::jsonb
  );
end;
$$;

revoke execute on function public.trigger_account_purge() from public, anon, authenticated;

select cron.schedule(
  'account-purge',
  '15 4 * * *',
  $$select public.trigger_account_purge();$$
);
