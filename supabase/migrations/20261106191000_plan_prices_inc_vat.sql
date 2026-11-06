-- Plan prices set 25 % higher, rounded to whole kroner, so they can stay the same for
-- customers when Nestun Digital registers for VAT. Until then no VAT is charged and
-- the price is just the price; after that, the same price includes VAT.

update public.subscription_plans
set price_nok = case key
  when 'small' then 374
  when 'medium' then 749
  when 'large' then 1124
  when 'xlarge' then 1499
  when 'small_payments' then 624
  when 'medium_payments' then 999
  when 'large_payments' then 1374
  when 'xlarge_payments' then 1749
end
where key in (
  'small', 'medium', 'large', 'xlarge',
  'small_payments', 'medium_payments', 'large_payments', 'xlarge_payments'
);
