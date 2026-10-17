import { supabase } from '../../lib/supabaseClient'
import {
  getHorseFeedingPlan,
  getHorseFeedingTimes,
  type FeedingTime,
} from '../horses/api'
import type { Database } from '../../types/supabase'

export type ShiftType =
  Database['public']['Tables']['feeding_shift_types']['Row']
export type ShiftTypeInsert =
  Database['public']['Tables']['feeding_shift_types']['Insert']
export type ShiftTypeUpdate =
  Database['public']['Tables']['feeding_shift_types']['Update']

export type RotaParticipant =
  Database['public']['Tables']['feeding_rota_participants']['Row'] & {
    owner: Pick<
      Database['public']['Tables']['owners']['Row'],
      'id' | 'full_name'
    > | null
  }

export type OwnerUnavailability =
  Database['public']['Tables']['owner_unavailability']['Row'] & {
    owner: Pick<
      Database['public']['Tables']['owners']['Row'],
      'id' | 'full_name'
    > | null
  }
export type OwnerUnavailabilityInsert =
  Database['public']['Tables']['owner_unavailability']['Insert']

export type FeedingShift =
  Database['public']['Tables']['feeding_shifts']['Row'] & {
    shift_type: Pick<
      Database['public']['Tables']['feeding_shift_types']['Row'],
      'id' | 'label' | 'time_of_day' | 'scope'
    > | null
    assigned_owner: Pick<
      Database['public']['Tables']['owners']['Row'],
      'id' | 'full_name'
    > | null
  }

export type SwapRequest =
  Database['public']['Tables']['feeding_shift_swap_requests']['Row'] & {
    shift:
      | (Pick<
          Database['public']['Tables']['feeding_shifts']['Row'],
          'id' | 'date'
        > & {
          shift_type: Pick<
            Database['public']['Tables']['feeding_shift_types']['Row'],
            'label' | 'time_of_day'
          > | null
        })
      | null
    requested_by: Pick<
      Database['public']['Tables']['owners']['Row'],
      'id' | 'full_name'
    > | null
    requested_to: Pick<
      Database['public']['Tables']['owners']['Row'],
      'id' | 'full_name'
    > | null
  }

export type RotaNotification =
  Database['public']['Tables']['notifications']['Row']

// ---------------------------------------------------------------------------
// Shift types

export async function listShiftTypes(): Promise<ShiftType[]> {
  const { data, error } = await supabase
    .from('feeding_shift_types')
    .select('*')
    .order('sort_order')
  if (error) throw error
  return data
}

