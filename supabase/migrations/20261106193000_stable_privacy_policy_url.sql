-- The stable's privacy statement, which the card agreement links to. Each stable is
-- the controller of its boarders' data, so the statement is the stable's own.

alter table public.stables
  add column privacy_policy_url text;
