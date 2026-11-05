// Receives Stripe's results for charges on stables' own Stripe accounts. Auth is
// Stripe's webhook signature rather than a user JWT, so this function is deployed
// with --no-verify-jwt.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'npm:stripe@23.1.0'
import {
  recordChargeFailed,
  recordChargeSucceeded,
} from '../_shared/invoiceCharge.ts'
import { notifyChargeFailure } from '../_shared/chargeFailureNotice.ts'
import { releaseCheckoutClaim } from '../_shared/invoiceCheckout.ts'

const cryptoProvider = Stripe.createSubtleCryptoProvider()

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  const stripeKey = Deno.env.get('STRIPE_CONNECT_SECRET_KEY')
  const webhookSecret = Deno.env.get('STRIPE_CONNECT_WEBHOOK_SECRET')
  if (!stripeKey || !webhookSecret) {
    return jsonResponse({ error: 'Webhook is not configured' }, 503)
  }

  // The signature covers the exact bytes sent, so read the body as raw text.
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

  if (
    event.type !== 'payment_intent.succeeded' &&
    event.type !== 'payment_intent.payment_failed' &&
    event.type !== 'checkout.session.expired'
  ) {
    return jsonResponse({ ignored: true })
  }

  // Test events can't touch real invoices, and the other way round.
  const isLiveKey = /^(sk|rk)_live_/.test(stripeKey)
  if (event.livemode !== isLiveKey) return jsonResponse({ ignored: true })

  const paymentId = event.data.object.metadata?.payment_id
  if (!paymentId || !event.account) return jsonResponse({ ignored: true })

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    const { data: payment, error: paymentError } = await admin
      .from('payments')
      .select('id, stable_id')
      .eq('id', paymentId)
      .maybeSingle()
    if (paymentError) throw paymentError
    if (!payment) return jsonResponse({ ignored: true })

    // The event must come from the Stripe account of the invoice's own stable.
    const { data: paymentAccount, error: accountError } = await admin
      .from('stable_payment_accounts')
      .select('stripe_account_id')
      .eq('stable_id', payment.stable_id)
      .maybeSingle()
    if (accountError) throw accountError
    if (paymentAccount?.stripe_account_id !== event.account) {
      console.error('stripe-connect-webhook account mismatch:', event.id)
      return jsonResponse({ ignored: true })
    }

    if (event.type === 'checkout.session.expired') {
      await releaseCheckoutClaim(admin, paymentId, event.data.object.id)
    } else if (event.type === 'payment_intent.succeeded') {
      await recordChargeSucceeded(admin, paymentId, event.data.object.id)
    } else {
      const intent = event.data.object
      await recordChargeFailed(
        admin,
        paymentId,
        intent.id,
        intent.last_payment_error?.decline_code ??
          intent.last_payment_error?.code ??
          'charge_failed',
      )
      await notifyChargeFailure(admin, paymentId)
    }
    return jsonResponse({ updated: true })
  } catch (error) {
    // A non-2xx answer makes Stripe send the event again.
    console.error('stripe-connect-webhook failed:', error)
    return jsonResponse({ error: 'Could not update the invoice' }, 500)
  }
})
