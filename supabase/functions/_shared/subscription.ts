// Shared by the functions that deal with a stable's Stalldrift subscription.
// deno-lint-ignore-file no-explicit-any
import type Stripe from 'npm:stripe@23.1.0'
import { priceLookupKey } from './subscriptionState.ts'

// Finds the plan's price in Stripe, making it from public.subscription_plans the first
// time or when the price there has changed, so the two can't drift apart.
export async function ensurePrice(
  stripe: Stripe,
  admin: any,
  plan: string,
): Promise<string> {
  const { data: row, error } = await admin
    .from('subscription_plans')
    .select('name, price_nok')
    .eq('key', plan)
    .single()
  if (error) throw error

  const lookupKey = priceLookupKey(plan)
  const unitAmount = row.price_nok * 100
  const { data: existing } = await stripe.prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 1,
  })
  if (
    existing[0]?.unit_amount === unitAmount &&
    existing[0]?.currency === 'nok'
  ) {
    return existing[0].id
  }

  const price = await stripe.prices.create(
    {
      currency: 'nok',
      unit_amount: unitAmount,
      recurring: { interval: 'month' },
      lookup_key: lookupKey,
      transfer_lookup_key: true,
      // The price stays the same for customers when VAT registration comes.
      tax_behavior: 'inclusive',
      product_data: { name: `Stalldrift ${row.name}` },
    },
    { idempotencyKey: `stalldrift-price-${lookupKey}-${unitAmount}` },
  )
  return price.id
}

// Puts the stable's subscription on the plan its row says, after a planned switch.
export async function syncSubscriptionPlan(
  stripe: Stripe,
  admin: any,
  stableId: string,
): Promise<void> {
  const { data: billing, error } = await admin
    .from('stable_billing')
    .select('stripe_subscription_id')
    .eq('stable_id', stableId)
    .maybeSingle()
  if (error) throw error
  if (!billing?.stripe_subscription_id) return

  const { data: stable, error: stableError } = await admin
    .from('stables')
    .select('plan')
    .eq('id', stableId)
    .single()
  if (stableError) throw stableError

  const subscription = await stripe.subscriptions.retrieve(
    billing.stripe_subscription_id,
  )
  const item = subscription.items.data[0]
  const price = await ensurePrice(stripe, admin, stable.plan)
  if (item && item.price.id !== price) {
    await stripe.subscriptions.update(subscription.id, {
      items: [{ id: item.id, price }],
      metadata: { ...subscription.metadata, plan: stable.plan },
      proration_behavior: 'create_prorations',
    })
  }
}
