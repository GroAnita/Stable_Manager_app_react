import { supabase } from '../../lib/supabaseClient'
import { supabaseFunctionError } from '../../lib/supabaseFunctionError'
import type { Database } from '../../types/supabase'

export type Contract = Database['public']['Tables']['contracts']['Row']
export type ContractInsert = Database['public']['Tables']['contracts']['Insert']
export type ContractUpdate = Database['public']['Tables']['contracts']['Update']

export type PriceListItemOption = Pick<
  Database['public']['Tables']['price_list_items']['Row'],
  'id' | 'item' | 'unit' | 'price' | 'vat_exempt'
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
  | 'mucking_schedule'
  | 'turnout_schedule'
  | 'notice_given_at'
> & {
  horse: Pick<
    Database['public']['Tables']['horses']['Row'],
    'id' | 'name' | 'away'
  > | null
  owner: Pick<
    Database['public']['Tables']['owners']['Row'],
    'id' | 'full_name'
  > | null
  hay_item: Pick<
    Database['public']['Tables']['price_list_items']['Row'],
    'price' | 'vat_exempt'
  > | null
  bedding_item: Pick<
    Database['public']['Tables']['price_list_items']['Row'],
    'price' | 'vat_exempt'
  > | null
  mucking_item: Pick<
    Database['public']['Tables']['price_list_items']['Row'],
    'price' | 'unit' | 'vat_exempt'
  > | null
  turnout_item: Pick<
    Database['public']['Tables']['price_list_items']['Row'],
    'price' | 'unit' | 'vat_exempt'
  > | null
}

export type ContractAllocation = Pick<
  Contract,
  | 'hay_price_list_item_id'
  | 'included_hay_kg'
  | 'bedding_price_list_item_id'
  | 'bedding_quantity'
>

export async function listActiveContractAllocations(): Promise<
  ContractAllocation[]
> {
  const { data, error } = await supabase
    .from('contracts')
    .select(
      'hay_price_list_item_id, included_hay_kg, bedding_price_list_item_id, bedding_quantity',
    )
    .eq('status', 'active')
  if (error) throw error
  return data
}

