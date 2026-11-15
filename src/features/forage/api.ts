import { supabase } from '../../lib/supabaseClient'
import type { Database } from '../../types/supabase'

export type ForageAnalysis =
  Database['public']['Tables']['forage_analyses']['Row']
export type ForageAnalysisInput = Pick<
  ForageAnalysis,
  'name' | 'analysed_on' | 'dry_matter_percent' | 'feh_per_kg_dm' | 'notes'
>

// The horse's numbers for the fôrkalkulator.
export type HorseForageSettings = Pick<
  Database['public']['Tables']['horses']['Row'],
  | 'ideal_weight_kg'
  | 'workload'
  | 'forage_analysis_id'
  | 'concentrate_kg_per_day'
  | 'concentrate_feh_per_kg'
>

const HORSE_FORAGE_COLUMNS =
  'ideal_weight_kg, workload, forage_analysis_id, concentrate_kg_per_day, concentrate_feh_per_kg'

// The batch in use first, then the newest.
export async function listForageAnalyses(): Promise<ForageAnalysis[]> {
  const { data, error } = await supabase
    .from('forage_analyses')
    .select('*')
    .order('in_use', { ascending: false })
    .order('analysed_on', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createForageAnalysis(
  stableId: string,
  input: ForageAnalysisInput & { in_use: boolean },
): Promise<ForageAnalysis> {
  const { data, error } = await supabase
    .from('forage_analyses')
    .insert({ ...input, stable_id: stableId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateForageAnalysis(
  id: string,
  input: Partial<ForageAnalysisInput> & { in_use?: boolean },
): Promise<ForageAnalysis> {
  const { data, error } = await supabase
    .from('forage_analyses')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteForageAnalysis(id: string): Promise<void> {
  const { error } = await supabase.from('forage_analyses').delete().eq('id', id)
  if (error) throw error
}

export async function getHorseForageSettings(
  horseId: string,
): Promise<HorseForageSettings> {
  const { data, error } = await supabase
    .from('horses')
    .select(HORSE_FORAGE_COLUMNS)
    .eq('id', horseId)
    .single()
  if (error) throw error
  return data
}

export async function updateHorseForageSettings(
  horseId: string,
  input: HorseForageSettings,
): Promise<HorseForageSettings> {
  const { data, error } = await supabase
    .from('horses')
    .update(input)
    .eq('id', horseId)
    .select(HORSE_FORAGE_COLUMNS)
    .single()
  if (error) throw error
  return data
}
