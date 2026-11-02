import { supabase } from '../../lib/supabaseClient'
import type { Database } from '../../types/supabase'

export type CoRider = Database['public']['Tables']['co_riders']['Row']
export type CoRiderInsert =
  Database['public']['Tables']['co_riders']['Insert']
export type CoRiderUpdate =
  Database['public']['Tables']['co_riders']['Update']

export type CoRiderAgreement =
  Database['public']['Tables']['co_rider_agreements']['Row']
export type CoRiderAgreementInsert =
  Database['public']['Tables']['co_rider_agreements']['Insert']
export type CoRiderAgreementUpdate =
  Database['public']['Tables']['co_rider_agreements']['Update']

export type CoRiderAgreementWithHorse = CoRiderAgreement & {
  horse: Pick<Database['public']['Tables']['horses']['Row'], 'id' | 'name'> | null
}

export type HorsePickerOption = { id: string; name: string }

export async function listCoRiders(): Promise<CoRider[]> {
  const { data, error } = await supabase
    .from('co_riders')
    .select('*')
    .order('full_name')
  if (error) throw error
  return data
}

export async function getCoRider(id: string): Promise<CoRider> {
  const { data, error } = await supabase
    .from('co_riders')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createCoRider(input: CoRiderInsert): Promise<CoRider> {
  const { data, error } = await supabase
    .from('co_riders')
    .insert(input)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCoRider(
  id: string,
  input: CoRiderUpdate,
): Promise<CoRider> {
  const { data, error } = await supabase
    .from('co_riders')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteCoRider(id: string): Promise<void> {
  const { error } = await supabase.from('co_riders').delete().eq('id', id)
  if (error) throw error
}

export async function listCoRiderAgreements(
  coRiderId: string,
): Promise<CoRiderAgreementWithHorse[]> {
  const { data, error } = await supabase
    .from('co_rider_agreements')
    .select('*, horse:horses(id, name)')
    .eq('co_rider_id', coRiderId)
    .order('start_date', { ascending: false, nullsFirst: false })
  if (error) throw error
  return data
}

export async function createCoRiderAgreement(
  input: CoRiderAgreementInsert,
): Promise<CoRiderAgreement> {
  const { data, error } = await supabase
    .from('co_rider_agreements')
    .insert(input)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCoRiderAgreement(
  id: string,
  input: CoRiderAgreementUpdate,
): Promise<CoRiderAgreement> {
  const { data, error } = await supabase
    .from('co_rider_agreements')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteCoRiderAgreement(id: string): Promise<void> {
  const { error } = await supabase
    .from('co_rider_agreements')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function listHorsesForPicker(): Promise<HorsePickerOption[]> {
  const { data, error } = await supabase
    .from('horses')
    .select('id, name')
    .order('name')
  if (error) throw error
  return data
}
