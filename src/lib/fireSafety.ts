import type { FireSafetyCheckType } from '../features/fireSafety/api'

// Recommended re-check interval in months. Only "electrical" (every 3
// years) comes directly from the regulation (Forskrift om velferd for
// hest § 12); the rest are common-practice recommendations, not legal
// deadlines — surfaced as such in the UI.
export const FIRE_SAFETY_INTERVAL_MONTHS: Record<FireSafetyCheckType, number> =
  {
    extinguisher: 12,
    fire_alarm: 12,
    electrical: 36,
    escape_routes: 6,
    fire_drill: 12,
  }

export const FIRE_SAFETY_CHECK_TYPES: FireSafetyCheckType[] = [
  'extinguisher',
  'fire_alarm',
  'electrical',
  'escape_routes',
  'fire_drill',
]

export type FireSafetyStatus = 'ok' | 'dueSoon' | 'overdue' | 'never'

const DUE_SOON_DAYS = 30

export function nextDueDate(
  lastCheckedDate: string,
  checkType: FireSafetyCheckType,
): string {
  const date = new Date(lastCheckedDate)
  date.setMonth(date.getMonth() + FIRE_SAFETY_INTERVAL_MONTHS[checkType])
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function fireSafetyStatus(
  lastCheckedDate: string | null,
  checkType: FireSafetyCheckType,
  today: Date = new Date(),
): FireSafetyStatus {
  if (!lastCheckedDate) return 'never'
  const due = new Date(nextDueDate(lastCheckedDate, checkType))
  const daysUntilDue = Math.ceil(
    (due.getTime() - today.getTime()) / 86400000,
  )
  if (daysUntilDue < 0) return 'overdue'
  if (daysUntilDue <= DUE_SOON_DAYS) return 'dueSoon'
  return 'ok'
}
