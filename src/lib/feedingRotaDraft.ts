export type DraftOwner = { id: string; horses: number }

export type DraftUnavailability = {
  owner_id: string
  start_date: string
  end_date: string
}

export type DraftDay = {
  date: string
  // One entry per feeding that day. Null means nobody was free.
  slots: (string | null)[]
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

// Shares feedings out in proportion to how many horses each owner has. Each feeding
// goes to whoever is furthest behind their share, avoiding anyone already feeding
// that day unless there's no one else.
export function buildFeedingRotaDraft(input: {
  owners: DraftOwner[]
  startDate: string
  weeks: number
  feedingsPerDay: number
  unavailability?: DraftUnavailability[]
}): DraftDay[] {
  const owners = input.owners.filter((owner) => owner.horses > 0)
  const unavailability = input.unavailability ?? []
  const counts = new Map(owners.map((owner) => [owner.id, 0]))
  const lastUsed = new Map(owners.map((owner) => [owner.id, -1]))
  const days: DraftDay[] = []
  let slotNumber = 0

  for (let dayIndex = 0; dayIndex < input.weeks * 7; dayIndex++) {
    const date = addDays(input.startDate, dayIndex)
    const free = owners.filter(
      (owner) =>
        !unavailability.some(
          (range) =>
            range.owner_id === owner.id &&
            date >= range.start_date &&
            date <= range.end_date,
        ),
    )
    const slots: (string | null)[] = []

    for (let slot = 0; slot < input.feedingsPerDay; slot++) {
      const notToday = free.filter((owner) => !slots.includes(owner.id))
      const candidates = notToday.length > 0 ? notToday : free
      let chosen: DraftOwner | null = null
      let chosenScore = Infinity
      for (const owner of candidates) {
        const score = ((counts.get(owner.id) ?? 0) + 1) / owner.horses
        const tied = Math.abs(score - chosenScore) < 1e-9
        if (
          !chosen ||
          (!tied && score < chosenScore) ||
          (tied &&
            (lastUsed.get(owner.id) ?? -1) < (lastUsed.get(chosen.id) ?? -1))
        ) {
          chosen = owner
          chosenScore = score
        }
      }
      if (chosen) {
        counts.set(chosen.id, (counts.get(chosen.id) ?? 0) + 1)
        lastUsed.set(chosen.id, slotNumber)
      }
      slots.push(chosen?.id ?? null)
      slotNumber++
    }
    days.push({ date, slots })
  }
  return days
}

export function feedingCounts(days: DraftDay[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const day of days) {
    for (const ownerId of day.slots) {
      if (ownerId) counts.set(ownerId, (counts.get(ownerId) ?? 0) + 1)
    }
  }
  return counts
}
