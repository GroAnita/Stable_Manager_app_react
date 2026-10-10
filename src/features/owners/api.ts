import { supabase } from '../../lib/supabaseClient'
import type { Database } from '../../types/supabase'

export type Owner = Database['public']['Tables']['owners']['Row']
export type OwnerInsert = Database['public']['Tables']['owners']['Insert']
export type OwnerUpdate = Database['public']['Tables']['owners']['Update']

export type OwnerHorse = Pick<
  Database['public']['Tables']['horses']['Row'],
  'id' | 'name' | 'breed' | 'status' | 'away'
> & {
  stall: Pick<
    Database['public']['Tables']['stalls']['Row'],
    'stall_number'
  > | null
}

export async function getMyOwnerRecord(): Promise<Owner | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase
    .from('owners')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function listOwners(): Promise<Owner[]> {
  const { data, error } = await supabase
    .from('owners')
    .select('*')
    .order('full_name')
  if (error) throw error
  return data
}

export async function getOwner(id: string): Promise<Owner> {
  const { data, error } = await supabase
    .from('owners')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function getOwnerHorses(ownerId: string): Promise<OwnerHorse[]> {
  const { data, error } = await supabase
    .from('horses')
    .select('id, name, breed, status, away, stall:stalls(stall_number)')
    .eq('owner_id', ownerId)
    .order('name')
  if (error) throw error
  return data
}

export async function createOwner(input: OwnerInsert): Promise<Owner> {
  const { data, error } = await supabase
    .from('owners')
    .insert(input)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateOwner(
  id: string,
  input: OwnerUpdate,
): Promise<Owner> {
  const { data, error } = await supabase
    .from('owners')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteOwner(id: string): Promise<void> {
  const { error } = await supabase.from('owners').delete().eq('id', id)
  if (error) throw error
}
