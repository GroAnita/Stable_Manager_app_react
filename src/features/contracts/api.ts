import { supabase } from '../../lib/supabaseClient'
import type { Database } from '../../types/supabase'

export type Contract = Database['public']['Tables']['contracts']['Row']
export type ContractInsert = Database['public']['Tables']['contracts']['Insert']
export type ContractUpdate = Database['public']['Tables']['contracts']['Update']

export type PriceListItemOption = Pick<
  Database['public']['Tables']['price_list_items']['Row'],
  'id' | 'item' | 'unit' | 'price'
>

export type ContractListItem = Pick<
  Contract,
  | 'id'
  | 'monthly_rent'
  | 'included_hay_kg'
  | 'bedding_quantity'
  | 'start_date'
  | 'end_date'
  | 'status'
> & {
  horse: Pick<
    Database['public']['Tables']['horses']['Row'],
    'id' | 'name'
  > | null
  owner: Pick<
    Database['public']['Tables']['owners']['Row'],
    'id' | 'full_name'
  > | null
  hay_item: Pick<
    Database['public']['Tables']['price_list_items']['Row'],
    'price'
  > | null
  bedding_item: Pick<
    Database['public']['Tables']['price_list_items']['Row'],
    'price'
  > | null
}

export async function listContracts(): Promise<ContractListItem[]> {
  const { data, error } = await supabase
    .from('contracts')
    .select(
      `id, monthly_rent, included_hay_kg, bedding_quantity, start_date, end_date, status,
       horse:horses(id, name),
       owner:owners(id, full_name),
       hay_item:price_list_items!contracts_hay_price_list_item_id_fkey(price),
       bedding_item:price_list_items!contracts_bedding_price_list_item_id_fkey(price)`,
    )
    .order('end_date')
  if (error) throw error
  return data
}

export async function getActiveContractForHorse(
  horseId: string,
): Promise<Contract | null> {
  const { data, error } = await supabase
    .from('contracts')
    .select('*')
    .eq('horse_id', horseId)
    .eq('status', 'active')
    .maybeSingle()
  if (error) throw error
  return data
}

export async function getContract(id: string): Promise<Contract> {
  const { data, error } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export type ContractDetail = Contract & {
  horse: Pick<
    Database['public']['Tables']['horses']['Row'],
    'id' | 'name'
  > | null
  owner: Pick<
    Database['public']['Tables']['owners']['Row'],
    'id' | 'full_name' | 'phone'
  > | null
  stall: Pick<
    Database['public']['Tables']['stalls']['Row'],
    'id' | 'stall_number'
  > | null
  hay_item: PriceListItemOption | null
  bedding_item: PriceListItemOption | null
  stable: Pick<
    Database['public']['Tables']['stables']['Row'],
    'name' | 'address' | 'city' | 'postal_code' | 'phone' | 'email'
  > | null
}

export async function getContractDetail(id: string): Promise<ContractDetail> {
  const { data, error } = await supabase
    .from('contracts')
    .select(
      `*,
       horse:horses(id, name),
       owner:owners(id, full_name, phone),
       stall:stalls(id, stall_number),
       hay_item:price_list_items!contracts_hay_price_list_item_id_fkey(id, item, unit, price),
       bedding_item:price_list_items!contracts_bedding_price_list_item_id_fkey(id, item, unit, price),
       stable:stables(name, address, city, postal_code, phone, email)`,
    )
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createContract(input: ContractInsert): Promise<Contract> {
  const { data, error } = await supabase
    .from('contracts')
    .insert(input)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateContract(
  id: string,
  input: ContractUpdate,
): Promise<Contract> {
  const { data, error } = await supabase
    .from('contracts')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteContract(id: string): Promise<void> {
  const { error } = await supabase.from('contracts').delete().eq('id', id)
  if (error) throw error
}

export async function listHayItems(): Promise<PriceListItemOption[]> {
  const { data, error } = await supabase
    .from('price_list_items')
    .select('id, item, unit, price')
    .eq('category', 'Hay')
    .order('item')
  if (error) throw error
  return data
}

export async function listBeddingItems(): Promise<PriceListItemOption[]> {
  const { data, error } = await supabase
    .from('price_list_items')
    .select('id, item, unit, price')
    .eq('category', 'Bedding')
    .order('item')
  if (error) throw error
  return data
}
