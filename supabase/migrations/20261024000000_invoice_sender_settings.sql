-- Invoice sender details: org number, registry status, bank account, payment terms, footer text.
-- Reuses stables.name/address/postal_code/city/phone/email as the invoice sender identity.
alter table public.stables
  add column org_number text,
  add column vat_registered boolean not null default false,
  add column business_register_registered boolean not null default false,
  add column bank_account_number text,
  add column payment_terms_days integer not null default 14,
  add column invoice_footer_text text,
  add constraint stables_org_number_format
    check (org_number is null or org_number ~ '^[0-9]{9}$'),
  add constraint stables_bank_account_number_format
    check (bank_account_number is null or bank_account_number ~ '^[0-9]{11}$'),
  add constraint stables_payment_terms_days_positive
    check (payment_terms_days > 0);

notify pgrst, 'reload schema';
