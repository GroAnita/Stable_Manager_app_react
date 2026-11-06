-- Lets the stable owner turn signing on and off, instead of it being set by hand.
-- It controls whether boarders can sign the card agreement and use Betal nå. Turning
-- it off doesn't touch agreements already signed: those are stopped separately.

create function public.set_card_signing_enabled(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.auth_role() is distinct from 'stable_owner' then
    raise exception 'Only the stable owner can do this';
  end if;
  if p_enabled is null then
    raise exception 'Missing setting';
  end if;

  update public.stable_payment_accounts
  set card_signing_enabled = p_enabled
  where stable_id = public.auth_stable_id()
    -- Stripe has to be able to take payments before anyone can sign up to them.
    and (not p_enabled or (addon_enabled and charges_enabled));
  if not found then
    raise exception 'card_signing_not_ready';
  end if;
end;
$$;

revoke execute on function public.set_card_signing_enabled(boolean) from public, anon;
grant execute on function public.set_card_signing_enabled(boolean) to authenticated;
