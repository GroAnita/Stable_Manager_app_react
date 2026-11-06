import type { Database } from '../../types/supabase'
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

export type BillingRules = { addonEnabled: boolean; chargeDay: number }

// Staff who log extras need these too, and they can't read
// stable_payment_accounts directly.
export async function getBillingRules(): Promise<BillingRules> {
  const { data, error } = await supabase.rpc('get_billing_rules')
  if (error) throw error
  const rules = data?.[0]
  return {
    addonEnabled: rules?.addon_enabled ?? false,
    chargeDay: rules?.charge_day ?? 25,
  }
}

export async function setChargeDay(chargeDay: number): Promise<void> {
  const { error } = await supabase.rpc('set_charge_day', {
    p_charge_day: chargeDay,
  })
  if (error) throw error
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

export type PlanChange = {
  scheduled_plan: string | null
  scheduled_plan_on: string | null
  plan_change_status: string | null
  plan_change_error: string | null
}

export async function getPlanChange(
  stableId: string,
): Promise<PlanChange | null> {
  const { data, error } = await supabase
    .from('stable_payment_accounts')
    .select(
      'scheduled_plan, scheduled_plan_on, plan_change_status, plan_change_error',
    )
    .eq('stable_id', stableId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function schedulePlanChange(
  plan: Database['public']['Enums']['stable_plan'],
  on: string,
): Promise<number> {
  const { data, error } = await supabase.rpc('schedule_plan_change', {
    p_plan: plan,
    p_on: on,
  })
  if (error) throw error
  return data
}

export async function cancelPlanChange(): Promise<void> {
  const { error } = await supabase.rpc('cancel_plan_change')
  if (error) throw error
}

// Tells boarders with automatic payment about the plan, or that it's off again.
export async function notifyPlanChange(): Promise<void> {
  const { error } = await supabase.functions.invoke('plan-change', { body: {} })
  if (error) throw await supabaseFunctionError(error)
}

export async function getCardSigningEnabled(
  stableId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('stable_payment_accounts')
    .select('card_signing_enabled')
    .eq('stable_id', stableId)
    .maybeSingle()
  if (error) throw error
  return data?.card_signing_enabled ?? false
}

export async function setCardSigningEnabled(enabled: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_card_signing_enabled', {
    p_enabled: enabled,
  })
  if (error) throw error
}
