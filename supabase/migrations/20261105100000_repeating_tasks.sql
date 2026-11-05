-- Tasks can repeat. Ticking off a repeating task creates the next one, so the list
-- never fills up with future tasks. This lives in the database so it works the same
-- whoever ticks the task off.

alter table public.tasks
  add column repeat_interval text not null default 'none'
    check (repeat_interval in ('none', 'daily', 'weekly', 'monthly')),
  add column next_task_created_at timestamptz;

-- Steps from the due date, skipping any dates already passed, so a task that was
-- ticked off late doesn't come back overdue.
create function public.next_task_due_date(
  p_due_date date,
  p_interval text,
  p_today date
)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_start date := coalesce(p_due_date, p_today);
  v_step integer := 1;
  v_next date;
begin
  loop
    v_next := case p_interval
      when 'daily' then v_start + v_step
      when 'weekly' then v_start + v_step * 7
      when 'monthly' then (v_start + make_interval(months => v_step))::date
    end;
    if v_next is null then
      raise exception 'Unknown repeat interval: %', p_interval;
    end if;
    exit when v_next > p_today;
    v_step := v_step + 1;
  end loop;
  return v_next;
end;
$$;

create function public.create_next_repeating_task()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.tasks
    (stable_id, title, description, priority, assigned_to, horse_id, due_date, repeat_interval)
  values (
    new.stable_id, new.title, new.description, new.priority, new.assigned_to, new.horse_id,
    public.next_task_due_date(
      new.due_date,
      new.repeat_interval,
      (now() at time zone 'Europe/Oslo')::date
    ),
    new.repeat_interval
  );

  -- Stops a task from creating a second copy if it's unticked and ticked again.
  update public.tasks set next_task_created_at = now() where id = new.id;
  return new;
end;
$$;

revoke execute on function public.create_next_repeating_task() from public, anon, authenticated;

create trigger trg_tasks_create_next_repeating
after update of completed on public.tasks
for each row
when (
  new.completed
  and not old.completed
  and new.repeat_interval <> 'none'
  and new.next_task_created_at is null
)
execute function public.create_next_repeating_task();
