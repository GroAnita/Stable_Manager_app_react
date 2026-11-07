// Deletes the caller's account, as the App Store requires and the privacy statement
// promises. Also runs nightly (action "purge") to delete stables closed 3 months ago.
//
// A member (horse owner, employee, co-rider, instructor) loses the login and profile
// at once. Anything the stable registered about them stays with the stable, because
// the stable is responsible for it and must keep its accounts. Their card agreements
// end first, so no card is charged again.
//
// A stable owner's stable closes at once: the subscription and all card agreements end,
// nobody can change anything, and the owner can't sign in. After 3 months the purge
// deletes the stable and the owner's user. Support can reopen it before then by
// clearing stables.closed_at and lifting the user's ban in Supabase.
//
// Auth: the caller's JWT, or the shared cron secret for the purge. Deployed with
// --no-verify-jwt because of the cron call; the JWT is checked here instead.
//
// Refuses a live Stripe key unless STRIPE_CONNECT_ALLOW_LIVE is 'true'.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'npm:stripe@23.1.0'
import { endCardAgreement } from '../_shared/endAgreement.ts'
import { sendEmail } from '../_shared/sendEmail.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

const CLOSED_MONTHS = 3
// About 100 years: Supabase has no permanent ban, and the user is deleted long before.
const BAN_DURATION = '876000h'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Stripe is only needed when there's a subscription or a card agreement to end.
function stripeOrThrow(): Stripe {
  const key = Deno.env.get('STRIPE_CONNECT_SECRET_KEY')
  if (!key) throw new Error('stripe_unavailable')
  if (
    /^(sk|rk)_live_/.test(key) &&
    Deno.env.get('STRIPE_CONNECT_ALLOW_LIVE') !== 'true'
  ) {
    throw new Error('stripe_unavailable')
  }
  return new Stripe(key)
}

