import { supabase } from '../../lib/supabaseClient'

type CountableTable =
  | 'stalls'
  | 'horses'
  | 'owners'
  | 'price_list_items'
  | 'contracts'
  | 'feeding_shift_types'
  | 'staff'

export type OnboardingStepKey =
  | 'invoiceDetails'
  | 'stalls'
  | 'horsesAndOwners'
  | 'priceList'
  | 'contracts'
  | 'feedingRounds'
  | 'staff'

export type OnboardingStatus = Record<OnboardingStepKey, boolean>

async function countRows(
  table: CountableTable,
  stableId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('stable_id', stableId)
  if (error) throw error
  return count ?? 0
}

export async function getOnboardingStatus(
  stableId: string,
): Promise<OnboardingStatus> {
  const [
    stable,
    stallCount,
    horseCount,
    ownerCount,
    priceListCount,
    contractCount,
    shiftTypeCount,
    staffCount,
  ] = await Promise.all([
    supabase
      .from('stables')
      .select('address, phone, email')
      .eq('id', stableId)
      .single()
      .then(({ data, error }) => {
        if (error) throw error
        return data
      }),
    countRows('stalls', stableId),
    countRows('horses', stableId),
    countRows('owners', stableId),
    countRows('price_list_items', stableId),
    countRows('contracts', stableId),
    countRows('feeding_shift_types', stableId),
    countRows('staff', stableId),
  ])

  return {
    invoiceDetails: Boolean(
      stable.address && (stable.phone || stable.email),
    ),
    stalls: stallCount > 0,
    horsesAndOwners: horseCount > 0 && ownerCount > 0,
    priceList: priceListCount > 0,
    contracts: contractCount > 0,
    feedingRounds: shiftTypeCount > 0,
    staff: staffCount > 0,
  }
}
