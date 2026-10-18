import { supabase } from '../../lib/supabaseClient'
import type { Database } from '../../types/supabase'

export type TurnoutShelter =
  Database['public']['Tables']['turnout_shelters']['Row']
export type TurnoutShelterInsert =
  Database['public']['Tables']['turnout_shelters']['Insert']
export type TurnoutShelterUpdate =
  Database['public']['Tables']['turnout_shelters']['Update']

export type TurnoutShelterHorse = Pick<
  Database['public']['Tables']['horses']['Row'],
  'id' | 'name' | 'active'
> & {
  owner: Pick<
    Database['public']['Tables']['owners']['Row'],
    'id' | 'full_name'
  > | null
}

export type TurnoutShelterWithHorses = TurnoutShelter & {
  horses: TurnoutShelterHorse[]
}

export async function listTurnoutShelters(): Promise<
  TurnoutShelterWithHorses[]
> {
  const { data, error } = await supabase
    .from('turnout_shelters')
    .select(
      '*, horses(id, name, active, owner:owners!horses_owner_id_fkey(id, full_name))',
    )
    .order('name')
  if (error) throw error
  return data
}

export async function createTurnoutShelter(
  input: TurnoutShelterInsert,
): Promise<TurnoutShelter> {
  const { data, error } = await supabase
    .from('turnout_shelters')
    .insert(input)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateTurnoutShelter(
  id: string,
  input: TurnoutShelterUpdate,
): Promise<TurnoutShelter> {
  const { data, error } = await supabase
    .from('turnout_shelters')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteTurnoutShelter(id: string): Promise<void> {
  const { error } = await supabase.from('turnout_shelters').delete().eq('id', id)
  if (error) throw error
}
