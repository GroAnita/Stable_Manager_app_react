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
        Math.round(contractDailyRate(item.id, allocations) * days * 100) /
        100,
    }))
    .filter((line) => line.quantity > 0)
}
