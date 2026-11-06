// Runs daily. Ends card agreements on contracts that are over and have nothing left
// to pay, and retries removing saved cards that Stripe couldn't remove earlier. Auth
// is a shared secret header, not a user JWT, so this function is deployed with
// --no-verify-jwt.
//
// Refuses a live key unless STRIPE_CONNECT_ALLOW_LIVE is 'true'.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'npm:stripe@23.1.0'
import { endCardAgreement, removeSavedCard } from '../_shared/endAgreement.ts'
import { sendEmail } from '../_shared/sendEmail.ts'
import { syncSubscriptionPlan } from '../_shared/subscription.ts'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  const expectedSecret = Deno.env.get('INVOICE_EMAIL_TRIGGER_SECRET')
  if (
    !expectedSecret ||
    req.headers.get('X-Invoice-Email-Secret') !== expectedSecret
  ) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }
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

  const stripe = new Stripe(stripeKey)
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const accounts = new Map<string, string | undefined>()
  async function accountFor(stableId: string) {
    if (!accounts.has(stableId)) {
      const { data } = await admin
        .from('stable_payment_accounts')
        .select('stripe_account_id')
        .eq('stable_id', stableId)
        .maybeSingle()
      accounts.set(stableId, data?.stripe_account_id ?? undefined)
    }
    return accounts.get(stableId)
  }

  let ended = 0
  let removed = 0
  let failed = 0

  const { data: open, error: openError } = await admin
    .from('card_agreements')
    .select(
      `id, stable_id, contract_id, stripe_payment_method_id, pending_card_session_id,
       contract:contracts!inner(status, owner:owners(email), horse:horses(name)),
       stable:stables(name, email)`,
    )
    .is('withdrawn_at', null)
    .in('contract.status', ['expired', 'cancelled'])
  if (openError) return jsonResponse({ error: openError.message }, 500)

  // deno-lint-ignore no-explicit-any
  for (const agreement of (open ?? []) as any[]) {
    const { data: unpaid, error: unpaidError } = await admin
      .from('payments')
      .select('amount, credited_amount')
      .eq('contract_id', agreement.contract_id)
      .neq('status', 'paid')
    if (unpaidError) return jsonResponse({ error: unpaidError.message }, 500)
    const stillOwed = (unpaid ?? []).some(
      (payment) => Number(payment.amount) - Number(payment.credited_amount) > 0,
    )
    if (stillOwed) continue

    const stripeAccount = await accountFor(agreement.stable_id)
    await endCardAgreement(stripe, admin, agreement, stripeAccount, null)
    ended += 1
    await sendEmail({
      to: agreement.contract?.owner?.email ?? null,
      stableName: agreement.stable?.name ?? '',
      replyTo: agreement.stable?.email ?? null,
      subject: `Automatisk betaling til ${agreement.stable?.name ?? 'stallen'} er avsluttet`,
      text: `Stallplassen for ${agreement.contract?.horse?.name ?? 'hesten din'} er avsluttet, og det er ikke noe igjen å betale. Tillatelsen til automatiske korttrekk er derfor avsluttet, og kortet ditt blir ikke trukket mer.`,
    })
  }

  const { data: pending, error: pendingError } = await admin
    .from('card_agreements')
    .select('id, stable_id, stripe_payment_method_id')
    .not('withdrawn_at', 'is', null)
    .is('card_removed_at', null)
    .limit(200)
  if (pendingError) return jsonResponse({ error: pendingError.message }, 500)

  for (const agreement of pending ?? []) {
    const stripeAccount = await accountFor(agreement.stable_id)
    if (await removeSavedCard(stripe, admin, agreement, stripeAccount)) {
      removed += 1
    } else {
      failed += 1
    }
  }

  // Stables moving to a plan without card payments today. Anything that fails is
  // shown to the stable owner and tried again the next night.
  const today = new Date().toLocaleDateString('sv-SE', {
    timeZone: 'Europe/Oslo',
  })
  const { data: switching, error: switchingError } = await admin
    .from('stable_payment_accounts')
    .select(
      'stable_id, stripe_account_id, scheduled_plan_on, stable:stables(name, email)',
    )
    .in('plan_change_status', ['scheduled', 'failed'])
    .lte('scheduled_plan_on', today)
  if (switchingError)
    return jsonResponse({ error: switchingError.message }, 500)

  let switched = 0
  // deno-lint-ignore no-explicit-any
  for (const account of (switching ?? []) as any[]) {
    try {
      const { data: charging, error: chargingError } = await admin
        .from('payments')
        .select('id')
        .eq('stable_id', account.stable_id)
        .eq('charge_status', 'processing')
        .limit(1)
      if (chargingError) throw chargingError
      if (charging?.length) throw new Error('charge_in_progress')

      const { data: agreements, error: agreementsError } = await admin
        .from('card_agreements')
        .select(
          `id, contract_id, stripe_payment_method_id, pending_card_session_id, activated_at,
           contract:contracts(owner:owners(email), horse:horses(name))`,
        )
        .eq('stable_id', account.stable_id)
        .is('withdrawn_at', null)
      if (agreementsError) throw agreementsError

      // deno-lint-ignore no-explicit-any
      for (const agreement of (agreements ?? []) as any[]) {
        await endCardAgreement(
          stripe,
          admin,
          agreement,
          account.stripe_account_id ?? undefined,
          null,
        )
        if (agreement.activated_at) {
          await sendEmail({
            to: agreement.contract?.owner?.email ?? null,
            stableName: account.stable?.name ?? '',
            replyTo: account.stable?.email ?? null,
            subject: `Automatisk betaling til ${account.stable?.name ?? 'stallen'} er avsluttet`,
            text: `Stallen bruker ikke lenger kortbetaling gjennom Stalldrift, så automatisk betaling for ${agreement.contract?.horse?.name ?? 'hesten din'} er avsluttet, og kortet ditt blir ikke trukket mer. Stallplassen fortsetter som før. Du får en siste faktura for overgangen, og fakturaene betales nå på den måten som står på dem.`,
          })
        }
      }

      const { error: finishError } = await admin.rpc('finish_plan_change', {
        p_stable_id: account.stable_id,
      })
      if (finishError) throw finishError
      await syncSubscriptionPlan(stripe, admin, account.stable_id)
      switched += 1
    } catch (error) {
      console.error('plan change failed:', error)
      const { error: saveError } = await admin
        .from('stable_payment_accounts')
        .update({
          plan_change_status: 'failed',
          plan_change_error: (error as Error).message ?? 'plan_change_failed',
        })
        .eq('stable_id', account.stable_id)
      if (saveError)
        console.error('saving plan change failure failed:', saveError)
    }
  }

  return jsonResponse({ ended, removed, failed, switched })
})
