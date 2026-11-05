// Lets a boarder accept the agreement on automatic card charges, save a card on
// Stripe's hosted page, and withdraw again. The card is saved on the stable's own
// Stripe account, and no charge is taken here.
//
// Auth model: the caller's JWT identifies them, and the contract must belong to
// the owner record linked to that user. The wording is always rebuilt here, so
// what gets stored is what the server showed, not what a client sends back.
//
// Uses the same guards as the other payment functions: a live Stripe key is
// refused unless STRIPE_CONNECT_ALLOW_LIVE is 'true', and email goes only to
// INVOICE_EMAIL_TEST_TO unless INVOICE_EMAIL_ALLOW_REAL is 'true'.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'npm:stripe@23.1.0'
import { sendEmail } from '../_shared/sendEmail.ts'
import { agreementAsText, buildAgreement } from './agreementText.ts'

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

    const { action, contractId, version, accepted, returnOrigin } =
      await req.json()
    if (typeof contractId !== 'string') {
      return jsonResponse({ error: 'Missing contract' }, 400)
    }

    const admin = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: contract, error: contractError } = await admin
      .from('contracts')
      .select(
        `id, stable_id, owner_id, status, start_date, charge_day,
         owner:owners(id, user_id, full_name, email),
         horse:horses(name),
         stable:stables(name, org_number, email, phone)`,
      )
      .eq('id', contractId)
      .maybeSingle()
    if (contractError) throw contractError
    // deno-lint-ignore no-explicit-any
    const row = contract as any
    if (!row || row.owner?.user_id !== caller.id) {
      return jsonResponse({ error: 'Contract not found' }, 404)
    }

    const { data: paymentAccount, error: paymentAccountError } = await admin
      .from('stable_payment_accounts')
      .select(
        'addon_enabled, card_signing_enabled, charges_enabled, stripe_account_id, charge_day',
      )
      .eq('stable_id', row.stable_id)
      .maybeSingle()
    if (paymentAccountError) throw paymentAccountError

    const { data: openAgreement, error: agreementError } = await admin
      .from('card_agreements')
      .select('*')
      .eq('contract_id', contractId)
      .is('withdrawn_at', null)
      .maybeSingle()
    if (agreementError) throw agreementError
    let agreementRow = openAgreement

    const available = Boolean(
      paymentAccount?.addon_enabled &&
      paymentAccount.card_signing_enabled &&
      paymentAccount.charges_enabled &&
      paymentAccount.stripe_account_id,
    )
    // A boarder must always be able to withdraw, even if signing was switched off.
    if (!available && !agreementRow?.activated_at) {
      return jsonResponse({ available: false })
    }

    const stripe = new Stripe(stripeKey)
    const stripeAccount: string | undefined =
      paymentAccount?.stripe_account_id ?? undefined
    const stableName: string = row.stable?.name ?? 'Stallen'
    const stableEmail: string | null = row.stable?.email ?? null
    const ownerEmail: string | null = row.owner?.email ?? null

    if (action === 'withdraw') {
      if (!agreementRow?.activated_at) {
        return jsonResponse({ error: 'No active agreement' }, 409)
      }
      // Recorded before Stripe is called: withdrawing has to stick even if
      // Stripe can't be reached.
      const withdrawnAt = new Date().toISOString()
      const { error: withdrawError } = await admin
        .from('card_agreements')
        .update({ withdrawn_at: withdrawnAt, withdrawn_by: caller.id })
        .eq('id', agreementRow.id)
      if (withdrawError) throw withdrawError
      const { error: contractUpdateError } = await admin
        .from('contracts')
        .update({ card_agreement_accepted_at: null })
        .eq('id', contractId)
      if (contractUpdateError) throw contractUpdateError

      if (agreementRow.stripe_payment_method_id && stripeAccount) {
        try {
          await stripe.paymentMethods.detach(
            agreementRow.stripe_payment_method_id,
            {},
            { stripeAccount },
          )
        } catch (error) {
          console.error('card-agreement detach failed:', error)
        }
      }
      await sendEmail({
        to: ownerEmail,
        stableName,
        replyTo: stableEmail,
        subject: `Automatisk betaling til ${stableName} er avsluttet`,
        text: `Tillatelsen til automatiske korttrekk for ${row.horse?.name ?? 'hesten din'} er avsluttet, og kortet ditt blir ikke trukket automatisk fremover.\n\nEt trekk som allerede er gjennomført, blir ikke automatisk tilbakeført. Ubetalte og fremtidige fakturaer må betales på annen avtalt måte.`,
      })
      return jsonResponse({ available, active: false, withdrawn: true })
    }

    // Finish an acceptance whose card was saved on Stripe's page. Runs on every
    // status check, because the iPhone app has no redirect back to rely on.
    if (
      agreementRow &&
      !agreementRow.activated_at &&
      agreementRow.stripe_checkout_session_id &&
      stripeAccount
    ) {
      const session = await stripe.checkout.sessions.retrieve(
        agreementRow.stripe_checkout_session_id,
        { expand: ['setup_intent.payment_method'] },
        { stripeAccount },
      )
      const setupIntent = session.setup_intent as Stripe.SetupIntent | null
      const paymentMethod = setupIntent?.payment_method as
        Stripe.PaymentMethod | null | undefined
      if (session.status === 'complete' && paymentMethod) {
        const activatedAt = new Date().toISOString()
        const { data: activated, error: activateError } = await admin
          .from('card_agreements')
          .update({
            stripe_payment_method_id: paymentMethod.id,
            card_brand: paymentMethod.card?.brand ?? null,
            card_last4: paymentMethod.card?.last4 ?? null,
            activated_at: activatedAt,
          })
          .eq('id', agreementRow.id)
          .is('activated_at', null)
          .select('*')
          .maybeSingle()
        if (activateError) throw activateError

        // Only the request that activated it sends the copy.
        if (activated) {
          agreementRow = activated
          // The agreed date stays with the contract if the stable's default moves.
          const { error: contractUpdateError } = await admin
            .from('contracts')
            .update({
              charge_day: activated.charge_day,
              card_agreement_accepted_at: activated.accepted_at,
            })
            .eq('id', contractId)
          if (contractUpdateError) throw contractUpdateError

          const copySent = await sendEmail({
            to: ownerEmail,
            stableName,
            replyTo: stableEmail,
            subject: `Din avtale om automatiske korttrekk med ${stableName}`,
            text: `Her er din kopi av avtalen.\n\nGodtatt av ${activated.accepted_by_name}, ${activated.accepted_at.slice(0, 10)}.\n\n${activated.agreement_text}`,
          })
          if (copySent) {
            await admin
              .from('card_agreements')
              .update({ copy_sent_at: new Date().toISOString() })
              .eq('id', activated.id)
          }
        } else {
          const { data: current } = await admin
            .from('card_agreements')
            .select('*')
            .eq('id', agreementRow.id)
            .maybeSingle()
          agreementRow = current ?? agreementRow
        }
      }
    }

    if (agreementRow?.activated_at) {
      return jsonResponse({
        available,
        active: true,
        chargeDay: agreementRow.charge_day,
        acceptedAt: agreementRow.accepted_at,
        cardBrand: agreementRow.card_brand,
        cardLast4: agreementRow.card_last4,
        agreementText: agreementRow.agreement_text,
        pausedAt: agreementRow.paused_at,
      })
    }

    const chargeDay: number = row.charge_day ?? paymentAccount?.charge_day ?? 25
    const agreement = buildAgreement({
      stableName,
      stableOrgNumber: row.stable?.org_number ?? null,
      stableEmail,
      stablePhone: row.stable?.phone ?? null,
      ownerName: row.owner?.full_name ?? '',
      horseName: row.horse?.name ?? '',
      contractStartDate: row.start_date,
      chargeDay,
    })
    // Invoices are the notice this agreement promises, so an address is required.
    const missingEmail = !ownerEmail

    if (action === 'status') {
      return jsonResponse({
        available,
        active: false,
        missingEmail,
        chargeDay,
        agreement,
      })
    }

    if (action === 'accept') {
      if (!available) {
        return jsonResponse({ error: 'Signing is not available' }, 409)
      }
      if (row.status !== 'active') {
        return jsonResponse({ error: 'The contract is not active' }, 409)
      }
      if (missingEmail) {
        return jsonResponse({ error: 'An email address is required' }, 409)
      }
      if (accepted !== true) {
        return jsonResponse({ error: 'The agreement must be accepted' }, 400)
      }
      if (version !== agreement.version) {
        return jsonResponse(
          { error: 'The agreement has changed. Please read it again.' },
          409,
        )
      }

      // An earlier attempt where the card was never saved doesn't count.
      if (agreementRow) {
        const { error: clearError } = await admin
          .from('card_agreements')
          .delete()
          .eq('id', agreementRow.id)
          .is('activated_at', null)
        if (clearError) throw clearError
      }

      const { data: earlier, error: earlierError } = await admin
        .from('card_agreements')
        .select('stripe_customer_id')
        .eq('owner_id', row.owner_id)
        .not('stripe_customer_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (earlierError) throw earlierError

      let customerId: string | null = earlier?.stripe_customer_id ?? null
      if (!customerId) {
        const customer = await stripe.customers.create(
          {
            name: row.owner?.full_name ?? undefined,
            email: ownerEmail ?? undefined,
            metadata: { owner_id: row.owner_id, stable_id: row.stable_id },
          },
          {
            stripeAccount,
            idempotencyKey: `stalldrift-customer-${row.owner_id}`,
          },
        )
        customerId = customer.id
      }

      const { data: created, error: createError } = await admin
        .from('card_agreements')
        .insert({
          stable_id: row.stable_id,
          contract_id: contractId,
          owner_id: row.owner_id,
          accepted_by: caller.id,
          accepted_by_name: row.owner?.full_name ?? '',
          version: agreement.version,
          agreement_text: agreementAsText(agreement),
          charge_day: chargeDay,
          stripe_customer_id: customerId,
        })
        .select('id')
        .single()
      if (createError) throw createError

      const origin = ALLOWED_RETURN_ORIGINS.includes(returnOrigin)
        ? returnOrigin
        : PRODUCTION_ORIGIN
      const returnUrl = `${origin}/my-contract`
      const session = await stripe.checkout.sessions.create(
        {
          mode: 'setup',
          currency: 'nok',
          customer: customerId,
          allowed_payment_method_types: ['card'],
          locale: 'nb',
          success_url: returnUrl,
          cancel_url: returnUrl,
          metadata: { card_agreement_id: created.id, contract_id: contractId },
          setup_intent_data: {
            metadata: {
              card_agreement_id: created.id,
              contract_id: contractId,
            },
          },
          custom_text: {
            submit: {
              message: `Kortet lagres for automatiske månedlige trekk til ${stableName} den ${chargeDay}. hver måned, etter avtalen du nettopp godtok.`,
            },
          },
        },
        { stripeAccount },
      )

      const { error: sessionSaveError } = await admin
        .from('card_agreements')
        .update({ stripe_checkout_session_id: session.id })
        .eq('id', created.id)
      if (sessionSaveError) throw sessionSaveError

      return jsonResponse({ url: session.url })
    }

    return jsonResponse({ error: 'Unknown action' }, 400)
  } catch (error) {
    console.error('card-agreement failed:', error)
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Unexpected error' },
      500,
    )
  }
})
