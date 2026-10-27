-- Lets a stable write its own standard contract terms once (e.g. notice
-- period, liability, house rules) and have new contracts prefill from it,
-- while each contract keeps its own editable copy for exceptions.
alter table public.stables
  add column default_contract_terms text;

alter table public.contracts
  add column contract_terms text;

notify pgrst, 'reload schema';