function osloDate(date: Date): string {
  return date.toLocaleDateString('nb-NO', {
    timeZone: 'Europe/Oslo',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

// deno-lint-ignore no-explicit-any
type Admin = any

async function stripeAccountFor(admin: Admin, stableId: string) {
  const { data, error } = await admin
    .from('stable_payment_accounts')
    .select('stripe_account_id')
    .eq('stable_id', stableId)
    .maybeSingle()
  if (error) throw error
  return (data?.stripe_account_id as string | null) ?? undefined
}

// Ends every open card agreement matching the filter, and tells each horse owner.
async function endAgreements(
  admin: Admin,
  filter: { column: 'owner_id' | 'stable_id'; values: string[] },
  endedBy: string | null,
  reason: string,
) {
  if (filter.values.length === 0) return
  const { data, error } = await admin
    .from('card_agreements')
    .select(
      `id, stable_id, contract_id, stripe_payment_method_id, pending_card_session_id,
       contract:contracts(owner:owners(email)),
       stable:stables(name, email)`,
    )
    .is('withdrawn_at', null)
    .in(filter.column, filter.values)
  if (error) throw error
  if (!data || data.length === 0) return

  const stripe = stripeOrThrow()
  // deno-lint-ignore no-explicit-any
  for (const agreement of data as any[]) {
    const account = await stripeAccountFor(admin, agreement.stable_id)
    await endCardAgreement(stripe, admin, agreement, account, endedBy)
    await sendEmail({
      to: agreement.contract?.owner?.email ?? null,
      stableName: agreement.stable?.name ?? '',
      replyTo: agreement.stable?.email ?? null,
      subject: `Automatisk betaling til ${agreement.stable?.name ?? 'stallen'} er avsluttet`,
      text: `${reason} Tillatelsen til automatiske korttrekk er derfor avsluttet, og kortet ditt blir ikke trukket mer. Eventuelle ubetalte fakturaer gjelder fortsatt, og du kan kontakte stallen om dem.`,
    })
  }
}

async function deleteMember(admin: Admin, userId: string, name: string) {
  const { data: owners, error: ownersError } = await admin
    .from('owners')
    .select('id, stable:stables(name, email)')
    .eq('user_id', userId)
  if (ownersError) throw ownersError
  const { data: staff, error: staffError } = await admin
    .from('staff')
    .select('stable:stables(name, email)')
    .eq('user_id', userId)
  if (staffError) throw staffError

  // deno-lint-ignore no-explicit-any
  const ownerIds = ((owners ?? []) as any[]).map((owner) => owner.id)
  await endAgreements(
    admin,
    { column: 'owner_id', values: ownerIds },
    userId,
    'Du har slettet kontoen din i Stalldrift.',
  )
  if (ownerIds.length > 0) {
    const { error } = await admin
      .from('push_tokens')
      .delete()
      .in('owner_id', ownerIds)
    if (error) throw error
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
  if (deleteError) throw deleteError

  // Tell each stable, once, so it can decide what to keep in its own register.
  const stables = new Map<string, { name: string; email: string | null }>()
  // deno-lint-ignore no-explicit-any
  for (const row of [...(owners ?? []), ...(staff ?? [])] as any[]) {
    if (row.stable?.email) stables.set(row.stable.email, row.stable)
  }
  for (const stable of stables.values()) {
    await sendEmail({
      to: stable.email,
      stableName: stable.name,
      replyTo: null,
      subject: `${name || 'En bruker'} har slettet kontoen sin i Stalldrift`,
      text: `${name || 'En bruker'} har slettet kontoen sin og kan ikke lenger logge inn. Det stallen har registrert, som eierkort, kontrakter og fakturaer, er beholdt, fordi stallen er ansvarlig for dem og må ta vare på regnskapet. Eventuelle kortavtaler er avsluttet. Du kan selv slette eierkortet når det ikke er fakturaer knyttet til det.`,
    })
  }
}

async function closeStables(
  admin: Admin,
  // deno-lint-ignore no-explicit-any
  stables: any[],
  userId: string,
  email: string | null,
) {
  const deleteAfter = new Date()
  deleteAfter.setMonth(deleteAfter.getMonth() + CLOSED_MONTHS)

  for (const stable of stables) {
    const { data: billing, error: billingError } = await admin
      .from('stable_billing')
      .select('stripe_subscription_id')
      .eq('stable_id', stable.id)
      .maybeSingle()
    if (billingError) throw billingError
    if (billing?.stripe_subscription_id) {
      try {
        await stripeOrThrow().subscriptions.cancel(
          billing.stripe_subscription_id,
        )
      } catch (error) {
        // Already gone or cancelled in Stripe is fine; anything else stops the
        // closing, so the stable isn't closed while still being billed.
        // deno-lint-ignore no-explicit-any
        const err = error as any
        const alreadyGone =
          err?.code === 'resource_missing' ||
          /already.*cancel/i.test(String(err?.message))
        if (!alreadyGone) throw error
      }
    }

    await endAgreements(
      admin,
      { column: 'stable_id', values: [stable.id] },
      userId,
      `${stable.name} har sluttet å bruke Stalldrift.`,
    )

    const { error: closeError } = await admin
      .from('stables')
      .update({
        closed_at: new Date().toISOString(),
        delete_after: deleteAfter.toISOString(),
      })
      .eq('id', stable.id)
    if (closeError) throw closeError
  }

  const { error: banError } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: BAN_DURATION,
  })
  if (banError) throw banError

  const names = stables.map((stable) => stable.name).join(', ')
  await sendEmail({
    to: email,
    stableName: names,
    replyTo: null,
    subject: 'Kontoen din i Stalldrift er slettet',
    text: `Kontoen din er slettet, og ${names} er stengt. Abonnementet er sagt opp, alle kortavtaler er avsluttet, og ingen kan lenger logge inn i stallen.\n\nAlle opplysninger om stallen slettes for godt ${osloDate(deleteAfter)}. Ombestemmer du deg før det, kan du skrive til support@nestundigital.no, så åpner vi stallen igjen.`,
  })
  return deleteAfter
}

async function purge(admin: Admin) {
  const { data: due, error } = await admin
    .from('stables')
    .select('id, owner_user_id')
    .not('closed_at', 'is', null)
    .lte('delete_after', new Date().toISOString())
  if (error) throw error

  let deleted = 0
  for (const stable of due ?? []) {
    const { data: files } = await admin.storage
      .from('stable-logos')
      .list(stable.id)
    if (files && files.length > 0) {
      await admin.storage
        .from('stable-logos')
        // deno-lint-ignore no-explicit-any
        .remove(files.map((file: any) => `${stable.id}/${file.name}`))
    }
    const { error: deleteError } = await admin
      .from('stables')
      .delete()
      .eq('id', stable.id)
    if (deleteError) throw deleteError
    deleted += 1

    // The owner's user goes too, unless it still owns another stable.
    if (stable.owner_user_id) {
      const { count } = await admin
        .from('stables')
        .select('id', { count: 'exact', head: true })
        .eq('owner_user_id', stable.owner_user_id)
      if (!count) {
        const { error: userError } = await admin.auth.admin.deleteUser(
          stable.owner_user_id,
        )
        if (userError) console.error('deleting owner user failed:', userError)
      }
    }
  }
  return deleted
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(
    supabaseUrl,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    const body = await req.json().catch(() => ({}))

    if (body.action === 'purge') {
      const expectedSecret = Deno.env.get('INVOICE_EMAIL_TRIGGER_SECRET')
      if (
        !expectedSecret ||
        req.headers.get('X-Invoice-Email-Secret') !== expectedSecret
      ) {
        return jsonResponse({ error: 'Unauthorized' }, 401)
      }
      return jsonResponse({ deleted: await purge(admin) })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization header' }, 401)
    }
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
    if (body.confirm !== 'SLETT') {
      return jsonResponse({ error: 'confirmation_missing' }, 400)
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('full_name')
      .eq('id', caller.id)
      .maybeSingle()
    const { data: owned, error: ownedError } = await admin
      .from('stables')
      .select('id, name')
      .eq('owner_user_id', caller.id)
      .is('closed_at', null)
    if (ownedError) throw ownedError

    if (owned && owned.length > 0) {
      const deleteAfter = await closeStables(
        admin,
        owned,
        caller.id,
        caller.email ?? null,
      )
      return jsonResponse({
        result: 'stable_closed',
        deleteAfter: deleteAfter.toISOString(),
      })
    }

    await deleteMember(admin, caller.id, profile?.full_name ?? '')
    return jsonResponse({ result: 'deleted' })
  } catch (error) {
    const message = (error as Error).message
    console.error('delete-account failed:', error)
    if (message === 'stripe_unavailable') {
      return jsonResponse({ error: 'stripe_unavailable' }, 503)
    }
    return jsonResponse({ error: message }, 500)
  }
})
