import { supabase } from '../../lib/supabaseClient'
import type { Database } from '../../types/supabase'

export type Stall = Database['public']['Tables']['stalls']['Row']
export type StallInsert = Database['public']['Tables']['stalls']['Insert']
export type StallUpdate = Database['public']['Tables']['stalls']['Update']

export type StallHorse = Pick<
  Database['public']['Tables']['horses']['Row'],
  'id' | 'name' | 'active'
> & {
  owner: Pick<
    Database['public']['Tables']['owners']['Row'],
    'id' | 'full_name'
  > | null
}

export type StallWithHorses = Stall & { horses: StallHorse[] }

export async function listStalls(): Promise<StallWithHorses[]> {
  const { data, error } = await supabase
    .from('stalls')
    .select('*, horses(id, name, active, owner:owners(id, full_name))')
    .order('stall_number')
  if (error) throw error
  return data
}

export async function createStall(input: StallInsert): Promise<Stall> {
  const { data, error } = await supabase
    .from('stalls')
    .insert(input)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateStall(
  id: string,
  input: StallUpdate,
): Promise<Stall> {
  const { data, error } = await supabase
    .from('stalls')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteStall(id: string): Promise<void> {
  const { error } = await supabase.from('stalls').delete().eq('id', id)
  if (error) throw error
}
