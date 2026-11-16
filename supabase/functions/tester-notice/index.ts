// Emails the owners of test accounts that have an end date (stable_billing.tester_until)
// that the test period ends and a trial follows. Run by hand from SQL through pg_net,
// like the cron jobs; never by the client.
//
// Body { mode }:
//   'preview' lists who would get it, without sending anything.
//   'test'    sends the first one to INVOICE_EMAIL_TEST_TO only.
//   'send'    sends to every owner not yet emailed, and stamps tester_notice_sent_at
//             so nobody gets it twice.
//
// Auth is the shared X-Invoice-Email-Secret header, so this function is deployed with
// --no-verify-jwt.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPPORT_EMAIL = 'support@nestundigital.no'
const GRACE_DAYS = 14

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const osloDate = (date: Date) =>
  date.toLocaleDateString('nb-NO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Oslo',
  })

// tester_until is midnight in Norway; the trial ends at midnight a calendar month
// later, the same as end_tester_accounts() works it out in the database.
function addMonthOslo(date: Date): Date {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Oslo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  )
  const year = Number(parts.year)
  const month = Number(parts.month) - 1
  const day = Number(parts.day)
  const offset = Date.UTC(year, month, day) - date.getTime()
  return new Date(Date.UTC(year, month + 1, day) - offset)
}

type Recipient = {
  stableId: string
  stableName: string
  firstName: string | null
  email: string
  testerUntil: Date
}

function message(recipient: Recipient) {
  const trialEnd = addMonthOslo(recipient.testerUntil)
  const readOnlyFrom = new Date(trialEnd.getTime() + GRACE_DAYS * 86400000)
  const lastTrialDay = new Date(trialEnd.getTime() - 86400000)
  const greeting = recipient.firstName ? `Hei ${recipient.firstName},` : 'Hei,'
  const startDay = recipient.testerUntil.toLocaleDateString('nb-NO', {
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Oslo',
  })
  const subject = `StallOrg: prøveperioden starter ${startDay}`
  const text = `${greeting}

Takk for at du har vært med og testet StallOrg! Tilbakemeldingene fra dere testere har gjort programmet mye bedre.

Nå er StallOrg klart for vanlig drift. Fra ${osloDate(recipient.testerUntil)} går testkontoen til ${recipient.stableName} over til en gratis prøveperiode som varer til og med ${osloDate(lastTrialDay)}. Alt fungerer som før, og alt dere har lagt inn, blir liggende.

Vil du fortsette å bruke StallOrg, velger du abonnement innen ${osloDate(trialEnd)}. Det gjør du under Innstillinger → Abonnement på https://www.stallorg.no. Prisen følger antall hester, fra 374 kr i måneden inkludert mva. Betaler du for et helt år, får du én måned gratis. Velger du abonnement før prøveperioden er over, trekkes ingenting før den er slutt.

Velger du ikke abonnement, blir stallen skrivebeskyttet fra ${osloDate(readOnlyFrom)}. Da kan dere fortsatt se og hente ut alt, men ikke endre noe. Ingenting slettes.

Salgsvilkårene finner du på https://www.stallorg.no/vilkar.

Har du spørsmål, er det bare å svare på denne e-posten.

Hilsen
Gro Anita
StallOrg – Nestun Digital
`
  return { subject, text }
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
    console.error('tester-notice email failed:', await response.text())
  return response.ok
}

Deno.serve(async (req) => {
  try {
    const secret = Deno.env.get('INVOICE_EMAIL_TRIGGER_SECRET')
    if (!secret || req.headers.get('X-Invoice-Email-Secret') !== secret) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }
    const { mode } = await req.json()
    if (!['preview', 'test', 'send'].includes(mode)) {
      return jsonResponse({ error: 'Unknown mode' }, 400)
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const { data: rows, error } = await admin
      .from('stable_billing')
      .select(
        'stable_id, tester_until, tester_notice_sent_at, stable:stables(name, closed_at)',
      )
      .eq('status', 'tester')
      .not('tester_until', 'is', null)
    if (error) throw error

    const recipients: Recipient[] = []
    const skipped: string[] = []
    for (const row of rows ?? []) {
      const stable = row.stable as {
        name: string
        closed_at: string | null
      } | null
      if (!stable || stable.closed_at) continue
      if (mode === 'send' && row.tester_notice_sent_at) continue
      const { data: owners, error: ownerError } = await admin
        .from('profiles')
        .select('full_name, email')
        .eq('stable_id', row.stable_id)
        .eq('role', 'stable_owner')
      if (ownerError) throw ownerError
      const owner = owners?.find((item) => item.email)
      if (!owner?.email) {
        skipped.push(stable.name)
        continue
      }
      recipients.push({
        stableId: row.stable_id,
        stableName: stable.name.trim(),
        firstName: owner.full_name?.trim().split(/\s+/)[0] ?? null,
        email: owner.email,
        testerUntil: new Date(row.tester_until),
      })
    }

    if (mode === 'preview') {
      return jsonResponse({
        count: recipients.length,
        recipients: recipients.map((item) => ({
          stable: item.stableName,
          firstName: item.firstName,
          email: item.email,
        })),
        skipped,
        sample: recipients[0] ? message(recipients[0]) : null,
      })
    }

    const resendKey = Deno.env.get('RESEND_API_KEY')
    const from = Deno.env.get('INVOICE_EMAIL_FROM')
    if (!resendKey || !from) {
      return jsonResponse({ error: 'Email is not configured' }, 503)
    }

    if (mode === 'test') {
      const testTo = Deno.env.get('INVOICE_EMAIL_TEST_TO')
      if (!testTo || !recipients[0]) {
        return jsonResponse({ error: 'Nothing to test' }, 409)
      }
      const { subject, text } = message(recipients[0])
      const ok = await send(resendKey, from, testTo, `[TEST] ${subject}`, text)
      return jsonResponse({
        sent: ok ? 1 : 0,
        stable: recipients[0].stableName,
      })
    }

    let sent = 0
    const failed: string[] = []
    for (const recipient of recipients) {
      const { subject, text } = message(recipient)
      if (await send(resendKey, from, recipient.email, subject, text)) {
        sent++
        const { error: stampError } = await admin
          .from('stable_billing')
          .update({ tester_notice_sent_at: new Date().toISOString() })
          .eq('stable_id', recipient.stableId)
        if (stampError) throw stampError
      } else {
        failed.push(recipient.stableName)
      }
      // Stays under Resend's default limit of 2 requests per second.
      await new Promise((resolve) => setTimeout(resolve, 600))
    }
    return jsonResponse({ sent, failed, skipped })
  } catch (error) {
    console.error('tester-notice failed:', error)
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Unexpected error' },
      500,
    )
  }
})
