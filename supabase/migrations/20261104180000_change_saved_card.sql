-- Lets a boarder replace the card on an agreement already in force. The new card
-- only takes over once saved on Stripe's page, so the old one stays in use until
-- then. The accepted wording and date don't change.

alter table public.card_agreements
  add column pending_card_session_id text;
