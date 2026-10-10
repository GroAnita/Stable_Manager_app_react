import { supabase } from '../../lib/supabaseClient'
import type { Database } from '../../types/supabase'

export type Stable = Database['public']['Tables']['stables']['Row']
export type StableUpdate = Database['public']['Tables']['stables']['Update']
export type Profile = Database['public']['Tables']['profiles']['Row'] & {
  stable: Pick<Stable, 'name' | 'logo_url'> | null
}

export async function getMyProfile(): Promise<Profile> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in.')
  const { data, error } = await supabase
    .from('profiles')
    .select('*, stable:stables(name, logo_url)')
    .eq('id', user.id)
    .single()
  if (error) throw error
  return data
}

export async function uploadStableLogo({
  stableId,
  file,
}: {
  stableId: string
  file: File
}): Promise<string> {
  const extension = file.name.split('.').pop() ?? 'png'
  const path = `${stableId}/logo-${Date.now()}.${extension}`
  const { error: uploadError } = await supabase.storage
    .from('stable-logos')
    .upload(path, file, { upsert: true })
  if (uploadError) throw uploadError
  const { data } = supabase.storage.from('stable-logos').getPublicUrl(path)
  return data.publicUrl
}

export async function createStable(input: {
  name: string
  address?: string | null
  city?: string | null
  postal_code?: string | null
  phone?: string | null
  email?: string | null
}): Promise<Stable> {
  const { data, error } = await supabase.rpc('create_stable', {
    p_name: input.name,
    p_address: input.address ?? undefined,
    p_city: input.city ?? undefined,
    p_postal_code: input.postal_code ?? undefined,
    p_phone: input.phone ?? undefined,
    p_email: input.email ?? undefined,
  })
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
