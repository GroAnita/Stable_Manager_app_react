import { webOrigin } from '../../lib/platform'
import { supabaseFunctionError } from '../../lib/supabaseFunctionError'
import { supabase } from '../../lib/supabaseClient'

export type CardAgreementText = {
  version: string
  title: string
  intro: string
  details: string[]
  sections: { heading: string; paragraphs: string[] }[]
  acceptance: string
}

export type CardAgreementStatus =
  | { available: false }
  | {
      available: boolean
      active: true
      chargeDay: number
      acceptedAt: string
      cardBrand: string | null
      cardLast4: string | null
      agreementText: string
      pausedAt: string | null
    }
  | {
      available: true
      active: false
      missingEmail: boolean
      chargeDay: number
      agreement: CardAgreementText
    }

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>('card-agreement', {
    body,
  })
  if (error) throw await supabaseFunctionError(error)
  if (!data) throw new Error('Empty response from card-agreement')
  return data
}

export function getCardAgreementStatus(
  contractId: string,
): Promise<CardAgreementStatus> {
  return invoke({ action: 'status', contractId })
}

export async function acceptCardAgreement(
  contractId: string,
  version: string,
): Promise<string> {
  const { url } = await invoke<{ url: string }>({
    action: 'accept',
    contractId,
    version,
    accepted: true,
    returnOrigin: webOrigin(),
  })
  return url
}

export async function withdrawCardAgreement(contractId: string): Promise<void> {
  await invoke({ action: 'withdraw', contractId })
}
