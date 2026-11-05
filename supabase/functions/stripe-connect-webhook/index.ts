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
import {
  recordStripeFee,
  syncDispute,
  syncRefunds,
} from '../_shared/paymentAftercare.ts'

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

  // Test events can't touch real invoices, and the other way round.
  const isLiveKey = /^(sk|rk)_live_/.test(stripeKey)
  if (event.livemode !== isLiveKey) return jsonResponse({ ignored: true })

  if (!event.account) return jsonResponse({ ignored: true })
  const stripeAccount = event.account

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Checks a payment is real and belongs to the Stripe account the event is from.
  async function findPayment(
    column: 'id' | 'stripe_payment_intent_id',
    value: string,
  ) {
    const { data: payment, error } = await admin
      .from('payments')
      .select('id, stable_id, stripe_fee')
      .eq(column, value)
      .maybeSingle()
    if (error) throw error
    if (!payment) return null

    const { data: paymentAccount, error: accountError } = await admin
      .from('stable_payment_accounts')
      .select('stripe_account_id')
      .eq('stable_id', payment.stable_id)
      .maybeSingle()
    if (accountError) throw accountError
    if (paymentAccount?.stripe_account_id !== stripeAccount) {
      console.error('stripe-connect-webhook account mismatch:', event.id)
      return null
    }
    return payment
  }

  // A payment made on Stripe's page isn't linked to its invoice until its success
  // event arrives, and Stripe doesn't promise the order of events. So if the link
  // isn't there yet, ask Stripe which invoice the payment belongs to.
  async function findPaymentForIntent(paymentIntentId: string) {
    const linked = await findPayment(
      'stripe_payment_intent_id',
      paymentIntentId,
    )
    if (linked) return linked
    const intent = await stripe.paymentIntents.retrieve(
      paymentIntentId,
      {},
      { stripeAccount },
    )
    const paymentId = intent.metadata?.payment_id
    return paymentId ? await findPayment('id', paymentId) : null
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const intent = event.data.object
        const paymentId = intent.metadata?.payment_id
        const payment = paymentId ? await findPayment('id', paymentId) : null
        if (!payment) return jsonResponse({ ignored: true })
        await recordChargeSucceeded(admin, payment.id, intent.id)
        if (typeof intent.latest_charge === 'string') {
          await recordStripeFee(
            stripe,
            admin,
            payment.id,
            intent.latest_charge,
            stripeAccount,
          )
        }
        break
      }
      case 'payment_intent.payment_failed': {
        const intent = event.data.object
        const paymentId = intent.metadata?.payment_id
        const payment = paymentId ? await findPayment('id', paymentId) : null
        if (!payment) return jsonResponse({ ignored: true })
        await recordChargeFailed(
          admin,
          payment.id,
          intent.id,
          intent.last_payment_error?.decline_code ??
            intent.last_payment_error?.code ??
            'charge_failed',
        )
        await notifyChargeFailure(admin, payment.id)
        break
      }
      case 'checkout.session.expired': {
        const session = event.data.object
        const paymentId = session.metadata?.payment_id
        const payment = paymentId ? await findPayment('id', paymentId) : null
        if (!payment) return jsonResponse({ ignored: true })
        await releaseCheckoutClaim(admin, payment.id, session.id)
        break
      }
      case 'charge.updated': {
        const charge = event.data.object
        if (typeof charge.payment_intent !== 'string') {
          return jsonResponse({ ignored: true })
        }
        const payment = await findPaymentForIntent(charge.payment_intent)
        if (!payment || payment.stripe_fee !== null) {
          return jsonResponse({ ignored: true })
        }
        await recordStripeFee(
          stripe,
          admin,
          payment.id,
          charge.id,
          stripeAccount,
        )
        break
      }
      case 'charge.refunded': {
        const charge = event.data.object
        if (typeof charge.payment_intent !== 'string') {
          return jsonResponse({ ignored: true })
        }
        const payment = await findPaymentForIntent(charge.payment_intent)
        if (!payment) return jsonResponse({ ignored: true })
        await syncRefunds(stripe, admin, payment.id, charge.id, stripeAccount)
        break
      }
      case 'charge.refund.updated': {
        const refund = event.data.object
        if (
          typeof refund.payment_intent !== 'string' ||
          typeof refund.charge !== 'string'
        ) {
          return jsonResponse({ ignored: true })
        }
        const payment = await findPaymentForIntent(refund.payment_intent)
        if (!payment) return jsonResponse({ ignored: true })
        await syncRefunds(
          stripe,
          admin,
          payment.id,
          refund.charge,
          stripeAccount,
        )
        break
      }
      case 'charge.dispute.created':
      case 'charge.dispute.updated':
      case 'charge.dispute.closed': {
        const dispute = event.data.object
        if (typeof dispute.payment_intent !== 'string') {
          return jsonResponse({ ignored: true })
        }
        const payment = await findPaymentForIntent(dispute.payment_intent)
        if (!payment) return jsonResponse({ ignored: true })
        await syncDispute(stripe, admin, payment.id, dispute.id, stripeAccount)
        break
      }
      default:
        return jsonResponse({ ignored: true })
    }
    return jsonResponse({ updated: true })
  } catch (error) {
    // A non-2xx answer makes Stripe send the event again.
    console.error('stripe-connect-webhook failed:', error)
    return jsonResponse({ error: 'Could not update the invoice' }, 500)
  }
})
