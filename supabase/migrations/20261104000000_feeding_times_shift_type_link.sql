-- Lets a horse's feeding time reference the stable's own premade feeding
-- shift type (the "stable routine": Morning/Lunch/Dinner/etc., already used
-- by the feeding rota) instead of each horse retyping its own label and
-- time. Nullable and kept alongside the existing label/time_of_day columns
-- so existing per-horse entries keep working untouched; new/edited entries
-- populate both the link and a snapshot of the label/time for display.
alter table public.feeding_times
  add column feeding_shift_type_id uuid references public.feeding_shift_types(id) on delete set null;
