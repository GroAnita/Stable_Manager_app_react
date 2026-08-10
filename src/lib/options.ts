import { supabase } from './supabaseClient'
import type { Database } from '../types/supabase'

export type OwnerOption = Pick<
  Database['public']['Tables']['owners']['Row'],
  'id' | 'full_name'
>
export type StallOption = Pick<
  Database['public']['Tables']['stalls']['Row'],
  'id' | 'stall_number'
>
export type HorseOption = Pick<
  Database['public']['Tables']['horses']['Row'],
  'id' | 'name'
>

export async function listOwnerOptions(): Promise<OwnerOption[]> {
  const { data, error } = await supabase
    .from('owners')
    .select('id, full_name')
    .order('full_name')
  if (error) throw error
  return data
}

export async function listStallOptions(): Promise<StallOption[]> {
  const { data, error } = await supabase
    .from('stalls')
    .select('id, stall_number')
    .order('stall_number')
  if (error) throw error
  return data
}

export async function listHorseOptions(): Promise<HorseOption[]> {
  const { data, error } = await supabase
    .from('horses')
    .select('id, name')
    .eq('active', true)
    .order('name')
  if (error) throw error
  return data
}
