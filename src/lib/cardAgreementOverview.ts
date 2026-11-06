export type AgreementRow = {
  contract_id: string
  accepted_at: string
  activated_at: string | null
  paused_at: string | null
  withdrawn_at: string | null
  charge_day: number
  card_brand: string | null
  card_last4: string | null
  card_removed_at?: string | null
  card_removal_error?: string | null
}

export type OverviewContract = {
  id: string
  horseName: string
  ownerName: string
}

export type OverviewStatus =
  'active' | 'paused' | 'waitingForCard' | 'withdrawn' | 'notSigned'

export type OverviewLine = OverviewContract & {
  status: OverviewStatus
  agreement: AgreementRow | null
}

function statusOf(agreement: AgreementRow | null): OverviewStatus {
  if (!agreement) return 'notSigned'
  if (agreement.withdrawn_at) return 'withdrawn'
  if (!agreement.activated_at) return 'waitingForCard'
  return agreement.paused_at ? 'paused' : 'active'
}

// A contract can have several withdrawn agreements but only one open one, so the
// open one wins, then the most recently withdrawn.
function currentAgreement(rows: AgreementRow[]): AgreementRow | null {
  const open = rows.find((row) => !row.withdrawn_at)
  if (open) return open
  return (
    [...rows].sort((a, b) =>
      (b.withdrawn_at ?? '').localeCompare(a.withdrawn_at ?? ''),
    )[0] ?? null
  )
}

export function buildCardAgreementOverview(
  contracts: OverviewContract[],
  agreements: AgreementRow[],
): OverviewLine[] {
  return contracts
    .map((contract) => {
      const agreement = currentAgreement(
        agreements.filter((row) => row.contract_id === contract.id),
      )
      return { ...contract, agreement, status: statusOf(agreement) }
    })
    .sort(
      (a, b) =>
        a.ownerName.localeCompare(b.ownerName, 'nb') ||
        a.horseName.localeCompare(b.horseName, 'nb'),
    )
}
