import { supabase } from '../../lib/supabaseClient'
import type { Database } from '../../types/supabase'

export type Horse = Database['public']['Tables']['horses']['Row']
export type HorseInsert = Database['public']['Tables']['horses']['Insert']
export type HorseUpdate = Database['public']['Tables']['horses']['Update']

export type HorseListItem = Pick<
  Horse,
  'id' | 'name' | 'breed' | 'age' | 'status' | 'active'
> & {
  owner: Pick<
    Database['public']['Tables']['owners']['Row'],
    'id' | 'full_name'
  > | null
  stall: Pick<
    Database['public']['Tables']['stalls']['Row'],
    'id' | 'stall_number'
  > | null
}

export type HorseDetail = Horse & {
  owner: Pick<
    Database['public']['Tables']['owners']['Row'],
    'id' | 'full_name' | 'phone'
  > | null
  stall: Pick<
    Database['public']['Tables']['stalls']['Row'],
    'id' | 'stall_number' | 'size' | 'notes'
  > | null
}

export type MedicalRecord =
  Database['public']['Tables']['medical_records']['Row']
export type MedicalRecordInsert =
  Database['public']['Tables']['medical_records']['Insert']
export type MedicalRecordUpdate =
  Database['public']['Tables']['medical_records']['Update']
export type FeedingPlan = Database['public']['Tables']['feeding_plans']['Row']
export type FeedingPlanInsert =
  Database['public']['Tables']['feeding_plans']['Insert']
export type FeedingTime = Database['public']['Tables']['feeding_times']['Row']
export type FeedingTimeInsert =
  Database['public']['Tables']['feeding_times']['Insert']
export type FeedingTimeUpdate =
  Database['public']['Tables']['feeding_times']['Update']
export type HorseEvent = Pick<
  Database['public']['Tables']['calendar_events']['Row'],
  'id' | 'title' | 'description' | 'event_type' | 'start_time' | 'end_time'
>
export type HorseEventInsert =
  Database['public']['Tables']['calendar_events']['Insert']
export type HorseEventUpdate =
  Database['public']['Tables']['calendar_events']['Update']

export async function listHorses(): Promise<HorseListItem[]> {
  const { data, error } = await supabase
    .from('horses')
    .select(
      'id, name, breed, age, status, active, owner:owners(id, full_name), stall:stalls(id, stall_number)',
    )
    .eq('active', true)
    .order('name')
  if (error) throw error
  return data
}

export async function getHorse(id: string): Promise<HorseDetail> {
  const { data, error } = await supabase
    .from('horses')
    .select(
      '*, owner:owners(id, full_name, phone), stall:stalls(id, stall_number, size, notes)',
    )
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createHorse(input: HorseInsert): Promise<Horse> {
  const { data, error } = await supabase
    .from('horses')
    .insert(input)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateHorse(
  id: string,
  input: HorseUpdate,
): Promise<Horse> {
  const { data, error } = await supabase
    .from('horses')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteHorse(id: string): Promise<void> {
  const { error } = await supabase.from('horses').delete().eq('id', id)
  if (error) throw error
}

export async function getHorseMedicalRecords(
  horseId: string,
): Promise<MedicalRecord[]> {
  const { data, error } = await supabase
    .from('medical_records')
    .select('*')
    .eq('horse_id', horseId)
    .order('date', { ascending: false })
  if (error) throw error
  return data
}

export async function createMedicalRecord(
  input: MedicalRecordInsert,
): Promise<MedicalRecord> {
  const { data, error } = await supabase
    .from('medical_records')
    .insert(input)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateMedicalRecord(
  id: string,
  input: MedicalRecordUpdate,
): Promise<MedicalRecord> {
  const { data, error } = await supabase
    .from('medical_records')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteMedicalRecord(id: string): Promise<void> {
  const { error } = await supabase.from('medical_records').delete().eq('id', id)
  if (error) throw error
}

export async function getHorseFeedingPlan(
  horseId: string,
): Promise<FeedingPlan | null> {
  const { data, error } = await supabase
    .from('feeding_plans')
    .select('*')
    .eq('horse_id', horseId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function upsertFeedingPlan(
  input: FeedingPlanInsert,
): Promise<FeedingPlan> {
  const { data, error } = await supabase
    .from('feeding_plans')
    .upsert(input, { onConflict: 'horse_id' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getHorseFeedingTimes(
  horseId: string,
): Promise<FeedingTime[]> {
  const { data, error } = await supabase
    .from('feeding_times')
    .select('*')
    .eq('horse_id', horseId)
    .order('time_of_day', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function createFeedingTime(
  input: FeedingTimeInsert,
): Promise<FeedingTime> {
  const { data, error } = await supabase
    .from('feeding_times')
    .insert(input)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateFeedingTime(
  id: string,
  input: FeedingTimeUpdate,
): Promise<FeedingTime> {
  const { data, error } = await supabase
    .from('feeding_times')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteFeedingTime(id: string): Promise<void> {
  const { error } = await supabase.from('feeding_times').delete().eq('id', id)
  if (error) throw error
}

export async function getHorseSchedule(horseId: string): Promise<HorseEvent[]> {
  const { data, error } = await supabase
    .from('calendar_events')
    .select('id, title, description, event_type, start_time, end_time')
    .eq('horse_id', horseId)
    .order('start_time', { ascending: true })
  if (error) throw error
  return data
}

export async function createHorseEvent(
  input: HorseEventInsert,
): Promise<HorseEvent> {
  const { data, error } = await supabase
    .from('calendar_events')
    .insert(input)
    .select('id, title, description, event_type, start_time, end_time')
    .single()
  if (error) throw error
  return data
}

export async function updateHorseEvent(
  id: string,
  input: HorseEventUpdate,
): Promise<HorseEvent> {
  const { data, error } = await supabase
    .from('calendar_events')
    .update(input)
    .eq('id', id)
    .select('id, title, description, event_type, start_time, end_time')
    .single()
  if (error) throw error
  return data
}

export async function deleteHorseEvent(id: string): Promise<void> {
  const { error } = await supabase.from('calendar_events').delete().eq('id', id)
  if (error) throw error
}
