// How a Stripe subscription maps onto Stalldrift's billing status. Kept separate so it
// has no Deno or network dependency.

export const PRICE_LOOKUP_PREFIX = 'stalldrift_'

export function priceLookupKey(plan: string): string {
  return `${PRICE_LOOKUP_PREFIX}${plan}`
}

export function planFromLookupKey(
  key: string | null | undefined,
): string | null {
  return key?.startsWith(PRICE_LOOKUP_PREFIX)
    ? key.slice(PRICE_LOOKUP_PREFIX.length)
    : null
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
