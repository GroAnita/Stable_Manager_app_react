-- Lets a contract's monthly rent be filled in from a "Boarding" category
-- price list item, the same way hay/bedding already reference their items.

alter table public.contracts
  add column boarding_price_list_item_id uuid references public.price_list_items(id);
