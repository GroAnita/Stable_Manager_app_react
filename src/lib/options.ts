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
  'id' | 'name' | 'away'
>
export type StaffOption = Pick<
  Database['public']['Tables']['profiles']['Row'],
  'id' | 'full_name'
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
    .select('id, name, away')
    .eq('active', true)
    .order('name')
  if (error) throw error
  return data
}

export async function listStaffOptions(): Promise<StaffOption[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name')
    .order('full_name')
  if (error) throw error
  return data
}
