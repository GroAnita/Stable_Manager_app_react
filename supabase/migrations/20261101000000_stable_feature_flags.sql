-- Stables come in different shapes (boarding, riding school, sales,
-- private) that each need slightly different modules turned on.
-- Rather than branching app code on a rigid "type", stable_type is only
-- a preset used at creation time; the actual gating is enabled_features,
-- a per-stable jsonb map of feature-key -> boolean that the app checks.

create type public.stable_type as enum ('boarding', 'riding_school', 'sales', 'private');

alter table public.stables
  add column stable_type public.stable_type not null default 'boarding',
  add column enabled_features jsonb not null default '{}'::jsonb;

-- create_stable's signature is changing (new p_stable_type param), so the
-- old 6-arg overload has to be dropped explicitly — `create or replace`
-- only replaces a function with an identical argument list, otherwise it
-- adds a second overload, which PostgREST can't resolve between.
drop function if exists public.create_stable(text, text, text, text, text, text);

create or replace function public.create_stable(
  p_name text,
  p_address text default null,
  p_city text default null,
  p_postal_code text default null,
  p_phone text default null,
  p_email text default null,
  p_stable_type text default 'boarding'
)
returns stables
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_stable public.stables;
  v_type public.stable_type;
  v_features jsonb;
begin
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Stable name is required';
  end if;

  v_type := coalesce(p_stable_type::public.stable_type, 'boarding');

  v_features := case v_type
    when 'riding_school' then
      '{"lesson_booking": true, "instructor_scheduling": true}'::jsonb
    when 'sales' then
      '{"sales_listings": true}'::jsonb
    else '{}'::jsonb
  end;

  insert into public.stables
    (name, address, city, postal_code, phone, email, owner_user_id, stable_type, enabled_features)
  values
    (p_name, p_address, p_city, p_postal_code, p_phone, p_email, auth.uid(), v_type, v_features)
  returning * into v_stable;

  perform set_config('app.bypass_profile_guard', 'true', true);
  update public.profiles
  set stable_id = v_stable.id, role = 'stable_owner'
  where id = auth.uid();

  return v_stable;
end;
$$;

revoke execute on function public.create_stable(text, text, text, text, text, text, text) from public, anon;
