-- A bill the stable has logged ahead of time can be marked as paid, so it stops
-- showing under "Fakturaer å betale" and in the menu badge. Expenses logged after
-- they were paid simply leave it empty.
alter table public.expenses
  add column paid_at timestamptz;
