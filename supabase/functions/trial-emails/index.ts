// Emails stable owners about their free trial: a welcome when the stable is
// created, and a reminder 7 days before the trial ends. Both say where to
// subscribe, which the iPhone and Android apps aren't allowed to. Run hourly
// by the cron job trial-emails through pg_net; never by the client.
//
// Body { mode }:
//   'preview' lists what would be sent, without sending anything.
//   'test'    sends one welcome and one reminder, built from a real stable if
//             one is waiting and from a made-up one if not, to
//             INVOICE_EMAIL_TEST_TO, or to our support address when { to }
//             asks for it.
//   'send'    sends what's due and stamps stable_billing, so nothing goes twice.
//
// Auth is the shared X-Invoice-Email-Secret header, so this function is deployed
// with --no-verify-jwt.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPPORT_EMAIL = 'support@nestundigital.no'
const GRACE_DAYS = 14
const REMINDER_DAYS = 7
const DAY = 86400000

type Kind = 'welcome' | 'reminder'
type Language = 'no' | 'en'

type Due = {
  kind: Kind
  stableId: string
  stableName: string
  firstName: string | null
  email: string
  language: Language
  trialEndsAt: Date
  founderOfferUntil: Date | null
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const osloDate = (date: Date, language: Language) =>
  date.toLocaleDateString(language === 'en' ? 'en-GB' : 'nb-NO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Oslo',
  })

const kroner = (amount: number, language: Language) =>
  language === 'en'
    ? `NOK ${amount.toLocaleString('en-GB')}`
    : `${amount.toLocaleString('nb-NO')} kr`

function message(due: Due, lowestPrice: number) {
  const lang = due.language
  // A trial ending at midnight ends after the day before; one ending in the
  // afternoon ends after that same day. A second back gives both right.
  const lastDay = osloDate(new Date(due.trialEndsAt.getTime() - 1000), lang)
  const readOnly = osloDate(
    new Date(due.trialEndsAt.getTime() + GRACE_DAYS * DAY),
    lang,
  )
  const founderDeadline =
    due.founderOfferUntil && due.founderOfferUntil.getTime() > Date.now()
      ? osloDate(new Date(due.founderOfferUntil.getTime() - 1000), lang)
      : null
  const price = kroner(lowestPrice, lang)
  const name = due.stableName

  if (lang === 'en') {
    const greeting = due.firstName ? `Hi ${due.firstName},` : 'Hi,'
    const howTo = `To keep using StallOrg after the trial, choose a subscription at https://www.stallorg.no under Settings → Subscription. Subscriptions can only be chosen on the website, not in the app. Log in there with the same account you use in the app: the same email and password, or the same Apple or Google button if that's how you signed up. The price follows the number of horses, from ${price} a month including VAT, and paying for a whole year gives you one month free. If you subscribe before the trial ends, nothing is charged until it's over.`
    const founder = founderDeadline
      ? `\n\nAs one of our first stables, you keep the founder price for 12 months if you subscribe by ${founderDeadline}.`
      : ''
    const after = `If you don't subscribe, you still have full access for ${GRACE_DAYS} more days. From ${readOnly} the stable becomes read-only: you can still see and export everything, but not change anything. Nothing is deleted.`
    const signoff = `The terms of sale are at https://www.stallorg.no/vilkar. If you have any questions, just reply to this email.

Best regards
Gro Anita
StallOrg – Nestun Digital
`
    if (due.kind === 'welcome') {
      return {
        subject: 'Welcome to StallOrg – your free trial has started',
        text: `${greeting}

Thank you for creating ${name} in StallOrg! Your free trial runs until and including ${lastDay}. No card is needed, and nothing is charged automatically.

A good way to start:
• Add your stalls and paddocks, then your horses and their owners
• Invite the horse owners, so they can see their horse, feeding shifts and invoices
• Set up the feeding rota and publish it

${howTo}${founder}

${after}

${signoff}`,
      }
    }
    return {
      subject: `The trial for ${name} ends on ${lastDay}`,
      text: `${greeting}

The free trial for ${name} in StallOrg ends in ${REMINDER_DAYS} days, after ${lastDay}.

${howTo}${founder}

${after}

${signoff}`,
    }
  }

  const greeting = due.firstName ? `Hei ${due.firstName},` : 'Hei,'
  const howTo = `Vil du fortsette å bruke StallOrg etter prøveperioden, velger du abonnement på https://www.stallorg.no under Innstillinger → Abonnement. Abonnement kan bare velges på nettsiden, ikke i appen. Der logger du inn med den samme kontoen som i appen: samme e-post og passord, eller samme Apple- eller Google-knapp hvis det var slik du registrerte deg. Prisen følger antall hester, fra ${price} i måneden inkludert mva, og betaler du for et helt år, får du én måned gratis. Velger du abonnement før prøveperioden er over, trekkes ingenting før den er slutt.`
  const founder = founderDeadline
    ? `\n\nSom en av de første stallene får dere beholde grunnleggerprisen i 12 måneder hvis dere velger abonnement innen ${founderDeadline}.`
    : ''
  const after = `Velger du ikke abonnement, har du full tilgang i ${GRACE_DAYS} dager til. Fra ${readOnly} blir stallen skrivebeskyttet: dere kan fortsatt se og hente ut alt, men ikke endre noe. Ingenting slettes.`
  const signoff = `Salgsvilkårene finner du på https://www.stallorg.no/vilkar. Har du spørsmål, er det bare å svare på denne e-posten.

Hilsen
Gro Anita
StallOrg – Nestun Digital
`
  if (due.kind === 'welcome') {
    return {
      subject: 'Velkommen til StallOrg – prøveperioden har startet',
      text: `${greeting}

Takk for at du har opprettet ${name} i StallOrg! Den gratis prøveperioden varer til og med ${lastDay}. Du trenger ikke kort, og ingenting trekkes automatisk.

Slik kommer du godt i gang:
• Legg inn bokser og paddocker, så hestene og eierne deres
• Inviter hesteeierne, så de ser hesten sin, fôringsvaktene og fakturaene
• Sett opp fôringsturnusen og publiser den

${howTo}${founder}

${after}

${signoff}`,
    }
  }
  return {
    subject: `Prøveperioden for ${name} slutter ${lastDay}`,
    text: `${greeting}

Den gratis prøveperioden for ${name} i StallOrg slutter om ${REMINDER_DAYS} dager, etter ${lastDay}.

${howTo}${founder}

${after}

${signoff}`,
  }
}

