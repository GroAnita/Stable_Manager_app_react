import { supabase } from '../../lib/supabaseClient'
import type { Database } from '../../types/supabase'

export type Stable = Database['public']['Tables']['stables']['Row']
export type StableUpdate = Database['public']['Tables']['stables']['Update']
export type Profile = Database['public']['Tables']['profiles']['Row']

export async function getMyProfile(): Promise<Profile> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in.')
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  if (error) throw error
  return data
}

export async function getStable(id: string): Promise<Stable> {
  const { data, error } = await supabase
    .from('stables')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function updateStable(
  id: string,
  input: StableUpdate,
): Promise<Stable> {
  const { data, error } = await supabase
    .from('stables')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}
