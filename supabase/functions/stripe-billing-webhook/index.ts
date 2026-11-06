// Receives Stripe's news about stables' Stalldrift subscriptions. Auth is Stripe's
// webhook signature rather than a user JWT, so this function is deployed with
// --no-verify-jwt. It reads the current state from Stripe rather than trusting the
// event, so events arriving late, twice or out of order are harmless.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'npm:stripe@23.1.0'
import {
  billingStatusFor,
  pastDueSince,
  planFromLookupKey,
} from '../_shared/subscriptionState.ts'

const cryptoProvider = Stripe.createSubtleCryptoProvider()

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  const stripeKey = Deno.env.get('STRIPE_CONNECT_SECRET_KEY')
  const webhookSecret = Deno.env.get('STRIPE_BILLING_WEBHOOK_SECRET')
  if (!stripeKey || !webhookSecret) {
    return jsonResponse({ error: 'Webhook is not configured' }, 503)
  }

  const payload = await req.text()
  const stripe = new Stripe(stripeKey)
  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(
      payload,
      req.headers.get('stripe-signature') ?? '',
      webhookSecret,
      undefined,
      cryptoProvider,
    )
  } catch {
    return jsonResponse({ error: 'Invalid signature' }, 400)
  }

  const isLiveKey = /^(sk|rk)_live_/.test(stripeKey)
  if (event.livemode !== isLiveKey) return jsonResponse({ ignored: true })
  // Boarders' payments on stables' own accounts go to stripe-connect-webhook.
  if (event.account) return jsonResponse({ ignored: true })
  if (!event.type.startsWith('customer.subscription.')) {
    return jsonResponse({ ignored: true })
  }

  try {
    const object = event.data.object as Stripe.Subscription
    const subscription = await stripe.subscriptions.retrieve(object.id)
    const stableId = subscription.metadata?.stable_id
    if (!stableId) return jsonResponse({ ignored: true })

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const { data: billing, error: billingError } = await admin
      .from('stable_billing')
      .select('status, past_due_since, stripe_subscription_id')
      .eq('stable_id', stableId)
      .maybeSingle()
    if (billingError) throw billingError
    if (!billing) return jsonResponse({ ignored: true })
    // Testers can't subscribe, so this can only be an old subscription, and it mustn't
    // take away a free account.
    if (billing.status === 'tester') return jsonResponse({ ignored: true })
    // A newer subscription has taken over from this old one.
    if (
      billing.stripe_subscription_id &&
      billing.stripe_subscription_id !== subscription.id &&
      subscription.status === 'canceled'
    ) {
      return jsonResponse({ ignored: true })
    }

    const status = billingStatusFor(subscription.status)
    if (!status) return jsonResponse({ ignored: true })
    const item = subscription.items.data[0]

    const { error: saveError } = await admin
      .from('stable_billing')
      .update({
        status,
        stripe_subscription_id: subscription.id,
        current_period_end: item?.current_period_end
          ? new Date(item.current_period_end * 1000).toISOString()
          : null,
        cancel_at_period_end: subscription.cancel_at_period_end,
        past_due_since: pastDueSince(
          status,
          billing.past_due_since,
          new Date().toISOString(),
        ),
      })
      .eq('stable_id', stableId)
    if (saveError) throw saveError

    // The plan follows the subscription while it's running.
    const plan =
      status === 'canceled'
        ? null
        : (planFromLookupKey(item?.price.lookup_key) ??
          subscription.metadata?.plan ??
          null)
    if (plan) {
      const { error: planError } = await admin
        .from('stables')
        .update({ plan })
        .eq('id', stableId)
      if (planError) throw planError
    }
    return jsonResponse({ updated: true })
  } catch (error) {
    // A non-2xx answer makes Stripe send the event again.
    console.error('stripe-billing-webhook failed:', error)
    return jsonResponse({ error: 'Could not update the subscription' }, 500)
  }
})
