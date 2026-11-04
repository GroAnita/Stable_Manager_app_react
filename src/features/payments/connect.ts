import { supabaseFunctionError } from '../../lib/supabaseFunctionError'
import { supabase } from '../../lib/supabaseClient'
import { webOrigin } from '../../lib/platform'

export type StripeConnectStatus = {
  connected: boolean
  chargesEnabled: boolean
  payoutsEnabled: boolean
  livemode: boolean
}

// RLS only returns a row to the stable's owner, so everyone else gets false.
export async function isPaymentsAddonEnabled(
  stableId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('stable_payment_accounts')
    .select('addon_enabled')
    .eq('stable_id', stableId)
    .maybeSingle()
  if (error) throw error
  return data?.addon_enabled ?? false
}

export async function getStripeConnectStatus(): Promise<StripeConnectStatus> {
  const { data, error } = await supabase.functions.invoke<StripeConnectStatus>(
    'stripe-connect',
    { body: { action: 'status' } },
  )
  if (error) throw await supabaseFunctionError(error)
  if (!data) throw new Error('Empty response from stripe-connect')
  return data
}

export async function startStripeOnboarding(): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{ url: string }>(
    'stripe-connect',
    { body: { action: 'start', returnOrigin: webOrigin() } },
  )
  if (error) throw await supabaseFunctionError(error)
  if (!data) throw new Error('Empty response from stripe-connect')
  return data.url
}