export async function listContracts(): Promise<ContractListItem[]> {
  const { data, error } = await supabase
    .from('contracts')
    .select(
      `id, monthly_rent, included_hay_kg, bedding_quantity, start_date, end_date, status,
       mucking_schedule, turnout_schedule, notice_given_at,
       horse:horses(id, name, away),
       owner:owners(id, full_name),
       hay_item:price_list_items!contracts_hay_price_list_item_id_fkey(price, vat_exempt),
       bedding_item:price_list_items!contracts_bedding_price_list_item_id_fkey(price, vat_exempt),
       mucking_item:price_list_items!contracts_mucking_price_list_item_id_fkey(price, unit, vat_exempt),
       turnout_item:price_list_items!contracts_turnout_price_list_item_id_fkey(price, unit, vat_exempt)`,
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
    'id' | 'name' | 'away' | 'breed' | 'color' | 'gender' | 'microchip_number'
  > | null
  owner: Pick<
    Database['public']['Tables']['owners']['Row'],
    'id' | 'full_name' | 'phone' | 'email' | 'address' | 'postal_code' | 'city'
  > | null
  stall: Pick<
    Database['public']['Tables']['stalls']['Row'],
    'id' | 'stall_number'
  > | null
  turnout_shelter: Pick<
    Database['public']['Tables']['turnout_shelters']['Row'],
    'id' | 'name'
  > | null
  boarding_item: PriceListItemOption | null
  hay_item: PriceListItemOption | null
  bedding_item: PriceListItemOption | null
  mucking_item: PriceListItemOption | null
  turnout_item: PriceListItemOption | null
  stable: Pick<
    Database['public']['Tables']['stables']['Row'],
    | 'name'
    | 'address'
    | 'city'
    | 'postal_code'
    | 'phone'
    | 'email'
    | 'org_number'
    | 'default_contract_terms'
  > | null
}

export async function getContractDetail(id: string): Promise<ContractDetail> {
  const { data, error } = await supabase
    .from('contracts')
    .select(
      `*,
       horse:horses(id, name, away, breed, color, gender, microchip_number),
       owner:owners(id, full_name, phone, email, address, postal_code, city),
       stall:stalls(id, stall_number),
       turnout_shelter:turnout_shelters(id, name),
       boarding_item:price_list_items!contracts_boarding_price_list_item_id_fkey(id, item, unit, price, vat_exempt),
       hay_item:price_list_items!contracts_hay_price_list_item_id_fkey(id, item, unit, price, vat_exempt),
       bedding_item:price_list_items!contracts_bedding_price_list_item_id_fkey(id, item, unit, price, vat_exempt),
       mucking_item:price_list_items!contracts_mucking_price_list_item_id_fkey(id, item, unit, price, vat_exempt),
       turnout_item:price_list_items!contracts_turnout_price_list_item_id_fkey(id, item, unit, price, vat_exempt),
       stable:stables(name, address, city, postal_code, phone, email, org_number, default_contract_terms)`,
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

export async function listBoardingItems(): Promise<PriceListItemOption[]> {
  const { data, error } = await supabase
    .from('price_list_items')
    .select('id, item, unit, price, vat_exempt')
    .eq('category', 'Boarding')
    .order('item')
  if (error) throw error
  return data
}

export async function getEmptyBoxRate(
  stableId: string,
): Promise<number | null> {
  const { data, error } = await supabase
    .from('price_list_items')
    .select('price')
    .eq('stable_id', stableId)
    .eq('category', 'EmptyBox')
    .order('created_at')
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data?.price ?? null
}

export async function listHayItems(): Promise<PriceListItemOption[]> {
  const { data, error } = await supabase
    .from('price_list_items')
    .select('id, item, unit, price, vat_exempt')
    .eq('category', 'Hay')
    .order('item')
  if (error) throw error
  return data
}

export async function listBeddingItems(): Promise<PriceListItemOption[]> {
  const { data, error } = await supabase
    .from('price_list_items')
    .select('id, item, unit, price, vat_exempt')
    .in('category', ['Bedding', 'Straw'])
    .order('item')
  if (error) throw error
  return data
}

export async function listServiceItems(
  category: 'Mucking' | 'Turnout',
): Promise<PriceListItemOption[]> {
  const { data, error } = await supabase
    .from('price_list_items')
    .select('id, item, unit, price, vat_exempt')
    .eq('category', category)
    .order('item')
  if (error) throw error
  return data
}

export function noticeEndDatePreview(
  noticeMonths: number,
  today = new Date(),
): string {
  const [year, month, day] = today
    .toLocaleDateString('sv-SE', { timeZone: 'Europe/Oslo' })
    .split('-')
    .map(Number)
  const lastDay = new Date(
    Date.UTC(year, month - 1 + noticeMonths + 1, 0),
  ).getUTCDate()
  return new Date(
    Date.UTC(year, month - 1 + noticeMonths, Math.min(day, lastDay)),
  )
    .toISOString()
    .slice(0, 10)
}

export async function giveContractNotice(
  contractId: string,
  endDate: string | null,
): Promise<string> {
  const { data, error } = await supabase.rpc('give_contract_notice', {
    p_contract_id: contractId,
    p_end_date: endDate,
  })
  if (error) throw error
  return data
}

export async function cancelContractNotice(contractId: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_contract_notice', {
    p_contract_id: contractId,
  })
  if (error) throw error
}

export async function sendContractNoticeEmail(
  contractId: string,
): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke<{ sent: boolean }>(
    'contract-notice',
    { body: { contractId } },
  )
  if (error) throw await supabaseFunctionError(error)
  return data?.sent ?? false
}
