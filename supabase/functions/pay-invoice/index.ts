// Lets a boarder pay one of their own invoices on Stripe's payment page. The card
// is entered there and isn't saved. The money goes straight to the stable's own
// Stripe account, and the webhook or the next sync marks the invoice paid.
//
// Auth model: the caller's JWT identifies them, and the invoice must belong to the
// owner record linked to that user. The amount and Stripe account come from the
// database, never from the request.
//
// Refuses a live key unless STRIPE_CONNECT_ALLOW_LIVE is 'true'.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'npm:stripe@23.1.0'
import { syncCheckout } from '../_shared/invoiceCheckout.ts'

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

// Stripe won't let a payment page expire sooner than 30 minutes.
const CHECKOUT_MINUTES = 31

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

    const { action, paymentId, returnOrigin } = await req.json()
    if (typeof paymentId !== 'string') {
      return jsonResponse({ error: 'Missing invoice' }, 400)
    }

    const admin = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: paymentRow, error: paymentError } = await admin
      .from('payments')
      .select(
        `id, stable_id, contract_id, status, amount, credited_amount, invoice_number, charge_status,
         stripe_checkout_session_id,
         owner:owners(user_id, email),
         stable:stables(name)`,
      )
      .eq('id', paymentId)
      .maybeSingle()
    if (paymentError) throw paymentError
    // deno-lint-ignore no-explicit-any
    const payment = paymentRow as any
    if (!payment || payment.owner?.user_id !== caller.id) {
      return jsonResponse({ error: 'Invoice not found' }, 404)
    }

    const { data: paymentAccount, error: paymentAccountError } = await admin
      .from('stable_payment_accounts')
      .select(
        'addon_enabled, card_signing_enabled, charges_enabled, stripe_account_id',
      )
      .eq('stable_id', payment.stable_id)
      .maybeSingle()
    if (paymentAccountError) throw paymentAccountError
    const stripeAccount: string | null =
      paymentAccount?.stripe_account_id ?? null
    if (!stripeAccount) {
      return jsonResponse({ error: 'Card payments are not active' }, 409)
    }

    const stripe = new Stripe(stripeKey)

    let checkout = null
    if (
      payment.charge_status === 'processing' &&
      payment.stripe_checkout_session_id
    ) {
      checkout = await syncCheckout(
        stripe,
        admin,
        paymentId,
        payment.stripe_checkout_session_id,
        stripeAccount,
      )
      if (checkout.state === 'paid') return jsonResponse({ state: 'paid' })
    }

    if (action === 'sync') {
      return jsonResponse({ state: checkout?.state ?? 'unchanged' })
    }

    if (action !== 'start') {
      return jsonResponse({ error: 'Unknown action' }, 400)
    }

    if (payment.status === 'paid') return jsonResponse({ state: 'paid' })

    // Coming back to a page still open continues it, so only one can exist.
    if (checkout?.state === 'open' && checkout.url) {
      return jsonResponse({ url: checkout.url })
    }

    if (
      !paymentAccount?.addon_enabled ||
      !paymentAccount.card_signing_enabled ||
      !paymentAccount.charges_enabled
    ) {
      return jsonResponse({ error: 'Card payments are not active' }, 409)
    }

    // Stripe takes amounts in øre.
    const amount = Math.round(
      (Number(payment.amount) - Number(payment.credited_amount ?? 0)) * 100,
    )
    if (amount <= 0) {
      return jsonResponse({ error: 'The invoice is fully credited' }, 409)
    }
    if (amount < 300) {
      return jsonResponse(
        { error: 'The amount is too low to pay by card' },
        409,
      )
    }

    const { data: attempt, error: claimError } = await admin.rpc(
      'claim_invoice_charge',
      { p_payment_id: paymentId },
    )
    if (claimError) throw claimError
    if (attempt === null) {
      return jsonResponse({ blocked: 'charge_in_progress' })
    }

    const origin = ALLOWED_RETURN_ORIGINS.includes(returnOrigin)
      ? returnOrigin
      : PRODUCTION_ORIGIN
    const returnUrl = `${origin}/my-contract`
    const metadata = {
      payment_id: payment.id,
      stable_id: payment.stable_id,
      contract_id: payment.contract_id,
    }

    let session: Stripe.Checkout.Session
    try {
      session = await stripe.checkout.sessions.create(
        {
          mode: 'payment',
          allowed_payment_method_types: ['card'],
          locale: 'nb',
          customer_email: payment.owner?.email ?? undefined,
          expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_MINUTES * 60,
          success_url: returnUrl,
          cancel_url: returnUrl,
          metadata,
          payment_intent_data: { metadata },
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: 'nok',
                unit_amount: amount,
                product_data: {
                  name: `Faktura ${payment.invoice_number ?? payment.id}`,
                  description: payment.stable?.name ?? undefined,
                },
              },
            },
          ],
        },
        { stripeAccount },
      )
    } catch (error) {
      // No page exists for the boarder to pay on, so nothing can be collected.
      await admin
        .from('payments')
        .update({ charge_status: null })
        .eq('id', paymentId)
        .eq('charge_status', 'processing')
      throw error
    }

    const { error: saveError } = await admin
      .from('payments')
      .update({ stripe_checkout_session_id: session.id })
      .eq('id', paymentId)
    if (saveError) throw saveError

    return jsonResponse({ url: session.url })
  } catch (error) {
    console.error('pay-invoice failed:', error)
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Unexpected error' },
      500,
    )
  }
})