export async function createShiftType(
  input: ShiftTypeInsert,
): Promise<ShiftType> {
  const { data, error } = await supabase
    .from('feeding_shift_types')
    .insert(input)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateShiftType(
  id: string,
  input: ShiftTypeUpdate,
): Promise<ShiftType> {
  const { data, error } = await supabase
    .from('feeding_shift_types')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteShiftType(id: string): Promise<void> {
  const { error } = await supabase
    .from('feeding_shift_types')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function listShiftTypeHorseIds(
  shiftTypeId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from('feeding_shift_type_horses')
    .select('horse_id')
    .eq('shift_type_id', shiftTypeId)
  if (error) throw error
  return data.map((row) => row.horse_id)
}

export async function setShiftTypeHorses(
  shiftTypeId: string,
  horseIds: string[],
): Promise<void> {
  const { error: deleteError } = await supabase
    .from('feeding_shift_type_horses')
    .delete()
    .eq('shift_type_id', shiftTypeId)
  if (deleteError) throw deleteError
  if (horseIds.length === 0) return
  const { error: insertError } = await supabase
    .from('feeding_shift_type_horses')
    .insert(
      horseIds.map((horseId) => ({
        shift_type_id: shiftTypeId,
        horse_id: horseId,
      })),
    )
  if (insertError) throw insertError
}

// ---------------------------------------------------------------------------
// Rotation participants

export async function listRotaParticipants(): Promise<RotaParticipant[]> {
  const { data, error } = await supabase
    .from('feeding_rota_participants')
    .select('*, owner:owners(id, full_name)')
  if (error) throw error
  return data
}

export async function addRotaParticipant(
  stableId: string,
  ownerId: string,
): Promise<RotaParticipant> {
  const { data, error } = await supabase
    .from('feeding_rota_participants')
    .upsert(
      { stable_id: stableId, owner_id: ownerId, active: true },
      { onConflict: 'stable_id,owner_id' },
    )
    .select('*, owner:owners(id, full_name)')
    .single()
  if (error) throw error
  return data
}

export async function setRotaParticipantActive(
  id: string,
  active: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('feeding_rota_participants')
    .update({ active })
    .eq('id', id)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Owner unavailability

export async function listOwnerUnavailability(): Promise<
  OwnerUnavailability[]
> {
  const { data, error } = await supabase
    .from('owner_unavailability')
    .select('*, owner:owners(id, full_name)')
    .order('start_date')
  if (error) throw error
  return data
}

export async function createOwnerUnavailability(
  input: OwnerUnavailabilityInsert,
): Promise<OwnerUnavailability> {
  const { data, error } = await supabase
    .from('owner_unavailability')
    .insert(input)
    .select('*, owner:owners(id, full_name)')
    .single()
  if (error) throw error
  return data
}

export async function deleteOwnerUnavailability(id: string): Promise<void> {
  const { error } = await supabase
    .from('owner_unavailability')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Shifts

const SHIFT_SELECT =
  '*, shift_type:feeding_shift_types(id, label, time_of_day, scope), assigned_owner:owners!feeding_shifts_assigned_owner_id_fkey(id, full_name)'

export async function listShiftsInRange(
  dateFrom: string,
  dateTo: string,
): Promise<FeedingShift[]> {
  const { data, error } = await supabase
    .from('feeding_shifts')
    .select(SHIFT_SELECT)
    .gte('date', dateFrom)
    .lte('date', dateTo)
    .order('date')
  if (error) throw error
  return data
}

export async function listAllPublishedShifts(): Promise<FeedingShift[]> {
  const { data, error } = await supabase
    .from('feeding_shifts')
    .select(SHIFT_SELECT)
    .eq('status', 'published')
    .order('date')
  if (error) throw error
  return data
}

export async function listMyUpcomingShifts(): Promise<FeedingShift[]> {
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('feeding_shifts')
    .select(SHIFT_SELECT)
    .eq('status', 'published')
    .gte('date', today)
    .order('date')
  if (error) throw error
  return data
}

async function lastPublishedOwnerByType(
  stableId: string,
  shiftTypeIds: string[],
  beforeDate: string,
): Promise<Record<string, string | null>> {
  const result: Record<string, string | null> = {}
  for (const shiftTypeId of shiftTypeIds) {
    const { data, error } = await supabase
      .from('feeding_shifts')
      .select('assigned_owner_id')
      .eq('stable_id', stableId)
      .eq('shift_type_id', shiftTypeId)
      .eq('status', 'published')
      .lt('date', beforeDate)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    result[shiftTypeId] = data?.assigned_owner_id ?? null
  }
  return result
}

export { lastPublishedOwnerByType }

export async function upsertDraftShifts(
  stableId: string,
  createdBy: string,
  plans: {
    shift_type_id: string
    date: string
    assigned_owner_id: string | null
    unassignable: boolean
  }[],
): Promise<void> {
  if (plans.length === 0) return
  const { error } = await supabase.from('feeding_shifts').upsert(
    plans.map((plan) => ({
      stable_id: stableId,
      shift_type_id: plan.shift_type_id,
      date: plan.date,
      assigned_owner_id: plan.assigned_owner_id,
      unassignable: plan.unassignable,
      status: 'draft',
      created_by: createdBy,
    })),
    { onConflict: 'shift_type_id,date' },
  )
  if (error) throw error
}

export async function publishDraftShifts(
  dateFrom: string,
  dateTo: string,
): Promise<FeedingShift[]> {
  const { data, error } = await supabase
    .from('feeding_shifts')
    .update({ status: 'published' })
    .eq('status', 'draft')
    .gte('date', dateFrom)
    .lte('date', dateTo)
    .select(SHIFT_SELECT)
  if (error) throw error
  return data
}

export async function reassignShift(
  shiftId: string,
  ownerId: string | null,
): Promise<FeedingShift> {
  const { data, error } = await supabase
    .from('feeding_shifts')
    .update({ assigned_owner_id: ownerId, unassignable: ownerId === null })
    .eq('id', shiftId)
    .select(SHIFT_SELECT)
    .single()
  if (error) throw error

  if (ownerId) {
    const shift = data
    await supabase.from('notifications').insert({
      stable_id: shift.stable_id,
      owner_id: ownerId,
      notification_type: 'feeding_shift_assigned',
      title: 'Feeding shift assigned to you',
      message: `You've been assigned a feeding shift on ${shift.date}.`,
    })
  }
  return data
}

export async function deleteShift(shiftId: string): Promise<void> {
  const { error } = await supabase
    .from('feeding_shifts')
    .delete()
    .eq('id', shiftId)
  if (error) throw error
}

export async function markShiftCompleted(
  shiftId: string,
  completedByOwnerId: string,
): Promise<FeedingShift> {
  const { data, error } = await supabase
    .from('feeding_shifts')
    .update({
      completed_by: completedByOwnerId,
      completed_at: new Date().toISOString(),
    })
    .eq('id', shiftId)
    .select(SHIFT_SELECT)
    .single()
  if (error) throw error
  return data
}

export type ShiftHorseFeeding = {
  horse: { id: string; name: string }
  feedingTimes: FeedingTime[]
  specialInstructions: string | null
}

/** What every horse in a shift's scope actually needs fed, reusing each
 * horse's existing feeding plan/times rather than duplicating the data. */
export async function getShiftFeedingInfo(
  shift: FeedingShift,
): Promise<ShiftHorseFeeding[]> {
  let horseList: { id: string; name: string }[]
  if (shift.shift_type?.scope === 'horses') {
    const horseIds = await listShiftTypeHorseIds(shift.shift_type_id)
    if (horseIds.length === 0) return []
    const { data, error } = await supabase
      .from('horses')
      .select('id, name')
      .in('id', horseIds)
      .order('name')
    if (error) throw error
    horseList = data
  } else {
    const { data, error } = await supabase
      .from('horses')
      .select('id, name')
      .eq('stable_id', shift.stable_id)
      .eq('active', true)
      .order('name')
    if (error) throw error
    horseList = data
  }

  return Promise.all(
    horseList.map(async (horse) => {
      const [plan, times] = await Promise.all([
        getHorseFeedingPlan(horse.id),
        getHorseFeedingTimes(horse.id),
      ])
      return {
        horse,
        feedingTimes: times,
        specialInstructions: plan?.special_instructions ?? null,
      }
    }),
  )
}

// ---------------------------------------------------------------------------
// Swap requests

const SWAP_SELECT =
  '*, shift:feeding_shifts(id, date, shift_type:feeding_shift_types(label, time_of_day)), requested_by:owners!feeding_shift_swap_requests_requested_by_owner_id_fkey(id, full_name), requested_to:owners!feeding_shift_swap_requests_requested_to_owner_id_fkey(id, full_name)'

export async function listMySwapRequests(): Promise<SwapRequest[]> {
  const { data, error } = await supabase
    .from('feeding_shift_swap_requests')
    .select(SWAP_SELECT)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function requestShiftSwap(
  shiftId: string,
  toOwnerId: string,
): Promise<void> {
  const { error } = await supabase.rpc('request_feeding_shift_swap', {
    p_shift_id: shiftId,
    p_to_owner_id: toOwnerId,
  })
  if (error) throw error
}

export async function respondToShiftSwap(
  swapId: string,
  accept: boolean,
): Promise<void> {
  const { error } = await supabase.rpc('respond_feeding_shift_swap', {
    p_swap_id: swapId,
    p_accept: accept,
  })
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Notifications

export async function listNotifications(): Promise<RotaNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return data
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id)
  if (error) throw error
}

export async function markAllNotificationsRead(
  unreadIds: string[],
): Promise<void> {
  if (unreadIds.length === 0) return
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .in('id', unreadIds)
  if (error) throw error
}
