import { supabase } from '../../lib/supabaseClient'
import type { Database } from '../../types/supabase'

export type FireSafetyCheck =
  Database['public']['Tables']['fire_safety_checks']['Row']

export type FireSafetyCheckType =
  | 'extinguisher'
  | 'fire_alarm'
  | 'electrical'
  | 'escape_routes'
  | 'fire_drill'

export async function listFireSafetyChecks(): Promise<FireSafetyCheck[]> {
  const { data, error } = await supabase.from('fire_safety_checks').select('*')
  if (error) throw error
  return data
}

export async function markFireSafetyChecked(
  stableId: string,
  checkType: FireSafetyCheckType,
  date: string,
  notes?: string | null,
): Promise<FireSafetyCheck> {
  const { data, error } = await supabase
    .from('fire_safety_checks')
    .upsert(
      {
        stable_id: stableId,
        check_type: checkType,
        last_checked_date: date,
        notes: notes ?? null,
      },
      { onConflict: 'stable_id,check_type' },
    )
    .select()
    .single()
  if (error) throw error
  return data
}

export async function countActiveHorses(): Promise<number> {
  const { count, error } = await supabase
    .from('horses')
    .select('*', { count: 'exact', head: true })
    .eq('active', true)
  if (error) throw error
  return count ?? 0
}
