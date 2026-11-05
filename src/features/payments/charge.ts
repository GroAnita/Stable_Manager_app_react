import { supabaseFunctionError } from '../../lib/supabaseFunctionError'
import { supabase } from '../../lib/supabaseClient'

export type ChargeResult = {
  outcome?: 'succeeded' | 'processing' | 'failed' | 'unknown'
  blocked?: string
  reason?: string
  testMode: boolean
}

export async function chargeInvoice(paymentId: string): Promise<ChargeResult> {
  const { data, error } = await supabase.functions.invoke<ChargeResult>(
    'charge-invoice',
    { body: { paymentId } },
  )
  if (error) throw await supabaseFunctionError(error)
  if (!data) throw new Error('Empty response from charge-invoice')
  return data
}

// Contracts whose boarder has an agreement in force and a saved card.
export async function listContractsWithCardAgreement(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('card_agreements')
    .select('contract_id')
    .is('withdrawn_at', null)
    .not('activated_at', 'is', null)
  if (error) throw error
  return new Set(data.map((row) => row.contract_id))
}
