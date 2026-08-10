import { supabase } from './supabaseClient'

export async function getCurrentStableId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('stable_id')
    .eq('id', user.id)
    .single()
  if (error) throw error
  return data.stable_id
}
