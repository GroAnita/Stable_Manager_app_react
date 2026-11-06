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
  vatExempt = false,
) {
  const multiplier = vatExempt ? 1 : VAT_MULTIPLIER
  return (
    Math.round(pricePerKgPerDay * kgPerDay * cycleDays * multiplier * 100) / 100
  )
}

export function beddingAmountIncVat(
  unitPrice: number,
  quantity: number,
  vatExempt = false,
) {
  const multiplier = vatExempt ? 1 : VAT_MULTIPLIER
  return Math.round(unitPrice * quantity * multiplier * 100) / 100
}

export function amountIncVat(
  unitPrice: number,
  quantity: number,
  vatExempt = false,
) {
  const multiplier = vatExempt ? 1 : VAT_MULTIPLIER
  return Math.round(unitPrice * quantity * multiplier * 100) / 100
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

// For stables with the payments add-on: an extra goes on the invoice after its
// billing period ends, later if that invoice has already been issued (8 days
// before the charge day). The database decides the real date; this only shows
// it in advance and mirrors public.extra_billing_date.
export function addonExtraBillingDate(
  purchasedOn: string,
  chargeDay: number,
  today: string,
): string {
  const [year, month, day] = purchasedOn.split('-').map(Number)
  const todayMs = Date.parse(`${today}T00:00:00Z`)
  let monthOffset = day > chargeDay ? 2 : 1
  const billsOnMs = () => Date.UTC(year, month - 1 + monthOffset, chargeDay)
  while ((billsOnMs() - todayMs) / 86400000 - 8 <= 0) monthOffset += 1
  return new Date(billsOnMs()).toISOString().slice(0, 10)
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

export type InvoiceTotalsLine = {
  amount_net: number
  vat_amount: number
  vat_rate: number
}

// Totals for an invoice's lines, with VAT per rate as the invoice has to show it.
export function invoiceLineTotals(lines: InvoiceTotalsLine[]): {
  net: number
  vat: number
  vatByRate: { rate: number; net: number; vat: number }[]
} {
  const toOre = (amount: number) => Math.round(Number(amount) * 100)
  const byRate = new Map<number, { net: number; vat: number }>()
  let net = 0
  let vat = 0
  for (const line of lines) {
    const rate = Number(line.vat_rate)
    const lineNet = toOre(line.amount_net)
    const lineVat = toOre(line.vat_amount)
    net += lineNet
    vat += lineVat
    const current = byRate.get(rate) ?? { net: 0, vat: 0 }
    byRate.set(rate, { net: current.net + lineNet, vat: current.vat + lineVat })
  }
  return {
    net: net / 100,
    vat: vat / 100,
    vatByRate: [...byRate.entries()]
      .filter(([rate]) => rate > 0)
      .sort(([a], [b]) => b - a)
      .map(([rate, sums]) => ({
        rate,
        net: sums.net / 100,
        vat: sums.vat / 100,
      })),
  }
}

export const SERVICE_SCHEDULES = ['none', 'mon_fri', 'mon_sun', 'sat_sun']

// Mirrors public.schedule_days_in_period.
export function scheduleDaysInPeriod(
  schedule: string,
  startIso: string,
  endIso: string,
): number {
  const end = Date.parse(`${endIso}T00:00:00Z`)
  let count = 0
  for (
    let day = Date.parse(`${startIso}T00:00:00Z`);
    day <= end;
    day += 86400000
  ) {
    const weekday = new Date(day).getUTCDay()
    if (
      schedule === 'mon_sun' ||
      (schedule === 'mon_fri' && weekday >= 1 && weekday <= 5) ||
      (schedule === 'sat_sun' && (weekday === 0 || weekday === 6))
    ) {
      count += 1
    }
  }
  return count
}

// Mirrors public.contract_service_amount, which decides what's actually invoiced.
export function serviceAmountIncVat(input: {
  schedule: string
  price: number | null | undefined
  unit: string | null | undefined
  startIso: string
  endIso: string
  vatExempt: boolean
}): number {
  if (input.schedule === 'none' || input.price == null) return 0
  const unit = (input.unit ?? '').toLowerCase()
  const periodDays =
    (Date.parse(`${input.endIso}T00:00:00Z`) -
      Date.parse(`${input.startIso}T00:00:00Z`)) /
      86400000 +
    1
  const net =
    unit === 'per month'
      ? input.price
      : unit === 'per week'
        ? (input.price * periodDays) / 7
        : input.price *
          scheduleDaysInPeriod(input.schedule, input.startIso, input.endIso)
  const multiplier = input.vatExempt ? 1 : VAT_MULTIPLIER
  return Math.round(net * multiplier * 100) / 100
}

// The cycle a due date on the 25th closes, from the 26th of the month before.
export function billingCyclePeriod(dueDateIso: string): {
  startIso: string
  endIso: string
} {
  const [year, month] = dueDateIso.split('-').map(Number)
  const start = new Date(Date.UTC(year, month - 2, 26))
  return { startIso: start.toISOString().slice(0, 10), endIso: dueDateIso }
}

export function currentBillingPeriod(referenceDate = new Date()) {
  return billingCyclePeriod(toIsoDate(currentBillingCycleDueDate(referenceDate)))
}

// What's left to pay on an invoice after any credit notes.
export function invoiceAmountDue(payment: {
  amount: number
  credited_amount?: number | null
}): number {
  return (
    Math.round(
      (Number(payment.amount) - Number(payment.credited_amount ?? 0)) * 100,
    ) / 100
  )
}

// The 1st of a month at least 8 days ahead, so boarders get notice of a plan change.
export function planChangeDates(todayIso: string, count = 3): string[] {
  const [year, month, day] = todayIso.split('-').map(Number)
  const earliest = Date.UTC(year, month - 1, day + 8)
  const dates: string[] = []
  for (let offset = 1; dates.length < count; offset += 1) {
    const candidate = Date.UTC(year, month - 1 + offset, 1)
    if (candidate >= earliest) {
      dates.push(new Date(candidate).toISOString().slice(0, 10))
    }
  }
  return dates
}
