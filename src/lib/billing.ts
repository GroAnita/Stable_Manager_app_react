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

export type InvoiceLineItem = { description: string; amount: number }

// Payment notes are generated as newline-separated lines; lines that carry
// their own "— amount" (hay, bedding) are itemized, and the remaining base
// line (e.g. "Monthly board fee") absorbs whatever's left of the total so
// the line items always sum back to the payment amount.
export function parseInvoiceLineItems(
  notes: string | null,
  total: number,
): InvoiceLineItem[] {
  const lines = (notes ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length === 0) return [{ description: '', amount: total }]

  const items: InvoiceLineItem[] = []
  let explicitSum = 0
  let baseIndex = -1

  lines.forEach((line) => {
    const match = line.match(/^(.*?)\s+—\s+([\d]+(?:[.,]\d+)?)\s*$/)
    if (match) {
      const amount = Number(match[2].replace(',', '.'))
      items.push({ description: match[1], amount })
      explicitSum += amount
    } else {
      items.push({ description: line, amount: 0 })
      if (baseIndex === -1) baseIndex = items.length - 1
    }
  })

  if (baseIndex !== -1) {
    items[baseIndex] = {
      ...items[baseIndex],
      amount: Math.round((total - explicitSum) * 100) / 100,
    }
  }

  return items
}

// Norwegian bank account numbers are conventionally grouped 4.2.5 digits.
export function formatBankAccountNumber(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length !== 11) return value
  return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6)}`
}
