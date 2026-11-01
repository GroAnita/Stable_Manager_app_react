import { supabase } from '../../lib/supabaseClient'
import type { Database } from '../../types/supabase'

export type Rider = Database['public']['Tables']['riders']['Row']
export type RiderInsert = Database['public']['Tables']['riders']['Insert']
export type RiderUpdate = Database['public']['Tables']['riders']['Update']

export type RiderWithOwner = Rider & {
  owner: Pick<Database['public']['Tables']['owners']['Row'], 'id' | 'full_name'> | null
}

export async function listRiders(ownerId: string): Promise<Rider[]> {
  const { data, error } = await supabase
    .from('riders')
    .select('*')
    .eq('owner_id', ownerId)
    .order('full_name')
  if (error) throw error
  return data
}

/** Staff-only view across the whole stable — RLS scopes this to riders
 * whose owner belongs to the caller's stable, same as every other
 * staff-wide list in this app. */
export async function listAllRiders(): Promise<RiderWithOwner[]> {
  const { data, error } = await supabase
    .from('riders')
    .select('*, owner:owners(id, full_name)')
    .order('full_name')
  if (error) throw error
  return data
}

export async function createRider(input: RiderInsert): Promise<Rider> {
  const { data, error } = await supabase
    .from('riders')
    .insert(input)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateRider(id: string, input: RiderUpdate): Promise<Rider> {
  const { data, error } = await supabase
    .from('riders')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteRider(id: string): Promise<void> {
  const { error } = await supabase.from('riders').delete().eq('id', id)
  if (error) throw error
}
