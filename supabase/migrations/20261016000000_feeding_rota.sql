-- Feeding rota: recurring feeding shift types, an opt-in rotation roster,
-- owner unavailability, generated/publishable shift instances, and swap
-- requests between owners. Reuses the existing (previously unused)
-- notifications table for the in-app notification centre; real push is
-- deferred (see app code comments) since no push infrastructure exists yet.

-- 1. Resurrect `notifications` for real use: add RLS (it had none) and the
--    event types this feature needs.
alter type public.notification_type add value 'feeding_shift_assigned';
alter type public.notification_type add value 'feeding_shift_changed';
alter type public.notification_type add value 'feeding_shift_swap_requested';
alter type public.notification_type add value 'feeding_shift_swap_accepted';
alter type public.notification_type add value 'feeding_shift_swap_declined';
alter type public.notification_type add value 'feeding_shift_reminder';

create policy "notifications_select_self_service"
on public.notifications for select
using (
  exists (
    select 1 from public.owners o
    where o.id = notifications.owner_id and o.user_id = auth.uid()
  )
);

create policy "notifications_update_self_service"
on public.notifications for update
using (
  exists (
    select 1 from public.owners o
    where o.id = notifications.owner_id and o.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.owners o
    where o.id = notifications.owner_id and o.user_id = auth.uid()
  )
);

