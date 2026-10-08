import { supabase } from '../../lib/supabaseClient'
import type { Database } from '../../types/supabase'

export type InventoryItem =
  Database['public']['Tables']['inventory_items']['Row']
export type InventoryItemInsert =
  Database['public']['Tables']['inventory_items']['Insert']
export type InventoryItemUpdate =
  Database['public']['Tables']['inventory_items']['Update']

export type InventoryDelivery =
  Database['public']['Tables']['inventory_deliveries']['Row']
export type InventoryDeliveryInsert =
  Database['public']['Tables']['inventory_deliveries']['Insert']

export type InventoryItemWithDeliveries = InventoryItem & {
  price_list_item: Pick<
    Database['public']['Tables']['price_list_items']['Row'],
    'id' | 'item' | 'unit' | 'category'
  >
  deliveries: InventoryDelivery[]
}

export async function listInventoryItems(): Promise<
  InventoryItemWithDeliveries[]
> {
  const { data, error } = await supabase
    .from('inventory_items')
    .select(
      `*,
       price_list_item:price_list_items(id, item, unit, category),
       deliveries:inventory_deliveries(*)`,
    )
  if (error) throw error
  return data
}

export async function createInventoryItem(
  input: InventoryItemInsert,
): Promise<InventoryItem> {
  const { data, error } = await supabase
    .from('inventory_items')
    .insert(input)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateInventoryItem(
  id: string,
  input: InventoryItemUpdate,
): Promise<InventoryItem> {
  const { data, error } = await supabase
    .from('inventory_items')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteInventoryItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('inventory_items')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function createDelivery(
  input: InventoryDeliveryInsert,
): Promise<InventoryDelivery> {
  const { data, error } = await supabase
    .from('inventory_deliveries')
    .insert(input)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteDelivery(id: string): Promise<void> {
  const { error } = await supabase
    .from('inventory_deliveries')
    .delete()
    .eq('id', id)
  if (error) throw error
}
