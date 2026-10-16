export type UnavailabilityRange = {
  owner_id: string
  start_date: string
  end_date: string
}

export type ExistingShift = {
  shift_type_id: string
  date: string
  status: string
}

export type DraftShiftPlan = {
  shift_type_id: string
  date: string
  assigned_owner_id: string | null
  unassignable: boolean
}

export type RotationInput = {
  shiftTypeIds: string[]
  /** Active rotation participants, in a stable order (e.g. by name). */
  participantOwnerIds: string[]
  unavailability: UnavailabilityRange[]
  /** Shifts that already exist in the target range — published ones are never touched. */
  existingShifts: ExistingShift[]
  /** Most recently published owner per shift type, so a regeneration keeps rotating fairly instead of restarting. */
  lastAssignedByType: Record<string, string | null>
  /** Inclusive date range, both ISO 'YYYY-MM-DD' strings. */
  dateFrom: string
  dateTo: string
}

function enumerateDates(from: string, to: string): string[] {
  // Pure UTC arithmetic throughout, so this never drifts by a day
  // depending on the browser's local timezone offset.
  const dates: string[] = []
  const cursor = new Date(`${from}T00:00:00Z`)
  const end = new Date(`${to}T00:00:00Z`)
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return dates
}

function isUnavailable(
  ownerId: string,
  date: string,
  unavailability: UnavailabilityRange[],
): boolean {
  return unavailability.some(
    (u) => u.owner_id === ownerId && date >= u.start_date && date <= u.end_date,
  )
}

/**
 * Simple round-robin draft generator. Never touches a published shift —
 * regenerating only (re)writes draft rows for dates/types that aren't
 * already published. A shift with no available participant is flagged
 * unassignable rather than skipped, so the manager can see and fix it.
 */
export function generateDraftSchedule(input: RotationInput): DraftShiftPlan[] {
  const dates = enumerateDates(input.dateFrom, input.dateTo)
  const existingByKey = new Map(
    input.existingShifts.map((s) => [`${s.shift_type_id}:${s.date}`, s]),
  )
  const plans: DraftShiftPlan[] = []

  for (const shiftTypeId of input.shiftTypeIds) {
    const participants = input.participantOwnerIds
    let pointer = 0
    const last = input.lastAssignedByType[shiftTypeId]
    if (last) {
      const idx = participants.indexOf(last)
      if (idx >= 0) pointer = (idx + 1) % participants.length
    }

    for (const date of dates) {
      const existing = existingByKey.get(`${shiftTypeId}:${date}`)
      if (existing?.status === 'published') continue

      let assigned: string | null = null
      for (let i = 0; i < participants.length; i++) {
        const candidate = participants[(pointer + i) % participants.length]
        if (!isUnavailable(candidate, date, input.unavailability)) {
          assigned = candidate
          pointer = (pointer + i + 1) % participants.length
          break
        }
      }

      plans.push({
        shift_type_id: shiftTypeId,
        date,
        assigned_owner_id: assigned,
        unassignable: assigned === null,
      })
    }
  }

  return plans
}
