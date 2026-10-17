import { supabase } from '../../lib/supabaseClient'
import type { Database } from '../../types/supabase'

export type Paddock = Database['public']['Tables']['paddocks']['Row']
export type PaddockInsert = Database['public']['Tables']['paddocks']['Insert']
export type PaddockUpdate = Database['public']['Tables']['paddocks']['Update']

export type PaddockHorse = Pick<
  Database['public']['Tables']['horses']['Row'],
  'id' | 'name' | 'active'
> & {
  owner: Pick<
    Database['public']['Tables']['owners']['Row'],
    'id' | 'full_name'
  > | null
}

export type PaddockWithHorses = Paddock & { horses: PaddockHorse[] }

export async function listPaddocks(): Promise<PaddockWithHorses[]> {
  const { data, error } = await supabase
    .from('paddocks')
    .select(
      '*, horses(id, name, active, owner:owners!horses_owner_id_fkey(id, full_name))',
    )
    .order('name')
  if (error) throw error
  return data
}

export async function createPaddock(input: PaddockInsert): Promise<Paddock> {
  const { data, error } = await supabase
    .from('paddocks')
    .insert(input)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updatePaddock(
  id: string,
  input: PaddockUpdate,
): Promise<Paddock> {
  const { data, error } = await supabase
    .from('paddocks')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deletePaddock(id: string): Promise<void> {
  const { error } = await supabase.from('paddocks').delete().eq('id', id)
  if (error) throw error
}
