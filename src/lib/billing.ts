const VAT_MULTIPLIER = 1.25

function currentBillingCycleDueDate(referenceDate = new Date()): Date {
  const dueMonth =
    referenceDate.getDate() >= 26
      ? referenceDate.getMonth() + 1
      : referenceDate.getMonth()
  return new Date(referenceDate.getFullYear(), dueMonth, 25)
}

function daysInBillingCycle(due: Date): number {
  const cycleStart = new Date(due.getFullYear(), due.getMonth() - 1, 26)
  return Math.round((due.getTime() - cycleStart.getTime()) / 86400000) + 1
}

export function currentBillingCycleDays(referenceDate = new Date()): number {
  return daysInBillingCycle(currentBillingCycleDueDate(referenceDate))
}

export function hayValueIncVat(
  pricePerKgPerDay: number,
  kgPerDay: number,
  cycleDays: number,
) {
  return (
    Math.round(pricePerKgPerDay * kgPerDay * cycleDays * VAT_MULTIPLIER * 100) /
    100
  )
}

export function beddingAmountIncVat(unitPrice: number, quantity: number) {
  return Math.round(unitPrice * quantity * VAT_MULTIPLIER * 100) / 100
}

export function amountIncVat(unitPrice: number, quantity: number) {
  return Math.round(unitPrice * quantity * VAT_MULTIPLIER * 100) / 100
}

function toIsoDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// Stable fees are due the 25th of every month, covering the cycle from the
// 26th of the previous month through the 25th. A charge dated inside that
// window belongs on the invoice due at the window's end.
export function billingCycleDueDate(dateStr: string): string {
  return toIsoDate(currentBillingCycleDueDate(new Date(dateStr)))
}

export function daysInBillingCycleFor(dueDateIso: string): number {
  return daysInBillingCycle(new Date(dueDateIso))
}
