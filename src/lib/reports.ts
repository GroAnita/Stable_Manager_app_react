import type { ContractAllocation } from '../features/contracts/api'
import type { PriceListItem } from '../features/priceList/api'
import { contractDailyRate } from './inventory'

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function monthRange(
  year: number,
  month: number,
): { from: string; to: string; days: number } {
  const from = new Date(year, month, 1)
  const to = new Date(year, month + 1, 0)
  return { from: toIsoDate(from), to: toIsoDate(to), days: to.getDate() }
}

export function categoryLabel(
  t: (key: string) => string,
  value: string | null,
): string {
  if (!value) return '—'
  const key = `category.${value.toLowerCase()}`
  const translated = t(key)
  return translated === key ? value : translated
}

export function unitLabel(
  t: (key: string) => string,
  value: string | null,
): string {
  if (!value) return '—'
  const key = `unit.${value.toLowerCase()}`
  const translated = t(key)
  return translated === key ? value : translated
}

export type UsageLine = { item: PriceListItem; quantity: number }

// Estimated from current active contracts' allocations, same approximation
// the Inventory page's low-stock calculation already relies on — there's
// no historical daily-consumption log to reconstruct a past month exactly.
export function usageByCategory(
  category: string,
  priceListItems: PriceListItem[],
  allocations: ContractAllocation[],
  days: number,
): UsageLine[] {
  return priceListItems
    .filter((item) => item.category === category)
    .map((item) => ({
      item,
      quantity:
        Math.round(contractDailyRate(item.id, allocations) * days * 100) / 100,
    }))
    .filter((line) => line.quantity > 0)
}

type PaymentMoney = {
  amount: number
  status: string
  paid_date: string | null
  stripe_fee: number | null
  refunded_amount: number
  refunded_at: string | null
  dispute_amount: number | null
  dispute_lost_at: string | null
  dispute_fee: number | null
  dispute_opened_at: string | null
}

// Money counts in the month it moved: a payment when it was paid, and a refund or
// lost dispute when the money went back, which can be a later month. Stripe takes
// a dispute's fee when the dispute opens.
export function paymentMoneyTotals(
  payments: PaymentMoney[],
  from: string,
  to: string,
): { collected: number; stripeFees: number; returned: number } {
  const inRange = (date: string | null) =>
    date !== null && date.slice(0, 10) >= from && date.slice(0, 10) <= to
  let collected = 0
  let stripeFees = 0
  let returned = 0
  for (const payment of payments) {
    if (payment.status === 'paid' && inRange(payment.paid_date)) {
      collected += payment.amount
      stripeFees += payment.stripe_fee ?? 0
    }
    if (inRange(payment.dispute_opened_at)) {
      stripeFees += payment.dispute_fee ?? 0
    }
    if (inRange(payment.refunded_at)) returned += payment.refunded_amount
    if (inRange(payment.dispute_lost_at))
      returned += payment.dispute_amount ?? 0
  }
  const round = (value: number) => Math.round(value * 100) / 100
  return {
    collected: round(collected),
    stripeFees: round(stripeFees),
    returned: round(returned),
  }
}
