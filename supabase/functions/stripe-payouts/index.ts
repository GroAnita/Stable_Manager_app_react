// Shows what went into each Stripe payout to a stable's bank, for the stable's
// accountant: a payout is one net amount covering many invoices, refunds and fees.
// Read only. It asks Stripe each time rather than keeping a copy.
//
// Auth model: the caller's JWT identifies them, and they must be the stable owner.
//
// Refuses a live key unless STRIPE_CONNECT_ALLOW_LIVE is 'true'.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'npm:stripe@23.1.0'
import { buildPayoutSummary, type PayoutMovement } from './payoutRows.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

const MAX_PAYOUTS = 40
const MAX_MOVEMENTS = 1000

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function unixDay(iso: string, endOfDay: boolean): number {
  return Math.floor(
    Date.parse(`${iso}T${endOfDay ? '23:59:59' : '00:00:00'}Z`) / 1000,
  )
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

    const { from, to } = await req.json()
    const isDate = (value: unknown) =>
      typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    if (!isDate(from) || !isDate(to)) {
      return jsonResponse({ error: 'Missing period' }, 400)
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

    const { data: account, error: accountError } = await admin
      .from('stable_payment_accounts')
      .select('stripe_account_id')
      .eq('stable_id', profile.stable_id)
      .maybeSingle()
    if (accountError) throw accountError
    const stripeAccount: string | null = account?.stripe_account_id ?? null
    if (!stripeAccount) return jsonResponse({ connected: false, payouts: [] })

    const stripe = new Stripe(stripeKey)
    const payouts = await stripe.payouts
      .list(
        {
          arrival_date: { gte: unixDay(from, false), lte: unixDay(to, true) },
          limit: 100,
        },
        { stripeAccount },
      )
      .autoPagingToArray({ limit: MAX_PAYOUTS })

    const collected: {
      payout: Stripe.Payout
      movements: PayoutMovement[]
      manual: boolean
    }[] = []
    for (const payout of payouts) {
      // Stripe can only list the contents of automatic payouts.
      if (!payout.automatic) {
        collected.push({ payout, movements: [], manual: true })
        continue
      }
      const transactions = await stripe.balanceTransactions
        .list(
          { payout: payout.id, limit: 100, expand: ['data.source'] },
          { stripeAccount },
        )
        .autoPagingToArray({ limit: MAX_MOVEMENTS })
      collected.push({
        payout,
        manual: false,
        movements: transactions.map((transaction) => {
          // deno-lint-ignore no-explicit-any
          const source = transaction.source as any
          return {
            type: transaction.type,
            amount: transaction.amount,
            fee: transaction.fee,
            net: transaction.net,
            created: transaction.created,
            paymentIntentId:
              typeof source?.payment_intent === 'string'
                ? source.payment_intent
                : null,
          }
        }),
      })
    }

    const intentIds = [
      ...new Set(
        collected.flatMap(({ movements }) =>
          movements.flatMap((movement) =>
            movement.paymentIntentId ? [movement.paymentIntentId] : [],
          ),
        ),
      ),
    ]
    const invoiceNumbers = new Map<string, string | null>()
    for (let start = 0; start < intentIds.length; start += 200) {
      const { data: rows, error: rowsError } = await admin
        .from('payments')
        .select('stripe_payment_intent_id, invoice_number')
        .eq('stable_id', profile.stable_id)
        .in('stripe_payment_intent_id', intentIds.slice(start, start + 200))
      if (rowsError) throw rowsError
      for (const row of rows ?? []) {
        invoiceNumbers.set(row.stripe_payment_intent_id, row.invoice_number)
      }
    }

    return jsonResponse({
      connected: true,
      livemode: /^(sk|rk)_live_/.test(stripeKey),
      payouts: collected.map(({ payout, movements, manual }) => ({
        ...buildPayoutSummary({
          id: payout.id,
          arrivalDate: payout.arrival_date,
          status: payout.status,
          amount: payout.amount,
          movements,
          invoiceNumbers,
        }),
        manual,
      })),
    })
  } catch (error) {
    console.error('stripe-payouts failed:', error)
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Unexpected error' },
      500,
    )
  }
})