async function send(
  resendKey: string,
  from: string,
  to: string,
  subject: string,
  text: string,
): Promise<boolean> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `"StallOrg" <${from}>`,
      to: [to],
      reply_to: SUPPORT_EMAIL,
      subject,
      text,
    }),
  })
  if (!response.ok)
    console.error('trial-emails send failed:', await response.text())
  return response.ok
}

Deno.serve(async (req) => {
  try {
    const secret = Deno.env.get('INVOICE_EMAIL_TRIGGER_SECRET')
    if (!secret || req.headers.get('X-Invoice-Email-Secret') !== secret) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }
    const { mode, to } = await req.json()
    if (!['preview', 'test', 'send'].includes(mode)) {
      return jsonResponse({ error: 'Unknown mode' }, 400)
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: plans, error: planError } = await admin
      .from('subscription_plans')
      .select('price_nok')
      .eq('visible', true)
      .eq('includes_payments', false)
      .order('price_nok')
      .limit(1)
    if (planError) throw planError
    const lowestPrice = Number(plans?.[0]?.price_nok ?? 690)

    // A subscribed stable is 'active', so 'trial' means nothing is chosen yet.
    const { data: rows, error } = await admin
      .from('stable_billing')
      .select(
        'stable_id, trial_ends_at, founder_offer_until, welcome_email_sent_at, trial_reminder_sent_at, stable:stables(name, closed_at)',
      )
      .eq('status', 'trial')
      .not('trial_ends_at', 'is', null)
    if (error) throw error

    const now = Date.now()
    const due: Due[] = []
    for (const row of rows ?? []) {
      // One stable per billing row; the generated type guesses a list.
      const stable = row.stable as unknown as {
        name: string
        closed_at: string | null
      } | null
      if (!stable || stable.closed_at) continue
      const trialEndsAt = new Date(row.trial_ends_at)
      if (trialEndsAt.getTime() <= now) continue

      const kinds: Kind[] = []
      // Too close to the end, the reminder says it all, so only it goes.
      const reminderDue =
        !row.trial_reminder_sent_at &&
        trialEndsAt.getTime() - now <= REMINDER_DAYS * DAY
      if (
        !row.welcome_email_sent_at &&
        !row.trial_reminder_sent_at &&
        !reminderDue
      )
        kinds.push('welcome')
      if (reminderDue) kinds.push('reminder')
      if (kinds.length === 0) continue

      const { data: owners, error: ownerError } = await admin
        .from('profiles')
        .select('full_name, email, language')
        .eq('stable_id', row.stable_id)
        .eq('role', 'stable_owner')
      if (ownerError) throw ownerError
      // Right after sign-up the owner's profile may not point at the stable
      // yet; the next hourly run picks it up.
      const owner = owners?.find((item) => item.email)
      if (!owner?.email) continue

      // A profile named after the farm, or a test name, gets a plain greeting.
      const first = owner.full_name?.trim().split(/\s+/)[0] ?? null
      const firstName =
        first &&
        first.toLowerCase() !== 'test' &&
        !stable.name.toLowerCase().includes(first.toLowerCase())
          ? first
          : null
      for (const kind of kinds) {
        due.push({
          kind,
          stableId: row.stable_id,
          stableName: stable.name.trim(),
          firstName,
          email: owner.email,
          language: owner.language === 'en' ? 'en' : 'no',
          trialEndsAt,
          founderOfferUntil: row.founder_offer_until
            ? new Date(row.founder_offer_until)
            : null,
        })
      }
    }

    if (mode === 'preview') {
      return jsonResponse({
        count: due.length,
        due: due.map((item) => ({
          kind: item.kind,
          stable: item.stableName,
          email: item.email,
          language: item.language,
        })),
        samples: due.slice(0, 2).map((item) => message(item, lowestPrice)),
      })
    }

    const resendKey = Deno.env.get('RESEND_API_KEY')
    const from = Deno.env.get('INVOICE_EMAIL_FROM')
    if (!resendKey || !from) {
      return jsonResponse({ error: 'Email is not configured' }, 503)
    }

    if (mode === 'test') {
      // Our own support address may be asked for instead of the test address.
      const testTo =
        to === 'support@nestundigital.no'
          ? to
          : Deno.env.get('INVOICE_EMAIL_TEST_TO')
      if (!testTo) return jsonResponse({ error: 'No test address' }, 409)
      const example: Due = {
        kind: 'welcome',
        stableId: '',
        stableName: 'Eksempelstallen',
        firstName: 'Kari',
        email: testTo,
        language: 'no',
        trialEndsAt: new Date(now + 30 * DAY),
        founderOfferUntil: null,
      }
      const welcome = due.find((item) => item.kind === 'welcome') ?? example
      const reminder = due.find((item) => item.kind === 'reminder') ?? {
        ...example,
        kind: 'reminder' as const,
        trialEndsAt: new Date(now + REMINDER_DAYS * DAY),
      }
      let sent = 0
      for (const item of [welcome, reminder]) {
        const { subject, text } = message(item, lowestPrice)
        if (await send(resendKey, from, testTo, `[TEST] ${subject}`, text))
          sent++
        await new Promise((resolve) => setTimeout(resolve, 600))
      }
      return jsonResponse({ sent })
    }

    let sent = 0
    const failed: string[] = []
    for (const item of due) {
      const { subject, text } = message(item, lowestPrice)
      if (await send(resendKey, from, item.email, subject, text)) {
        sent++
        const stamp = new Date().toISOString()
        const { error: stampError } = await admin
          .from('stable_billing')
          .update(
            item.kind === 'welcome'
              ? { welcome_email_sent_at: stamp }
              : { trial_reminder_sent_at: stamp },
          )
          .eq('stable_id', item.stableId)
        if (stampError) throw stampError
      } else {
        failed.push(`${item.kind}: ${item.stableName}`)
      }
      // Stays under Resend's default limit of 2 requests per second.
      await new Promise((resolve) => setTimeout(resolve, 600))
    }
    return jsonResponse({ sent, failed })
  } catch (error) {
    console.error('trial-emails failed:', error)
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Unexpected error' },
      500,
    )
  }
})
