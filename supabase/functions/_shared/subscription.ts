// Shared by the functions that deal with a stable's StallOrg subscription.
// deno-lint-ignore-file no-explicit-any
import type Stripe from 'npm:stripe@23.1.0'
import {
  priceLookupKey,
  priceNokFor,
  type BillingInterval,
} from './subscriptionState.ts'

// The product names in Stripe, as the stable owner sees them on receipts and
// invoices. Plans with card payments are StallOrgPro.
const SIZE_NAMES: Record<string, string> = {
  small: 'Liten',
  medium: 'Medium',
  large: 'Stor',
  xlarge: 'XL',
}

export function stripeProductName(plan: string, fallback: string): string {
  const withPayments = plan.endsWith('_payments')
  const size = SIZE_NAMES[plan.replace(/_payments$/, '')]
  if (!size) return `StallOrg ${fallback}`
  return `${withPayments ? 'StallOrgPro' : 'StallOrg'} ${size}`
}

// Finds the plan's monthly or yearly price in Stripe, making it from public.subscription_plans the first
// time or when the price there has changed, so the two can't drift apart.
export async function ensurePrice(
  stripe: Stripe,
  admin: any,
  plan: string,
  interval: BillingInterval = 'month',
): Promise<string> {
  const { data: row, error } = await admin
    .from('subscription_plans')
    .select('name, price_nok')
    .eq('key', plan)
    .single()
  if (error) throw error

  const lookupKey = priceLookupKey(plan, interval)
  const unitAmount = priceNokFor(row.price_nok, interval) * 100
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
      recurring: { interval },
      lookup_key: lookupKey,
      transfer_lookup_key: true,
      // The price stays the same for customers when VAT registration comes.
      tax_behavior: 'inclusive',
      product_data: {
        name: `${stripeProductName(plan, row.name)}${interval === 'year' ? ' (årlig)' : ''}`,
      },
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
  if (!item) return
  // A yearly subscription stays yearly; the difference is invoiced now rather
  // than a year from now.
  const interval: BillingInterval =
    item.price.recurring?.interval === 'year' ? 'year' : 'month'
  const price = await ensurePrice(stripe, admin, stable.plan, interval)
  if (item.price.id !== price) {
    await stripe.subscriptions.update(subscription.id, {
      items: [{ id: item.id, price }],
      metadata: { ...subscription.metadata, plan: stable.plan },
      proration_behavior:
        interval === 'year' ? 'always_invoice' : 'create_prorations',
    })
  }
}
