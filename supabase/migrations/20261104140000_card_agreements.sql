-- Boarders accept the agreement on automatic card charges and save a card with
-- Stripe. The accepted wording is stored as it was shown, along with who accepted
-- it and when, because the text can change later. App users can only read these
-- rows; the card-agreement Edge Function writes them with the service role.
--
-- card_signing_enabled stays off until a stable is ready, so boarders don't see
-- signing just because the add-on is on.

alter table public.stable_payment_accounts
  add column card_signing_enabled boolean not null default false;

create table public.card_agreements (
  id uuid primary key default gen_random_uuid(),
  stable_id uuid not null references public.stables (id) on delete cascade,
  contract_id uuid not null references public.contracts (id) on delete cascade,
  owner_id uuid not null references public.owners (id) on delete cascade,
  accepted_by uuid references auth.users (id) on delete set null,
  accepted_by_name text not null,
  version text not null,
  agreement_text text not null,
  charge_day integer not null check (charge_day between 1 and 28),
  accepted_at timestamptz not null default now(),
  stripe_customer_id text,
  stripe_checkout_session_id text,
  stripe_payment_method_id text,
  card_brand text,
  card_last4 text,
  activated_at timestamptz,
  copy_sent_at timestamptz,
  withdrawn_at timestamptz,
  withdrawn_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One agreement in force, or waiting for its card, per contract.
create unique index card_agreements_one_open_per_contract
on public.card_agreements (contract_id)
where withdrawn_at is null;

create index card_agreements_owner_idx on public.card_agreements (owner_id);

create trigger trg_card_agreements_updated_at
before update on public.card_agreements
for each row execute function set_updated_at();

alter table public.card_agreements enable row level security;

create policy "card_agreements_select_staff"
on public.card_agreements for select
using (
  stable_id = auth_stable_id()
  and auth_role() in ('stable_owner', 'stable_employee')
);

create policy "card_agreements_select_own"
on public.card_agreements for select
using (
  exists (
    select 1 from public.owners o
    where o.id = card_agreements.owner_id and o.user_id = auth.uid()
  )
);

revoke insert, update, delete on public.card_agreements from anon, authenticated;

-- The boarder agreed to a specific date, so app users can't move it while the
-- agreement is in force, and can't mark a contract as agreed themselves.
create function public.protect_contract_card_agreement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.card_agreement_accepted_at := null;
    return new;
  end if;

  new.card_agreement_accepted_at := old.card_agreement_accepted_at;
  if old.card_agreement_accepted_at is not null
    and new.charge_day is distinct from old.charge_day then
    raise exception 'charge_day_locked';
  end if;
  return new;
end;
$$;

create trigger trg_protect_contract_card_agreement
before insert or update on public.contracts
for each row execute function public.protect_contract_card_agreement();

revoke execute on function public.protect_contract_card_agreement() from public, anon, authenticated;
