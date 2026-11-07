import { supabaseFunctionError } from '../../lib/supabaseFunctionError'
import { webOrigin } from '../../lib/platform'
import { supabase } from '../../lib/supabaseClient'
import type { Database } from '../../types/supabase'

export type Stable = Database['public']['Tables']['stables']['Row']
export type StableUpdate = Database['public']['Tables']['stables']['Update']
export type StableType = Database['public']['Enums']['stable_type']
export type Profile = Database['public']['Tables']['profiles']['Row'] & {
  stable: Pick<
    Stable,
    'name' | 'logo_url' | 'enabled_features' | 'vat_registered' | 'closed_at'
  > | null
}

export async function getMyProfile(): Promise<Profile> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in.')
  const { data, error } = await supabase
    .from('profiles')
    .select(
      '*, stable:stables(name, logo_url, enabled_features, vat_registered, closed_at)',
    )
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
  stable_type?: StableType
}): Promise<Stable> {
  const { data, error } = await supabase.rpc('create_stable', {
    p_name: input.name,
    p_address: input.address ?? undefined,
    p_city: input.city ?? undefined,
    p_postal_code: input.postal_code ?? undefined,
    p_phone: input.phone ?? undefined,
    p_email: input.email ?? undefined,
    p_stable_type: input.stable_type ?? undefined,
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

export type SubscriptionPlan =
  Database['public']['Tables']['subscription_plans']['Row']

export async function listSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  const { data, error } = await supabase
    .from('subscription_plans')
    .select('*')
    .order('sort_order')
  if (error) throw error
  return data
}

export type StableBilling = {
  status: string
  trial_ends_at: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  past_due_since: string | null
  has_subscription: boolean
  read_only: boolean
}

export async function getStableBilling(): Promise<StableBilling | null> {
  const { data, error } = await supabase.rpc('get_stable_billing_state')
  if (error) throw error
  return data[0] ?? null
}

async function invokeBilling<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>('stripe-billing', {
    body: { ...body, returnOrigin: webOrigin() },
  })
  if (error) throw await supabaseFunctionError(error)
  if (!data) throw new Error('Empty response from stripe-billing')
  return data
}

export async function startSubscriptionCheckout(plan: string): Promise<string> {
  const { url } = await invokeBilling<{ url: string }>({
    action: 'checkout',
    plan,
  })
  return url
}

export async function openSubscriptionPortal(): Promise<string> {
  const { url } = await invokeBilling<{ url: string }>({ action: 'portal' })
  return url
}

export async function changeSubscriptionPlan(plan: string): Promise<void> {
  await invokeBilling({ action: 'change_plan', plan })
}

// Deletes the signed-in user's account. A stable owner's stable is closed and
// deleted after 3 months instead; see the delete-account function.
export async function deleteMyAccount(): Promise<'deleted' | 'stable_closed'> {
  const { data, error } = await supabase.functions.invoke('delete-account', {
    body: { confirm: 'SLETT' },
  })
  if (error) throw await supabaseFunctionError(error)
  return data.result
}
