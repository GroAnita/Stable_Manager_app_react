// The Stripe client for StallOrg's own subscriptions (stables paying Nestun
// Digital). It has its own key, STRIPE_BILLING_SECRET_KEY, so subscriptions can
// be live while card payment of stall rent (Stripe Connect, on
// STRIPE_CONNECT_SECRET_KEY) is still in test mode. Without its own key it falls
// back to the Connect key, as before the split.
//
// A live key is refused unless the matching *_ALLOW_LIVE secret is 'true'.
import Stripe from 'npm:stripe@23.1.0'

export function billingStripe(): Stripe | null {
  const ownKey = Deno.env.get('STRIPE_BILLING_SECRET_KEY')
  const key = ownKey ?? Deno.env.get('STRIPE_CONNECT_SECRET_KEY')
  if (!key) return null
  const allowLive = Deno.env.get(
    ownKey ? 'STRIPE_BILLING_ALLOW_LIVE' : 'STRIPE_CONNECT_ALLOW_LIVE',
  )
  if (/^(sk|rk)_live_/.test(key) && allowLive !== 'true') return null
  return new Stripe(key)
}