-- 2. Recurring shift types (e.g. Morning 07:00, Lunch 12:00, Evening 18:00),
--    each scoped to all horses or a specific selection.
create table public.feeding_shift_types (
  id uuid primary key default gen_random_uuid(),
  stable_id uuid not null references public.stables(id) on delete cascade,
  label text not null,
  time_of_day time not null,
  scope text not null default 'all' check (scope in ('all', 'horses')),
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_feeding_shift_types_updated_at
before update on public.feeding_shift_types
for each row execute function public.set_updated_at();

create table public.feeding_shift_type_horses (
  shift_type_id uuid not null references public.feeding_shift_types(id) on delete cascade,
  horse_id uuid not null references public.horses(id) on delete cascade,
  primary key (shift_type_id, horse_id)
);

-- 3. Opt-in rotation roster: which owners participate.
create table public.feeding_rota_participants (
  id uuid primary key default gen_random_uuid(),
  stable_id uuid not null references public.stables(id) on delete cascade,
  owner_id uuid not null references public.owners(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (stable_id, owner_id)
);

-- 4. Dates an owner can't be assigned. Self-service: owners manage their
--    own rows, staff can manage any.
create table public.owner_unavailability (
  id uuid primary key default gen_random_uuid(),
  stable_id uuid not null references public.stables(id) on delete cascade,
  owner_id uuid not null references public.owners(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  reason text,
  created_at timestamptz not null default now(),
  constraint owner_unavailability_valid_range check (end_date >= start_date)
);

-- 5. The single source of truth for a feeding duty shift instance. Draft
--    rows are never shown in the shared calendar or to owners; only
--    status = 'published' rows are. Calendar entries and personal pages
--    both read this same table directly, so they can never go out of sync.
create table public.feeding_shifts (
  id uuid primary key default gen_random_uuid(),
  stable_id uuid not null references public.stables(id) on delete cascade,
  shift_type_id uuid not null references public.feeding_shift_types(id) on delete cascade,
  date date not null,
  assigned_owner_id uuid references public.owners(id),
  status text not null default 'draft' check (status in ('draft', 'published', 'cancelled')),
  unassignable boolean not null default false,
  completed_by uuid references public.owners(id),
  completed_at timestamptz,
  reminder_day_before_sent_at timestamptz,
  reminder_hour_before_sent_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shift_type_id, date)
);

create trigger trg_feeding_shifts_updated_at
before update on public.feeding_shifts
for each row execute function public.set_updated_at();

-- Clearing the assignee or date/time (shift_type) should require fresh
-- reminders later; reset the dedupe flags whenever either changes.
create or replace function public.reset_feeding_shift_reminders()
returns trigger
language plpgsql
as $$
begin
  if new.assigned_owner_id is distinct from old.assigned_owner_id
     or new.shift_type_id is distinct from old.shift_type_id
     or new.date is distinct from old.date then
    new.reminder_day_before_sent_at := null;
    new.reminder_hour_before_sent_at := null;
  end if;
  return new;
end;
$$;

create trigger trg_feeding_shifts_reset_reminders
before update on public.feeding_shifts
for each row execute function public.reset_feeding_shift_reminders();

-- 6. Swap requests between owners. The original owner stays responsible
--    until the replacement accepts.
create table public.feeding_shift_swap_requests (
  id uuid primary key default gen_random_uuid(),
  stable_id uuid not null references public.stables(id) on delete cascade,
  shift_id uuid not null references public.feeding_shifts(id) on delete cascade,
  requested_by_owner_id uuid not null references public.owners(id),
  requested_to_owner_id uuid not null references public.owners(id),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

-- RLS: shift types
alter table public.feeding_shift_types enable row level security;

create policy "feeding_shift_types_select_stable_members"
on public.feeding_shift_types for select
using (stable_id = auth_stable_id());

create policy "feeding_shift_types_manage_staff"
on public.feeding_shift_types for all
using (
  stable_id = auth_stable_id()
  and auth_role() = any (array['stable_owner', 'stable_employee']::user_role[])
)
with check (
  stable_id = auth_stable_id()
  and auth_role() = any (array['stable_owner', 'stable_employee']::user_role[])
);

-- RLS: shift type horses (follow the parent shift type's access)
alter table public.feeding_shift_type_horses enable row level security;

create policy "feeding_shift_type_horses_select"
on public.feeding_shift_type_horses for select
using (
  exists (
    select 1 from public.feeding_shift_types st
    where st.id = feeding_shift_type_horses.shift_type_id
      and st.stable_id = auth_stable_id()
  )
);

create policy "feeding_shift_type_horses_manage_staff"
on public.feeding_shift_type_horses for all
using (
  exists (
    select 1 from public.feeding_shift_types st
    where st.id = feeding_shift_type_horses.shift_type_id
      and st.stable_id = auth_stable_id()
  )
  and auth_role() = any (array['stable_owner', 'stable_employee']::user_role[])
)
with check (
  exists (
    select 1 from public.feeding_shift_types st
    where st.id = feeding_shift_type_horses.shift_type_id
      and st.stable_id = auth_stable_id()
  )
  and auth_role() = any (array['stable_owner', 'stable_employee']::user_role[])
);

-- RLS: rota participants
alter table public.feeding_rota_participants enable row level security;

create policy "feeding_rota_participants_select_stable_members"
on public.feeding_rota_participants for select
using (stable_id = auth_stable_id());

create policy "feeding_rota_participants_manage_staff"
on public.feeding_rota_participants for all
using (
  stable_id = auth_stable_id()
  and auth_role() = any (array['stable_owner', 'stable_employee']::user_role[])
)
with check (
  stable_id = auth_stable_id()
  and auth_role() = any (array['stable_owner', 'stable_employee']::user_role[])
);

-- RLS: owner unavailability (self-service + staff)
alter table public.owner_unavailability enable row level security;

create policy "owner_unavailability_select"
on public.owner_unavailability for select
using (
  stable_id = auth_stable_id()
  and (
    auth_role() = any (array['stable_owner', 'stable_employee']::user_role[])
    or exists (
      select 1 from public.owners o
      where o.id = owner_unavailability.owner_id and o.user_id = auth.uid()
    )
  )
);

create policy "owner_unavailability_manage_staff"
on public.owner_unavailability for all
using (
  stable_id = auth_stable_id()
  and auth_role() = any (array['stable_owner', 'stable_employee']::user_role[])
)
with check (
  stable_id = auth_stable_id()
  and auth_role() = any (array['stable_owner', 'stable_employee']::user_role[])
);

create policy "owner_unavailability_manage_self_service"
on public.owner_unavailability for all
using (
  exists (
    select 1 from public.owners o
    where o.id = owner_unavailability.owner_id and o.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.owners o
    where o.id = owner_unavailability.owner_id and o.user_id = auth.uid()
  )
);

-- RLS: feeding shifts
alter table public.feeding_shifts enable row level security;

create policy "feeding_shifts_select_staff"
on public.feeding_shifts for select
using (
  stable_id = auth_stable_id()
  and auth_role() = any (array['stable_owner', 'stable_employee']::user_role[])
);

create policy "feeding_shifts_select_self_service"
on public.feeding_shifts for select
using (
  status = 'published'
  and exists (
    select 1 from public.owners o
    where o.id = feeding_shifts.assigned_owner_id and o.user_id = auth.uid()
  )
);

create policy "feeding_shifts_manage_staff"
on public.feeding_shifts for all
using (
  stable_id = auth_stable_id()
  and auth_role() = any (array['stable_owner', 'stable_employee']::user_role[])
)
with check (
  stable_id = auth_stable_id()
  and auth_role() = any (array['stable_owner', 'stable_employee']::user_role[])
);

-- Owner can mark their own published shift completed (and only that).
-- RLS can't limit which columns change, but the app only ever sends the
-- completion fields through this path.
create policy "feeding_shifts_complete_self_service"
on public.feeding_shifts for update
using (
  status = 'published'
  and exists (
    select 1 from public.owners o
    where o.id = feeding_shifts.assigned_owner_id and o.user_id = auth.uid()
  )
)
with check (
  status = 'published'
  and exists (
    select 1 from public.owners o
    where o.id = feeding_shifts.assigned_owner_id and o.user_id = auth.uid()
  )
);

-- RLS: swap requests
alter table public.feeding_shift_swap_requests enable row level security;

create policy "feeding_shift_swap_requests_select"
on public.feeding_shift_swap_requests for select
using (
  stable_id = auth_stable_id()
  and (
    auth_role() = any (array['stable_owner', 'stable_employee']::user_role[])
    or exists (
      select 1 from public.owners o
      where o.user_id = auth.uid()
        and o.id in (
          feeding_shift_swap_requests.requested_by_owner_id,
          feeding_shift_swap_requests.requested_to_owner_id
        )
    )
  )
);

create policy "feeding_shift_swap_requests_manage_staff"
on public.feeding_shift_swap_requests for all
using (
  stable_id = auth_stable_id()
  and auth_role() = any (array['stable_owner', 'stable_employee']::user_role[])
)
with check (
  stable_id = auth_stable_id()
  and auth_role() = any (array['stable_owner', 'stable_employee']::user_role[])
);

-- 7. Swap request / response via SECURITY DEFINER RPCs, since accepting a
--    swap needs to update a shift the accepting owner doesn't own, and
--    notify the other party — both outside normal RLS for either owner.
create or replace function public.request_feeding_shift_swap(
  p_shift_id uuid,
  p_to_owner_id uuid
)
returns public.feeding_shift_swap_requests
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_shift public.feeding_shifts;
  v_requester_owner_id uuid;
  v_swap public.feeding_shift_swap_requests;
begin
  select id into v_requester_owner_id from public.owners where user_id = auth.uid();
  if v_requester_owner_id is null then
    raise exception 'No owner record linked to your account.';
  end if;

  select * into v_shift from public.feeding_shifts where id = p_shift_id and status = 'published';
  if v_shift is null then
    raise exception 'Shift not found.';
  end if;
  if v_shift.assigned_owner_id is distinct from v_requester_owner_id then
    raise exception 'You can only request a swap for your own shift.';
  end if;
  if not exists (
    select 1 from public.feeding_rota_participants
    where stable_id = v_shift.stable_id and owner_id = p_to_owner_id and active = true
  ) then
    raise exception 'That owner is not an active rotation participant.';
  end if;

  insert into public.feeding_shift_swap_requests (
    stable_id, shift_id, requested_by_owner_id, requested_to_owner_id
  ) values (
    v_shift.stable_id, p_shift_id, v_requester_owner_id, p_to_owner_id
  )
  returning * into v_swap;

  insert into public.notifications (stable_id, owner_id, notification_type, title, message)
  values (
    v_shift.stable_id, p_to_owner_id, 'feeding_shift_swap_requested',
    'Feeding shift swap request',
    'You have been asked to take over a feeding shift on ' || v_shift.date
  );

  return v_swap;
end;
$$;

create or replace function public.respond_feeding_shift_swap(
  p_swap_id uuid,
  p_accept boolean
)
returns public.feeding_shift_swap_requests
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_swap public.feeding_shift_swap_requests;
  v_responder_owner_id uuid;
  v_shift public.feeding_shifts;
begin
  select id into v_responder_owner_id from public.owners where user_id = auth.uid();

  select * into v_swap from public.feeding_shift_swap_requests
  where id = p_swap_id and status = 'pending';
  if v_swap is null then
    raise exception 'Swap request not found or already resolved.';
  end if;
  if v_swap.requested_to_owner_id is distinct from v_responder_owner_id then
    raise exception 'This swap request is not addressed to you.';
  end if;

  update public.feeding_shift_swap_requests
  set status = case when p_accept then 'accepted' else 'declined' end,
      responded_at = now()
  where id = p_swap_id
  returning * into v_swap;

  select * into v_shift from public.feeding_shifts where id = v_swap.shift_id;

  if p_accept then
    update public.feeding_shifts
    set assigned_owner_id = v_swap.requested_to_owner_id
    where id = v_swap.shift_id;

    insert into public.notifications (stable_id, owner_id, notification_type, title, message)
    values
      (v_shift.stable_id, v_swap.requested_by_owner_id, 'feeding_shift_swap_accepted',
       'Feeding shift swap accepted',
       'Your feeding shift on ' || v_shift.date || ' has been taken over.'),
      (v_shift.stable_id, v_swap.requested_to_owner_id, 'feeding_shift_assigned',
       'Feeding shift assigned to you',
       'You are now responsible for the feeding shift on ' || v_shift.date || '.');
  else
    insert into public.notifications (stable_id, owner_id, notification_type, title, message)
    values (
      v_shift.stable_id, v_swap.requested_by_owner_id, 'feeding_shift_swap_declined',
      'Feeding shift swap declined',
      'Your swap request for the shift on ' || v_shift.date || ' was declined.'
    );
  end if;

  return v_swap;
end;
$$;

-- 8. Reminders: scan published, upcoming, uncompleted shifts and notify
--    the assigned owner at day-before / hour-before lead times, computed
--    in the stable's (currently fixed) timezone, deduping via the two
--    sent-at columns reset by the trigger above whenever a shift changes.
create or replace function public.send_feeding_shift_reminders()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_tz text := 'Europe/Oslo';
  v_shift record;
  v_due_day boolean;
  v_due_hour boolean;
begin
  for v_shift in
    select fs.id, fs.stable_id, fs.assigned_owner_id, fs.date,
           fs.reminder_day_before_sent_at, fs.reminder_hour_before_sent_at,
           st.label, st.time_of_day,
           (fs.date::timestamp + st.time_of_day) at time zone v_tz as shift_at
    from public.feeding_shifts fs
    join public.feeding_shift_types st on st.id = fs.shift_type_id
    where fs.status = 'published'
      and fs.assigned_owner_id is not null
      and fs.completed_at is null
  loop
    v_due_day := v_shift.reminder_day_before_sent_at is null
      and now() >= v_shift.shift_at - interval '1 day'
      and now() < v_shift.shift_at;

    v_due_hour := v_shift.reminder_hour_before_sent_at is null
      and now() >= v_shift.shift_at - interval '1 hour'
      and now() < v_shift.shift_at;

    if v_due_day then
      insert into public.notifications (stable_id, owner_id, notification_type, title, message)
      values (
        v_shift.stable_id, v_shift.assigned_owner_id, 'feeding_shift_reminder',
        'Feeding duty tomorrow',
        v_shift.label || ' feeding duty tomorrow at ' || v_shift.time_of_day
      );
      update public.feeding_shifts
      set reminder_day_before_sent_at = now()
      where id = v_shift.id;
    end if;

    if v_due_hour then
      insert into public.notifications (stable_id, owner_id, notification_type, title, message)
      values (
        v_shift.stable_id, v_shift.assigned_owner_id, 'feeding_shift_reminder',
        'Feeding duty in 1 hour',
        v_shift.label || ' feeding duty at ' || v_shift.time_of_day
      );
      update public.feeding_shifts
      set reminder_hour_before_sent_at = now()
      where id = v_shift.id;
    end if;
  end loop;
end;
$$;

select cron.schedule(
  'send-feeding-shift-reminders',
  '*/15 * * * *',
  $$select public.send_feeding_shift_reminders();$$
);
