// Connects a stable to Stripe so it can take payments from its boarders.
// Each stable gets its own Stripe account with the full Stripe Dashboard;
// Stripe bills that account for fees and handles loss liability, and later
// payments will be direct charges on it.
//
// Uses STRIPE_CONNECT_SECRET_KEY rather than STRIPE_SECRET_KEY, and refuses a
// live key unless STRIPE_CONNECT_ALLOW_LIVE is 'true', so testing can't create
// real Stripe accounts.
//
// Auth model: the caller's JWT identifies them, then their role and stable are
// read server-side. Only the owner of a stable with the add-on switched on can
// connect it, and the Stripe account always comes from the database, never from
// the request.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'npm:stripe@23.1.0'

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

const ACCOUNT_INCLUDE = ['configuration.merchant'] as const

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function capabilityFlags(account: Stripe.V2.Core.Account) {
  const capabilities = account.configuration?.merchant?.capabilities
  return {
    charges_enabled: capabilities?.card_payments?.status === 'active',
    payouts_enabled: capabilities?.stripe_balance?.payouts?.status === 'active',
  }
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
    const isLiveKey = /^(sk|rk)_live_/.test(stripeKey)
    if (isLiveKey && Deno.env.get('STRIPE_CONNECT_ALLOW_LIVE') !== 'true') {
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
    const stableId: string = profile.stable_id

    const { data: paymentAccount, error: paymentAccountError } = await admin
      .from('stable_payment_accounts')
      .select('addon_enabled, stripe_account_id')
      .eq('stable_id', stableId)
      .maybeSingle()
    if (paymentAccountError) throw paymentAccountError
    if (!paymentAccount?.addon_enabled) {
      return jsonResponse({ error: 'The payments add-on is not enabled' }, 403)
    }

    const stripe = new Stripe(stripeKey)
    const { action, returnOrigin } = await req.json()

    if (action === 'status') {
      if (!paymentAccount.stripe_account_id) {
        return jsonResponse({
          connected: false,
          chargesEnabled: false,
          payoutsEnabled: false,
          livemode: isLiveKey,
        })
      }
      const account = await stripe.v2.core.accounts.retrieve(
        paymentAccount.stripe_account_id,
        { include: [...ACCOUNT_INCLUDE] },
      )
      const flags = capabilityFlags(account)
      const { error: updateError } = await admin
        .from('stable_payment_accounts')
        .update(flags)
        .eq('stable_id', stableId)
      if (updateError) throw updateError
      return jsonResponse({
        connected: true,
        chargesEnabled: flags.charges_enabled,
        payoutsEnabled: flags.payouts_enabled,
        livemode: isLiveKey,
      })
    }

    if (action === 'start') {
      let accountId: string | null = paymentAccount.stripe_account_id
      if (!accountId) {
        const { data: stable, error: stableError } = await admin
          .from('stables')
          .select('name, email')
          .eq('id', stableId)
          .single()
        if (stableError) throw stableError

        // The key makes a double click reuse one account instead of creating two.
        const account = await stripe.v2.core.accounts.create(
          {
            display_name: stable.name,
            ...(stable.email ? { contact_email: stable.email } : {}),
            dashboard: 'full',
            identity: { country: 'no' },
            configuration: {
              merchant: {
                capabilities: { card_payments: { requested: true } },
              },
            },
            defaults: {
              currency: 'nok',
              responsibilities: {
                fees_collector: 'stripe',
                losses_collector: 'stripe',
              },
            },
            metadata: { stable_id: stableId },
          },
          { idempotencyKey: `stalldrift-connect-account-${stableId}` },
        )
        accountId = account.id

        const { error: saveError } = await admin
          .from('stable_payment_accounts')
          .update({ stripe_account_id: accountId })
          .eq('stable_id', stableId)
        if (saveError) throw saveError
      }

      const origin = ALLOWED_RETURN_ORIGINS.includes(returnOrigin)
        ? returnOrigin
        : PRODUCTION_ORIGIN
      const settingsUrl = `${origin}/settings?section=payments`
      const link = await stripe.v2.core.accountLinks.create({
        account: accountId,
        use_case: {
          type: 'account_onboarding',
          account_onboarding: {
            return_url: settingsUrl,
            refresh_url: settingsUrl,
          },
        },
      })
      return jsonResponse({ url: link.url })
    }

    return jsonResponse({ error: 'Unknown action' }, 400)
  } catch (error) {
    console.error('stripe-connect failed:', error)
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Unexpected error' },
      500,
    )
  }
})
