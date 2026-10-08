import type { ContractAllocation } from '../features/contracts/api'

const DAYS_PER_MONTH = 30

export type StockDelivery = {
  quantity: number
  delivered_on: string
}

// Hay allocations are already a daily rate (kg/day per horse). Bedding
// allocations are a monthly quantity per the contract, so they're
// converted to an approximate daily rate.
export function contractDailyRate(
  priceListItemId: string,
  contracts: ContractAllocation[],
): number {
  return contracts.reduce((sum, contract) => {
    let rate = 0
    if (contract.hay_price_list_item_id === priceListItemId) {
      rate += contract.included_hay_kg ?? 0
    }
    if (contract.bedding_price_list_item_id === priceListItemId) {
      rate += (contract.bedding_quantity ?? 0) / DAYS_PER_MONTH
    }
    return sum + rate
  }, 0)
}

// Extra feed an owner logs beyond the contract (see FeedingExtras) is a
// one-off quantity on a specific date, not part of the ongoing daily rate.
export function currentStock(
  deliveries: StockDelivery[],
  extraQuantities: number[],
  dailyRate: number,
): number {
  if (deliveries.length === 0) return 0
  const totalDelivered = deliveries.reduce((sum, d) => sum + d.quantity, 0)
  const totalExtras = extraQuantities.reduce((sum, q) => sum + q, 0)
  const earliest = deliveries.reduce(
    (min, d) => (d.delivered_on < min ? d.delivered_on : min),
    deliveries[0].delivered_on,
  )
  const daysSince = Math.max(
    0,
    Math.floor((Date.now() - new Date(earliest).getTime()) / 86400000),
  )
  const consumed = dailyRate * daysSince + totalExtras
  return Math.max(0, Math.round((totalDelivered - consumed) * 100) / 100)
}

export function daysRemaining(stock: number, dailyRate: number): number | null {
  if (dailyRate <= 0) return null
  return Math.floor(stock / dailyRate)
}

export function isLowStock(
  remaining: number | null,
  thresholdDays: number,
): boolean {
  return remaining !== null && remaining <= thresholdDays
}
