-- Stables paying for Stalldrift through Stripe, on Nestun Digital's own Stripe account.
-- Testers are never charged or limited. A stable that hasn't paid goes read-only 14 days
-- after its trial or subscription ran out, or a payment failed: everything can still
-- be read and exported, and nothing is deleted. This is enforced here in the database.
-- The nightly jobs and Stripe's reports aren't affected, so invoices to boarders and
-- their card payments keep running.

alter table public.stable_billing
  add column stripe_customer_id text,
  add column stripe_subscription_id text,
  add column current_period_end timestamptz,
  add column cancel_at_period_end boolean not null default false,
  add column past_due_since timestamptz;

create function public.stable_is_read_only(p_stable_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
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

-- For the banner, which every member of the stable sees.
create function public.get_stable_billing_state()
returns table (
  status text,
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean,
  past_due_since timestamptz,
  has_subscription boolean,
  read_only boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.status, b.trial_ends_at, b.current_period_end, b.cancel_at_period_end,
    b.past_due_since, b.stripe_subscription_id is not null,
    public.stable_is_read_only(b.stable_id)
  from public.stable_billing b
  where b.stable_id = public.auth_stable_id();
$$;

revoke execute on function public.get_stable_billing_state() from public, anon;
grant execute on function public.get_stable_billing_state() to authenticated;

-- Refuses changes from people in the app. Jobs and Edge Functions have no auth.uid(),
-- and a cascade from deleting a whole stable runs deeper than this trigger's own level.
create function public.block_when_read_only()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stable_id uuid;
begin
  if auth.uid() is null or pg_trigger_depth() > 1 then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;
  v_stable_id := case when tg_op = 'DELETE' then old.stable_id else new.stable_id end;
  if public.stable_is_read_only(v_stable_id) then
    raise exception 'Abonnementet er ikke aktivt, så Stalldrift er skrivebeskyttet. Stalleieren kan ordne dette under Innstillinger → Abonnement.'
      using errcode = 'P0001', hint = 'subscription_read_only';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke execute on function public.block_when_read_only() from public, anon, authenticated;

-- Every table holding a stable's records, except what must keep working to get out of
-- read-only: billing itself, the payment setup, notifications and sign-in details.
do $$
declare
  v_table text;
begin
  for v_table in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'stable_id'
      and t.table_type = 'BASE TABLE'
      and c.table_name not in (
        'stable_billing',
        'stable_payment_accounts',
        'credit_note_counters',
        'profiles',
        'notifications',
        'push_tokens',
        'card_agreements',
        'invoice_lines',
        'credit_notes'
      )
  loop
    execute format(
      'create trigger trg_block_when_read_only before insert or update or delete on public.%I for each row execute function public.block_when_read_only()',
      v_table
    );
  end loop;
end;
$$;

create or replace function public.check_stable_plan_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new public.subscription_plans%rowtype;
  v_old_includes boolean := false;
  v_signed integer;
begin
  if auth.uid() is null then
    return new;
  end if;

  select * into v_new from public.subscription_plans where key = new.plan;
  if not found or not v_new.visible then
    raise exception 'plan_not_available';
  end if;

  if tg_op = 'UPDATE' then
    select includes_payments into v_old_includes
    from public.subscription_plans where key = old.plan;

    -- A paying stable's plan follows its Stripe subscription, so it's changed there.
    if exists (
      select 1 from public.stable_billing b
      where b.stable_id = old.id and b.stripe_subscription_id is not null
        and b.status in ('active', 'past_due')
    ) then
      raise exception 'plan_change_through_billing';
    end if;

    if tg_op = 'UPDATE' and exists (
      select 1 from public.stable_payment_accounts spa
      where spa.stable_id = old.id and spa.plan_change_status in ('scheduled', 'failed')
    ) then
      raise exception 'plan_change_scheduled';
    end if;

    -- Leaving card payments has to go through a planned switch while anything is
    -- running, so boarders are told and nothing is billed twice or missed.
    if coalesce(v_old_includes, false) and not v_new.includes_payments then
      select count(*) into v_signed
      from public.card_agreements ca
      where ca.stable_id = old.id and ca.withdrawn_at is null;
      if v_signed > 0
        or exists (
          select 1 from public.contracts c
          where c.stable_id = old.id and c.status in ('active', 'ending_soon')
        )
        or exists (
          select 1 from public.invoice_extras ie
          where ie.stable_id = old.id and ie.payment_id is null
        ) then
        raise exception 'plan_change_needs_schedule' using detail = v_signed::text;
      end if;
    end if;
  end if;

  return new;
end;
$$;
