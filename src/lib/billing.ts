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
