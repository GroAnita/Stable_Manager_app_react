import { webOrigin } from '../../lib/platform'
import { supabaseFunctionError } from '../../lib/supabaseFunctionError'
import { supabase } from '../../lib/supabaseClient'

export type PayResult = { url?: string; state?: string; blocked?: string }

async function invoke(body: Record<string, unknown>): Promise<PayResult> {
  const { data, error } = await supabase.functions.invoke<PayResult>(
    'pay-invoice',
    { body },
  )
  if (error) throw await supabaseFunctionError(error)
  if (!data) throw new Error('Empty response from pay-invoice')
  return data
}

export function startInvoicePayment(paymentId: string): Promise<PayResult> {
  return invoke({ action: 'start', paymentId, returnOrigin: webOrigin() })
}

export function syncInvoicePayment(paymentId: string): Promise<PayResult> {
  return invoke({ action: 'sync', paymentId })
}

export async function canPayInvoicesOnline(): Promise<boolean> {
  const { data, error } = await supabase.rpc('can_pay_invoices_online')
  if (error) throw error
  return data === true
}
