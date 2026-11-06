// Starts and manages a stable's Stalldrift subscription, on Nestun Digital's own Stripe
// account. Stripe's webhook then tells stripe-billing-webhook what happened.
//
// Auth model: the caller's JWT identifies them, and they must be the stable owner. The
// price comes from public.subscription_plans, never from the request.
//
// Refuses a live key unless STRIPE_CONNECT_ALLOW_LIVE is 'true'.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'npm:stripe@23.1.0'
import { ensurePrice } from '../_shared/subscription.ts'
import { trialEndForCheckout } from '../_shared/subscriptionState.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

const PRODUCTION_ORIGIN = 'https://www.ndstalldrift.no'
const ALLOWED_RETURN_ORIGINS = [
  PRODUCTION_ORIGIN,
  'https://ndstalldrift.no',
  'http://localhost:5180',
]

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const stripeKey = Deno.env.get('STRIPE_CONNECT_SECRET_KEY')
    if (!stripeKey) {
      return jsonResponse({ error: 'Stripe is not configured' }, 503)
    }
    if (
      /^(sk|rk)_live_/.test(stripeKey) &&
      Deno.env.get('STRIPE_CONNECT_ALLOW_LIVE') !== 'true'
    ) {
      return jsonResponse({ error: 'Live Stripe keys are not enabled' }, 503)
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization header' }, 401)
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const callerClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const {
      data: { user: caller },
      error: callerError,
    } = await callerClient.auth.getUser()
    if (callerError || !caller) {
      return jsonResponse({ error: 'Invalid session' }, 401)
    }

    const { action, plan, returnOrigin } = await req.json()
    const admin = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('role, stable_id')
      .eq('id', caller.id)
      .single()
    if (profileError) throw profileError
    if (profile.role !== 'stable_owner' || !profile.stable_id) {
      return jsonResponse({ error: 'Only the stable owner can do this' }, 403)
    }
    const stableId: string = profile.stable_id

    const { data: billing, error: billingError } = await admin
      .from('stable_billing')
      .select('*')
      .eq('stable_id', stableId)
      .single()
    if (billingError) throw billingError
    if (billing.status === 'tester') {
      return jsonResponse({ error: 'tester_account' }, 409)
    }

    const stripe = new Stripe(stripeKey)
    const origin = ALLOWED_RETURN_ORIGINS.includes(returnOrigin)
      ? returnOrigin
      : PRODUCTION_ORIGIN
    const returnUrl = `${origin}/settings?section=subscription`

    if (action === 'portal') {
      if (!billing.stripe_customer_id) {
        return jsonResponse({ error: 'no_subscription' }, 409)
      }
      const session = await stripe.billingPortal.sessions.create({
        customer: billing.stripe_customer_id,
        return_url: returnUrl,
      })
      return jsonResponse({ url: session.url })
    }

    // The plan must be one the stable may choose, or the one it's already on.
    const { data: stable, error: stableError } = await admin
      .from('stables')
      .select('name, email, org_number, plan')
      .eq('id', stableId)
      .single()
    if (stableError) throw stableError
    const { data: planRow, error: planError } = await admin
      .from('subscription_plans')
      .select('key, visible, includes_payments')
      .eq('key', typeof plan === 'string' ? plan : '')
      .maybeSingle()
    if (planError) throw planError
    if (!planRow || (!planRow.visible && planRow.key !== stable.plan)) {
      return jsonResponse({ error: 'plan_not_available' }, 409)
    }

    if (action === 'change_plan') {
      if (!billing.stripe_subscription_id) {
        return jsonResponse({ error: 'no_subscription' }, 409)
      }
      const { data: current } = await admin
        .from('subscription_plans')
        .select('includes_payments')
        .eq('key', stable.plan)
        .single()
      // Leaving card payments goes through the planned switch, so boarders are told.
      if (current?.includes_payments && !planRow.includes_payments) {
        return jsonResponse({ error: 'plan_change_needs_schedule' }, 409)
      }
      const subscription = await stripe.subscriptions.retrieve(
        billing.stripe_subscription_id,
      )
      const item = subscription.items.data[0]
      await stripe.subscriptions.update(subscription.id, {
        items: [
          { id: item.id, price: await ensurePrice(stripe, admin, planRow.key) },
        ],
        metadata: { ...subscription.metadata, plan: planRow.key },
        proration_behavior: 'create_prorations',
      })
      return jsonResponse({ changed: true })
    }

    if (action !== 'checkout') {
      return jsonResponse({ error: 'Unknown action' }, 400)
    }
    if (billing.stripe_subscription_id && billing.status !== 'canceled') {
      return jsonResponse({ error: 'already_subscribed' }, 409)
    }

    let customerId: string | null = billing.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create(
        {
          name: stable.name ?? undefined,
          email: stable.email ?? undefined,
          metadata: {
            stable_id: stableId,
            org_number: stable.org_number ?? '',
          },
        },
        { idempotencyKey: `stalldrift-customer-${stableId}` },
      )
      customerId = customer.id
      const { error: saveError } = await admin
        .from('stable_billing')
        .update({ stripe_customer_id: customerId })
        .eq('stable_id', stableId)
      if (saveError) throw saveError
    }

    const trialEnd = trialEndForCheckout(billing.trial_ends_at, Date.now())
    const metadata = { stable_id: stableId, plan: planRow.key }
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      locale: 'nb',
      allowed_payment_method_types: ['card'],
      // Nestun Digital is the seller, so Stripe's Managed Payments stays off even
      // though it's on by default for the account.
      managed_payments: { enabled: false },
      line_items: [
        { quantity: 1, price: await ensurePrice(stripe, admin, planRow.key) },
      ],
      success_url: returnUrl,
      cancel_url: returnUrl,
      metadata,
      subscription_data: {
        metadata,
        ...(trialEnd ? { trial_end: trialEnd } : {}),
      },
    })
    return jsonResponse({ url: session.url })
  } catch (error) {
    console.error('stripe-billing failed:', error)
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Unexpected error' },
      500,
    )
  }
})
