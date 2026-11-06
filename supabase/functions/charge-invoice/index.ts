// Charges one invoice to the boarder's saved card when the stable owner asks for
// it. The money goes straight to the stable's own Stripe account as a direct
// charge, with Stripe's fee taken from that account.
//
// Auth model: the caller's JWT identifies them, and they must be the owner of the
// invoice's stable. The amount, card and Stripe account all come from the
// database, never from the request.
//
// Refuses a live key unless STRIPE_CONNECT_ALLOW_LIVE is 'true'.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'npm:stripe@23.1.0'
import {
  recordChargeFailed,
  recordChargeProcessing,
  recordChargeSucceeded,
} from '../_shared/invoiceCharge.ts'
import { notifyChargeFailure } from '../_shared/chargeFailureNotice.ts'
import { syncCheckout } from '../_shared/invoiceCheckout.ts'
import { chargeBlocker, toMinorUnits } from './chargeRules.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

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
      return jsonResponse({ error: 'Stripe Connect is not configured' }, 503)
    }
    const isLive = /^(sk|rk)_live_/.test(stripeKey)
    if (isLive && Deno.env.get('STRIPE_CONNECT_ALLOW_LIVE') !== 'true') {
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

    const { paymentId } = await req.json()
    if (typeof paymentId !== 'string') {
      return jsonResponse({ error: 'Missing invoice' }, 400)
    }

    const { data: paymentRow, error: paymentError } = await admin
      .from('payments')
      .select(
        `id, stable_id, contract_id, status, amount, credited_amount, due_date, invoice_number,
         charge_status, charge_retry_not_before, charge_failure_count, charge_error, stripe_payment_intent_id, stripe_checkout_session_id,
         invoice_email_delivery_status, invoice_email_delivered_at, invoice_email_sent_to,
         owner:owners(email)`,
      )
      .eq('id', paymentId)
      .maybeSingle()
    if (paymentError) throw paymentError
    // deno-lint-ignore no-explicit-any
    const payment = paymentRow as any
    if (!payment || payment.stable_id !== profile.stable_id) {
      return jsonResponse({ error: 'Invoice not found' }, 404)
    }

    const { data: paymentAccount, error: paymentAccountError } = await admin
      .from('stable_payment_accounts')
      .select('addon_enabled, charges_enabled, stripe_account_id')
      .eq('stable_id', payment.stable_id)
      .maybeSingle()
    if (paymentAccountError) throw paymentAccountError
    if (
      !paymentAccount?.addon_enabled ||
      !paymentAccount.charges_enabled ||
      !paymentAccount.stripe_account_id
    ) {
      return jsonResponse({ error: 'Card payments are not active' }, 409)
    }
    const stripeAccount: string = paymentAccount.stripe_account_id
    const amountDue =
      Math.round(
        (Number(payment.amount) - Number(payment.credited_amount ?? 0)) * 100,
      ) / 100
    const stripe = new Stripe(stripeKey)

    async function reportIntent(intent: Stripe.PaymentIntent) {
      if (intent.status === 'succeeded') {
        await recordChargeSucceeded(admin, paymentId, intent.id)
        return jsonResponse({ outcome: 'succeeded', testMode: !isLive })
      }
      if (intent.status === 'processing') {
        await recordChargeProcessing(admin, paymentId, intent.id)
        return jsonResponse({ outcome: 'processing', testMode: !isLive })
      }
      const reason =
        intent.last_payment_error?.decline_code ??
        intent.last_payment_error?.code ??
        intent.status
      await recordChargeFailed(admin, paymentId, intent.id, reason)
      const boarderNotified = await notifyChargeFailure(admin, paymentId)
      return jsonResponse({
        outcome: 'failed',
        reason,
        boarderNotified,
        testMode: !isLive,
      })
    }

    // The boarder has a payment page for this invoice, so charging the saved card
    // now could collect it twice.
    if (
      payment.charge_status === 'processing' &&
      payment.stripe_checkout_session_id
    ) {
      const checkout = await syncCheckout(
        stripe,
        admin,
        paymentId,
        payment.stripe_checkout_session_id,
        stripeAccount,
      )
      if (checkout.state === 'paid') {
        return jsonResponse({ outcome: 'succeeded', testMode: !isLive })
      }
      return jsonResponse({
        blocked:
          checkout.state === 'released'
            ? 'checkout_ended'
            : 'charge_in_progress',
        testMode: !isLive,
      })
    }

    // A charge already at Stripe: report what it became rather than starting one.
    if (
      payment.charge_status === 'processing' &&
      payment.stripe_payment_intent_id
    ) {
      const intent = await stripe.paymentIntents.retrieve(
        payment.stripe_payment_intent_id,
        {},
        { stripeAccount },
      )
      return await reportIntent(intent)
    }

    const { data: agreement, error: agreementError } = await admin
      .from('card_agreements')
      .select(
        'id, stripe_customer_id, stripe_payment_method_id, activated_at, paused_at',
      )
      .eq('contract_id', payment.contract_id)
      .is('withdrawn_at', null)
      .maybeSingle()
    if (agreementError) throw agreementError

    const allowReal = Deno.env.get('INVOICE_EMAIL_ALLOW_REAL') === 'true'
    const blocker = chargeBlocker({
      status: payment.status,
      // A stuck claim is handled by claim_invoice_charge below.
      chargeStatus:
        payment.charge_status === 'processing' ? null : payment.charge_status,
      amount: amountDue,
      dueDate: payment.due_date,
      agreementActive: Boolean(agreement?.activated_at),
      hasCard: Boolean(
        agreement?.stripe_customer_id && agreement?.stripe_payment_method_id,
      ),
      paused: Boolean(agreement?.paused_at),
      retryNotBefore: payment.charge_retry_not_before,
      failureCount: payment.charge_failure_count,
      chargeError: payment.charge_error,
      deliveryStatus: payment.invoice_email_delivery_status,
      deliveredAt: payment.invoice_email_delivered_at,
      sentTo: payment.invoice_email_sent_to,
      expectedRecipient: allowReal
        ? (payment.owner?.email ?? null)
        : (Deno.env.get('INVOICE_EMAIL_TEST_TO') ?? null),
      today: new Date().toISOString().slice(0, 10),
      isLive,
    })
    if (blocker) return jsonResponse({ blocked: blocker, testMode: !isLive })

    const { data: attempt, error: claimError } = await admin.rpc(
      'claim_invoice_charge',
      { p_payment_id: paymentId },
    )
    if (claimError) throw claimError
    if (attempt === null) {
      return jsonResponse({
        blocked: 'charge_in_progress',
        testMode: !isLive,
      })
    }

    let intent: Stripe.PaymentIntent
    try {
      intent = await stripe.paymentIntents.create(
        {
          amount: toMinorUnits(amountDue),
          currency: 'nok',
          customer: agreement!.stripe_customer_id,
          payment_method: agreement!.stripe_payment_method_id,
          off_session: true,
          confirm: true,
          description: `Faktura ${payment.invoice_number ?? payment.id}`,
          metadata: {
            payment_id: payment.id,
            stable_id: payment.stable_id,
            contract_id: payment.contract_id,
            card_agreement_id: agreement!.id,
          },
        },
        {
          stripeAccount,
          idempotencyKey: `stalldrift-invoice-${payment.id}-attempt-${attempt}`,
        },
      )
    } catch (error) {
      // Stripe said no, so nothing was charged and it's safe to record a failure.
      if (
        error instanceof Stripe.errors.StripeCardError ||
        error instanceof Stripe.errors.StripeInvalidRequestError
      ) {
        const reason = error.decline_code ?? error.code ?? 'charge_failed'
        await recordChargeFailed(
          admin,
          paymentId,
          error.payment_intent?.id ?? null,
          reason,
        )
        const boarderNotified = await notifyChargeFailure(admin, paymentId)
        return jsonResponse({
          outcome: 'failed',
          reason,
          boarderNotified,
          testMode: !isLive,
        })
      }
      // No clear answer: the charge may have gone through. The invoice stays
      // claimed, so it can't be charged again until this is cleared up.
      console.error('charge-invoice outcome unknown:', error)
      return jsonResponse({ outcome: 'unknown', testMode: !isLive })
    }

    return await reportIntent(intent)
  } catch (error) {
    console.error('charge-invoice failed:', error)
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Unexpected error' },
      500,
    )
  }
})
