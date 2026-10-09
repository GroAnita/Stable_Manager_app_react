export type VaccinationDose = 'A' | 'B' | 'C' | 'annual'

export type VaccinationRecord = {
  dose: string
  date: string
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function addMonthsAndDays(date: Date, months: number, days: number): Date {
  const result = new Date(date)
  result.setMonth(result.getMonth() + months)
  result.setDate(result.getDate() + days)
  return result
}

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24
  return Math.round((b.getTime() - a.getTime()) / msPerDay)
}

export type GrunnvaksineStatus = 'not_started' | 'pending' | 'valid' | 'invalid'

export type GrunnvaksineResult = {
  status: GrunnvaksineStatus
  doseA: string | null
  doseB: string | null
  doseC: string | null
  deadline: string | null
}

/**
 * The basic 3-dose series: A, then B 21-60 days after A, then C within
 * 6 months + 21 days of B. Uses the latest A as the start of the current
 * attempt, so a lapsed/restarted series is evaluated on its own.
 */
export function getGrunnvaksineStatus(
  vaccinations: VaccinationRecord[],
  now: Date = new Date(),
): GrunnvaksineResult {
  const sorted = [...vaccinations].sort((a, b) => (a.date < b.date ? -1 : 1))
  const doseARecords = sorted.filter((v) => v.dose === 'A')
  if (doseARecords.length === 0) {
    return { status: 'not_started', doseA: null, doseB: null, doseC: null, deadline: null }
  }
  const doseA = doseARecords[doseARecords.length - 1]
  const dateA = new Date(doseA.date)

  const doseB = sorted.find((v) => v.dose === 'B' && v.date >= doseA.date)
  if (!doseB) {
    const deadline = addDays(dateA, 60)
    const status: GrunnvaksineStatus = now > deadline ? 'invalid' : 'pending'
    return {
      status,
      doseA: doseA.date,
      doseB: null,
      doseC: null,
      deadline: deadline.toISOString().slice(0, 10),
    }
  }
  const dateB = new Date(doseB.date)
  const gapAB = daysBetween(dateA, dateB)
  if (gapAB < 21 || gapAB > 60) {
    return {
      status: 'invalid',
      doseA: doseA.date,
      doseB: doseB.date,
      doseC: null,
      deadline: null,
    }
  }

  const doseC = sorted.find((v) => v.dose === 'C' && v.date >= doseB.date)
  const deadlineC = addMonthsAndDays(dateB, 6, 21)
  if (!doseC) {
    const status: GrunnvaksineStatus = now > deadlineC ? 'invalid' : 'pending'
    return {
      status,
      doseA: doseA.date,
      doseB: doseB.date,
      doseC: null,
      deadline: deadlineC.toISOString().slice(0, 10),
    }
  }
  const dateC = new Date(doseC.date)
  if (dateC > deadlineC) {
    return {
      status: 'invalid',
      doseA: doseA.date,
      doseB: doseB.date,
      doseC: doseC.date,
      deadline: deadlineC.toISOString().slice(0, 10),
    }
  }

  return {
    status: 'valid',
    doseA: doseA.date,
    doseB: doseB.date,
    doseC: doseC.date,
    deadline: deadlineC.toISOString().slice(0, 10),
  }
}

export type AnnualBoosterStatus = 'not_applicable' | 'green' | 'yellow' | 'red'

export type AnnualBoosterResult = {
  status: AnnualBoosterStatus
  lastDate: string | null
  dueDate: string | null
}

/**
 * Once the grunnvaksine series is complete, the horse needs a booster at
 * most 365 days after the last shot (C, or the most recent annual booster).
 */
export function getAnnualBoosterStatus(
  vaccinations: VaccinationRecord[],
  grunnvaksine: GrunnvaksineResult,
  now: Date = new Date(),
): AnnualBoosterResult {
  const doseCDate = grunnvaksine.doseC
  if (grunnvaksine.status !== 'valid' || !doseCDate) {
    return { status: 'not_applicable', lastDate: null, dueDate: null }
  }

  const annualDoses = vaccinations
    .filter((v) => v.dose === 'annual' && v.date >= doseCDate)
    .sort((a, b) => (a.date < b.date ? -1 : 1))

  const lastDateStr =
    annualDoses.length > 0
      ? annualDoses[annualDoses.length - 1].date
      : doseCDate

  const lastDate = new Date(lastDateStr)
  const dueDate = addDays(lastDate, 365)
  const daysUntilDue = daysBetween(now, dueDate)

  let status: AnnualBoosterStatus
  if (daysUntilDue < 0) status = 'red'
  else if (daysUntilDue <= 30) status = 'yellow'
  else status = 'green'

  return {
    status,
    lastDate: lastDateStr,
    dueDate: dueDate.toISOString().slice(0, 10),
  }
}

export type VaccinationStatusColor = 'green' | 'yellow' | 'red' | 'grey'

export type VaccinationOverviewStatus = {
  color: VaccinationStatusColor
  dueDate: string | null
}

/**
 * Single summary for the horse overview: while the basic series is still
 * in progress, "next due" is its own deadline (green if on track, red if
 * missed); once it's complete, it hands off to the yearly booster.
 */
export function getVaccinationOverviewStatus(
  vaccinations: VaccinationRecord[],
  now: Date = new Date(),
): VaccinationOverviewStatus {
  const grunnvaksine = getGrunnvaksineStatus(vaccinations, now)

  if (grunnvaksine.status === 'not_started') {
    return { color: 'grey', dueDate: null }
  }
  if (grunnvaksine.status === 'pending') {
    return { color: 'green', dueDate: grunnvaksine.deadline }
  }
  if (grunnvaksine.status === 'invalid') {
    return { color: 'red', dueDate: grunnvaksine.deadline }
  }

  const annual = getAnnualBoosterStatus(vaccinations, grunnvaksine, now)
  return {
    color: annual.status === 'not_applicable' ? 'grey' : annual.status,
    dueDate: annual.dueDate,
  }
}
