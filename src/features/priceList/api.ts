import { supabase } from '../../lib/supabaseClient'
import type { Database } from '../../types/supabase'

export type PriceListItem =
  Database['public']['Tables']['price_list_items']['Row']
export type PriceListItemInsert =
  Database['public']['Tables']['price_list_items']['Insert']
export type PriceListItemUpdate =
  Database['public']['Tables']['price_list_items']['Update']

export async function listPriceListItems(): Promise<PriceListItem[]> {
  const { data, error } = await supabase
    .from('price_list_items')
    .select('*')
    .order('item')
  if (error) throw error
  return data
}

export async function createPriceListItem(
  input: PriceListItemInsert,
): Promise<PriceListItem> {
  const { data, error } = await supabase
    .from('price_list_items')
    .insert(input)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updatePriceListItem(
  id: string,
  input: PriceListItemUpdate,
): Promise<PriceListItem> {
  const { data, error } = await supabase
    .from('price_list_items')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deletePriceListItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('price_list_items')
    .delete()
    .eq('id', id)
  if (error) throw error
}
