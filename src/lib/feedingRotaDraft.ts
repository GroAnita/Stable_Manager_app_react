export type DraftOwner = { id: string; horses: number }

export type DraftUnavailability = {
  owner_id: string
  start_date: string
  end_date: string
}

// Day numbers as in Date.getUTCDay(): Sunday is 0.
export const ROTA_DAY_OPTIONS = {
  monSun: [1, 2, 3, 4, 5, 6, 0],
  monFri: [1, 2, 3, 4, 5],
  friSun: [5, 6, 0],
  satSun: [6, 0],
}

export type RotaDayOption = keyof typeof ROTA_DAY_OPTIONS

export type DraftSlot = {
  ownerId: string | null
  // Set once the shift has been published.
  shiftId: string | null
  completed: boolean
}

export type DraftDay = {
  date: string
  // Which week of the rota this is, counted from the first day.
  week: number
  // One entry per feeding time. Null means no shift is planned for it.
  slots: (DraftSlot | null)[]
}

export type PublishedSlot = {
  date: string
  slot: number
  ownerId: string | null
  shiftId: string
  completed: boolean
}

function addDays(dateIso: string, days: number): string {
  const date = new Date(`${dateIso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function nextMonday(todayIso: string): string {
  const day = new Date(`${todayIso}T00:00:00Z`).getUTCDay()
  return addDays(todayIso, (8 - day) % 7 || 7)
}

export function rotaEndDate(startDate: string, weeks: number): string {
  return addDays(startDate, weeks * 7 - 1)
}

// Shares feedings out in proportion to how many horses each owner has, and evenly
// across the feeding times, so nobody gets only mornings. Each feeding goes to
// whoever is furthest behind on both, with a little chance added so each rota comes
// out different. Nobody feeds twice in a day unless their share of the horses needs
// it, or there's no one else. Published shifts stay as they are and count towards
// each owner's share.
// With planNew off, only published shifts are returned.
export function buildFeedingRotaDraft(input: {
  owners: DraftOwner[]
  startDate: string
  weeks: number
  slotCount: number
  rotaDays?: RotaDayOption
  unavailability?: DraftUnavailability[]
  published?: PublishedSlot[]
  planNew?: boolean
  random?: () => number
}): DraftDay[] {
  const owners = input.owners.filter((owner) => owner.horses > 0)
  const unavailability = input.unavailability ?? []
  const published = input.published ?? []
  const planNew = input.planNew ?? true
  const random = input.random ?? Math.random
  const weekdays = ROTA_DAY_OPTIONS[input.rotaDays ?? 'monSun']
  const counts = new Map(owners.map((owner) => [owner.id, 0]))
  const totalHorses = owners.reduce((sum, owner) => sum + owner.horses, 0)
  const dailyLimit = (owner: DraftOwner) =>
    Math.ceil((input.slotCount * owner.horses) / totalHorses)
  const slotCounts = new Map(
    owners.map((owner) => [owner.id, Array<number>(input.slotCount).fill(0)]),
  )
  function countFeeding(ownerId: string, slot: number) {
    const perSlot = slotCounts.get(ownerId)
    if (!perSlot) return
    counts.set(ownerId, (counts.get(ownerId) ?? 0) + 1)
    perSlot[slot] += 1
  }
  for (const shift of published) {
    if (shift.ownerId) countFeeding(shift.ownerId, shift.slot)
  }

  const days: DraftDay[] = []

  for (let dayIndex = 0; dayIndex < input.weeks * 7; dayIndex++) {
    const date = addDays(input.startDate, dayIndex)
    const lockedToday = published.filter((shift) => shift.date === date)
    const chosen =
      planNew && weekdays.includes(new Date(`${date}T00:00:00Z`).getUTCDay())
    if (!chosen && lockedToday.length === 0) continue

    const free = owners.filter(
      (owner) =>
        !unavailability.some(
          (range) =>
            range.owner_id === owner.id &&
            date >= range.start_date &&
            date <= range.end_date,
        ),
    )
    const today = lockedToday.flatMap((shift) =>
      shift.ownerId ? [shift.ownerId] : [],
    )
    const slots: (DraftSlot | null)[] = Array(input.slotCount).fill(null)

    // Filled in a random order, because whichever feeding goes first would otherwise
    // keep getting the owners with the most horses.
    const fillOrder = Array.from({ length: input.slotCount }, (_, slot) => slot)
    for (let i = fillOrder.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      ;[fillOrder[i], fillOrder[j]] = [fillOrder[j], fillOrder[i]]
    }

    for (const slot of fillOrder) {
      const locked = lockedToday.find((shift) => shift.slot === slot)
      if (locked) {
        slots[slot] = {
          ownerId: locked.ownerId,
          shiftId: locked.shiftId,
          completed: locked.completed,
        }
        continue
      }
      if (!chosen) continue

      const withinLimit = free.filter(
        (owner) =>
          today.filter((id) => id === owner.id).length < dailyLimit(owner),
      )
      const candidates = withinLimit.length > 0 ? withinLimit : free
      let picked: DraftOwner | null = null
      let pickedScore = Infinity
      for (const owner of candidates) {
        const total = counts.get(owner.id) ?? 0
        const atThisTime = slotCounts.get(owner.id)?.[slot] ?? 0
        const score =
          (total + 1 + input.slotCount * (atThisTime + 1) + random()) /
          owner.horses
        if (score < pickedScore) {
          picked = owner
          pickedScore = score
        }
      }
      if (picked) {
        countFeeding(picked.id, slot)
        today.push(picked.id)
      }
      slots[slot] = {
        ownerId: picked?.id ?? null,
        shiftId: null,
        completed: false,
      }
    }
    days.push({ date, week: Math.floor(dayIndex / 7), slots })
  }
  return days
}

export function draftDayLabel(dateIso: string, locale: string): string {
  return new Date(`${dateIso}T00:00:00Z`).toLocaleDateString(locale, {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

export function replaceDraftSlot(
  days: DraftDay[],
  date: string,
  slot: number,
  ownerId: string,
): DraftDay[] {
  return days.map((day) =>
    day.date === date
      ? {
          ...day,
          slots: day.slots.map((current, index) =>
            index === slot && current ? { ...current, ownerId } : current,
          ),
        }
      : day,
  )
}

export function feedingCounts(days: DraftDay[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const day of days) {
    for (const slot of day.slots) {
      if (slot?.ownerId) {
        counts.set(slot.ownerId, (counts.get(slot.ownerId) ?? 0) + 1)
      }
    }
  }
  return counts
}

// The shifts that still need publishing, as feeding time position and owner.
export function unpublishedSlots(
  days: DraftDay[],
): { date: string; slot: number; ownerId: string | null }[] {
  return days.flatMap((day) =>
    day.slots.flatMap((slot, index) =>
      slot && !slot.shiftId
        ? [{ date: day.date, slot: index, ownerId: slot.ownerId }]
        : [],
    ),
  )
}
