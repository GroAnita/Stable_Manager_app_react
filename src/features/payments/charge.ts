import { supabaseFunctionError } from '../../lib/supabaseFunctionError'
import { supabase } from '../../lib/supabaseClient'

export type ChargeResult = {
  outcome?: 'succeeded' | 'processing' | 'failed' | 'unknown'
  blocked?: string
  reason?: string
  boarderNotified?: boolean
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

// Contracts whose boarder has an agreement in force and a saved card, and whether
// charges on each are paused.
export async function listContractsWithCardAgreement(): Promise<
  Map<string, { paused: boolean }>
> {
  const { data, error } = await supabase
    .from('card_agreements')
    .select('contract_id, paused_at')
    .is('withdrawn_at', null)
    .not('activated_at', 'is', null)
  if (error) throw error
  return new Map(
    data.map((row) => [row.contract_id, { paused: row.paused_at !== null }]),
  )
}

export async function setCardAgreementPaused(
  contractId: string,
  paused: boolean,
): Promise<void> {
  const { error } = await supabase.rpc('set_card_agreement_paused', {
    p_contract_id: contractId,
    p_paused: paused,
  })
  if (error) throw error
}
