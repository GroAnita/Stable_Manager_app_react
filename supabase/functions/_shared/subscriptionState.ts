// How a Stripe subscription maps onto Stalldrift's billing status. Kept separate so it
// has no Deno or network dependency.

export const PRICE_LOOKUP_PREFIX = 'stalldrift_'

export type BillingInterval = 'month' | 'year'

// A year costs eleven months: one month free for paying a year ahead.
export const YEARLY_MONTHS_CHARGED = 11
const YEARLY_SUFFIX = '_yearly'
// The stables that tested StallOrg keep the old prices for 12 months.
const FOUNDER_SUFFIX = '_founder'
// How long before the founder price ends the subscription moves to the normal
// price (without proration, so nothing is charged then). Earlier than Stripe's
// renewal reminder 7 days ahead, so that email already shows the normal price.
export const FOUNDER_SWITCH_DAYS_BEFORE = 10

export function isBillingInterval(value: unknown): value is BillingInterval {
  return value === 'month' || value === 'year'
}

// Monthly prices keep their old keys (stalldrift_small); yearly ones end in
// _yearly, and founder prices in _founder after that.
export function priceLookupKey(
  plan: string,
  interval: BillingInterval = 'month',
  founder = false,
): string {
  return `${PRICE_LOOKUP_PREFIX}${plan}${interval === 'year' ? YEARLY_SUFFIX : ''}${founder ? FOUNDER_SUFFIX : ''}`
}

export function planFromLookupKey(
  key: string | null | undefined,
): string | null {
  if (!key?.startsWith(PRICE_LOOKUP_PREFIX)) return null
  let rest = key.slice(PRICE_LOOKUP_PREFIX.length)
  if (rest.endsWith(FOUNDER_SUFFIX))
    rest = rest.slice(0, -FOUNDER_SUFFIX.length)
  if (rest.endsWith(YEARLY_SUFFIX)) rest = rest.slice(0, -YEARLY_SUFFIX.length)
  return rest
}

export function isFounderLookupKey(key: string | null | undefined): boolean {
  return !!key?.startsWith(PRICE_LOOKUP_PREFIX) && key.endsWith(FOUNDER_SUFFIX)
}

// Whether the stable pays the founder price on its next checkout or plan change:
// while its founder price runs, or before the offer closes if it hasn't started.
export function hasFounderPrice(
  billing: {
    founder_offer_until?: string | null
    founder_price_until?: string | null
  },
  nowMs: number,
): boolean {
  if (billing.founder_price_until) {
    return Date.parse(billing.founder_price_until) > nowMs
  }
  return (
    !!billing.founder_offer_until &&
    Date.parse(billing.founder_offer_until) > nowMs
  )
}

// The founder price lasts 12 months from the first billing date (the end of the
// trial, or the day the subscription started).
export function founderPriceUntil(firstBillingSeconds: number): string {
  const date = new Date(firstBillingSeconds * 1000)
  date.setUTCMonth(date.getUTCMonth() + 12)
  return date.toISOString()
}

export function priceNokFor(
  monthlyNok: number,
  interval: BillingInterval,
): number {
  return interval === 'year' ? monthlyNok * YEARLY_MONTHS_CHARGED : monthlyNok
}

export type BillingStatus = 'active' | 'past_due' | 'canceled'

// Null means nothing has been paid or decided yet, so the stable's status stays as it is.
export function billingStatusFor(stripeStatus: string): BillingStatus | null {
  switch (stripeStatus) {
    case 'active':
    case 'trialing':
      return 'active'
    case 'past_due':
    case 'unpaid':
      return 'past_due'
    case 'canceled':
    case 'incomplete_expired':
      return 'canceled'
    default:
      return null
  }
}

// Keeps the first date a payment failed, so retries don't restart the 14 days.
export function pastDueSince(
  status: BillingStatus | null,
  previous: string | null,
  now: string,
): string | null {
  return status === 'past_due' ? (previous ?? now) : null
}

export function trialEndForCheckout(
  trialEndsAt: string | null,
  nowMs: number,
): number | null {
  if (!trialEndsAt) return null
  const end = Date.parse(trialEndsAt)
  // Stripe wants a trial to end at least 48 hours ahead.
  return end - nowMs > 49 * 3600 * 1000 ? Math.floor(end / 1000) : null
}
