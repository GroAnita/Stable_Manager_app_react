-- Fôrkalkulator: how many kg of hay a horse needs to cover its energy need (FEh).
--
-- The stable registers the analysis of each batch of hay and marks the one in use.
-- Each horse gets an ideal weight, a workload and, optionally, concentrate and a
-- different batch of hay. The calculation itself happens in the app
-- (src/features/forage/calc.ts), so nothing here depends on the formula.

-- 1. Hay analyses. Only dry matter and FEh per kg dry matter are stored; FEh per kg
--    feed follows from them, so the two can never disagree.
create table public.forage_analyses (
  id uuid primary key default gen_random_uuid(),
  stable_id uuid not null references public.stables(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 100),
  analysed_on date,
  dry_matter_percent numeric(5, 2) not null
    check (dry_matter_percent > 0 and dry_matter_percent <= 100),
  feh_per_kg_dm numeric(4, 3) not null
    check (feh_per_kg_dm > 0 and feh_per_kg_dm < 2),
  notes text check (notes is null or length(notes) <= 1000),
  in_use boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index forage_analyses_stable_id_idx on public.forage_analyses (stable_id);
create unique index forage_analyses_one_in_use
  on public.forage_analyses (stable_id) where in_use;

alter table public.forage_analyses enable row level security;

-- Everyone in the stable can read them, horse owners included, so they can use them
-- for their own horse. Only the stable's staff can change them.
create policy forage_analyses_select_stable on public.forage_analyses
  for select to authenticated
  using (stable_id = public.auth_stable_id());

create policy forage_analyses_insert_staff on public.forage_analyses
  for insert to authenticated
  with check (
    stable_id = public.auth_stable_id()
    and public.auth_role() in ('stable_owner', 'stable_employee')
  );

create policy forage_analyses_update_staff on public.forage_analyses
  for update to authenticated
  using (
    stable_id = public.auth_stable_id()
    and public.auth_role() in ('stable_owner', 'stable_employee')
  )
  with check (
    stable_id = public.auth_stable_id()
    and public.auth_role() in ('stable_owner', 'stable_employee')
  );

create policy forage_analyses_delete_staff on public.forage_analyses
  for delete to authenticated
  using (
    stable_id = public.auth_stable_id()
    and public.auth_role() in ('stable_owner', 'stable_employee')
  );

create trigger trg_forage_analyses_updated_at
  before update on public.forage_analyses
  for each row execute function public.set_updated_at();

create trigger trg_block_when_read_only
  before insert or update or delete on public.forage_analyses
  for each row execute function public.block_when_read_only();

-- Marking a batch as in use takes the mark off the previous one, before the new row
-- is written, so the unique index never sees two.
create function public.forage_analyses_single_in_use()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.in_use and (tg_op = 'INSERT' or not old.in_use) then
    update public.forage_analyses
    set in_use = false
    where stable_id = new.stable_id and in_use and id <> new.id;
  end if;
  return new;
end;
$$;

revoke execute on function public.forage_analyses_single_in_use() from public, anon, authenticated;

create trigger trg_forage_analyses_single_in_use
  before insert or update of in_use on public.forage_analyses
  for each row execute function public.forage_analyses_single_in_use();

-- 2. What the calculator needs for each horse. Horse owners may change these for
--    their own horse, like the feeding plan.
alter table public.horses
  add column ideal_weight_kg numeric(5, 1)
    check (ideal_weight_kg is null or ideal_weight_kg between 50 and 1500),
  add column workload text
    check (workload is null or workload in ('none', 'light', 'moderate', 'hard')),
  add column forage_analysis_id uuid
    references public.forage_analyses(id) on delete set null,
  add column concentrate_kg_per_day numeric(4, 2)
    check (concentrate_kg_per_day is null or concentrate_kg_per_day between 0 and 20),
  add column concentrate_feh_per_kg numeric(4, 3)
    check (concentrate_feh_per_kg is null or concentrate_feh_per_kg between 0 and 2);

create index horses_forage_analysis_id_idx on public.horses (forage_analysis_id);

-- A horse can only use hay from its own stable.
create function public.check_horse_forage_analysis()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.forage_analysis_id is not null
    and (tg_op = 'INSERT' or new.forage_analysis_id is distinct from old.forage_analysis_id)
    and not exists (
      select 1 from public.forage_analyses fa
      where fa.id = new.forage_analysis_id and fa.stable_id = new.stable_id
    )
  then
    raise exception 'forage_analysis_not_in_stable';
  end if;
  return new;
end;
$$;

revoke execute on function public.check_horse_forage_analysis() from public, anon, authenticated;

create trigger trg_check_horse_forage_analysis
  before insert or update of forage_analysis_id on public.horses
  for each row execute function public.check_horse_forage_analysis();

-- 3. The read-only message still had the old name.
create or replace function public.block_when_read_only()
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
    raise exception 'Abonnementet er ikke aktivt, så StallOrg er skrivebeskyttet. Stalleieren kan ordne dette under Innstillinger → Abonnement.'
      using errcode = 'P0001', hint = 'subscription_read_only';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
