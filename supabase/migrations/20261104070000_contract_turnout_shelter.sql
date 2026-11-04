-- Lets a contract cover a turnout shelter (utegang) instead of a stall.
-- A contract holds one or the other, even though a horse itself can be
-- assigned both.

alter table public.contracts
add column turnout_shelter_id uuid
references public.turnout_shelters (id) on delete set null;

alter table public.contracts
add constraint contracts_stall_or_turnout_shelter
check (stall_id is null or turnout_shelter_id is null);
