import {
  buildCardAgreementOverview,
  type OverviewLine,
} from '../../lib/cardAgreementOverview'
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

export async function changeSavedCard(contractId: string): Promise<string> {
  const { url } = await invoke<{ url: string }>({
    action: 'change_card',
    contractId,
    returnOrigin: webOrigin(),
  })
  return url
}

// Every active contract with where its card agreement stands, signed or not.
export async function listCardAgreementOverview(): Promise<OverviewLine[]> {
  const [contracts, agreements] = await Promise.all([
    supabase
      .from('contracts')
      .select('id, horse:horses(name), owner:owners(full_name)')
      .eq('status', 'active'),
    supabase
      .from('card_agreements')
      .select(
        'contract_id, accepted_at, activated_at, paused_at, withdrawn_at, charge_day, card_brand, card_last4',
      ),
  ])
  if (contracts.error) throw contracts.error
  if (agreements.error) throw agreements.error
  return buildCardAgreementOverview(
    contracts.data.map((contract) => ({
      id: contract.id,
      horseName: contract.horse?.name ?? '—',
      ownerName: contract.owner?.full_name ?? '—',
    })),
    agreements.data,
  )
}

export async function withdrawCardAgreement(contractId: string): Promise<void> {
  await invoke({ action: 'withdraw', contractId })
}
