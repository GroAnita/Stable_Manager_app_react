// Emails a credit note to the boarder. The credit note itself is created by the
// create_credit_note database function, so a failed email never undoes it, and
// staff can send it again.
//
// Auth model: the caller's JWT identifies them, and they must be staff at the
// credit note's stable.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmail } from '../_shared/sendEmail.ts'
import { buildCreditNoteEmail } from './creditNoteEmail.ts'

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

    const { creditNoteId } = await req.json()
    if (typeof creditNoteId !== 'string') {
      return jsonResponse({ error: 'Missing credit note' }, 400)
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
    if (
      !['stable_owner', 'stable_employee'].includes(profile.role) ||
      !profile.stable_id
    ) {
      return jsonResponse({ error: 'Only stable staff can do this' }, 403)
    }

    const { data: noteRow, error: noteError } = await admin
      .from('credit_notes')
      .select(
        `id, stable_id, credit_note_number, issued_on, reason, amount_net, vat_amount, amount_gross,
         lines:credit_note_lines(description, vat_rate, vat_amount, amount_gross, position),
         payment:payments(invoice_number, amount, status, credited_amount, credited_after_payment, refunded_amount,
           owner:owners(full_name, email)),
         stable:stables(name, org_number, vat_registered, email, phone)`,
      )
      .eq('id', creditNoteId)
      .maybeSingle()
    if (noteError) throw noteError
    // deno-lint-ignore no-explicit-any
    const note = noteRow as any
    if (!note || note.stable_id !== profile.stable_id) {
      return jsonResponse({ error: 'Credit note not found' }, 404)
    }

    const payment = note.payment
    const email = buildCreditNoteEmail({
      creditNoteNumber: note.credit_note_number,
      issuedOn: note.issued_on,
      invoiceNumber: payment?.invoice_number ?? null,
      reason: note.reason,
      // deno-lint-ignore no-explicit-any
      lines: [...(note.lines ?? [])].sort(
        (a: any, b: any) => a.position - b.position,
      ),
      amountNet: Number(note.amount_net),
      vatAmount: Number(note.vat_amount),
      amountGross: Number(note.amount_gross),
      stillToPay:
        payment?.status === 'paid'
          ? 0
          : Math.max(
              Number(payment?.amount ?? 0) -
                Number(payment?.credited_amount ?? 0),
              0,
            ),
      toRefund: Math.max(
        Number(payment?.credited_after_payment ?? 0) -
          Number(payment?.refunded_amount ?? 0),
        0,
      ),
      ownerName: payment?.owner?.full_name ?? null,
      stableName: note.stable?.name ?? 'Stallen',
      stableOrgNumber: note.stable?.org_number ?? null,
      stableVatRegistered: Boolean(note.stable?.vat_registered),
      stableEmail: note.stable?.email ?? null,
      stablePhone: note.stable?.phone ?? null,
    })

    const allowReal = Deno.env.get('INVOICE_EMAIL_ALLOW_REAL') === 'true'
    const to: string | null = allowReal
      ? (payment?.owner?.email ?? null)
      : (Deno.env.get('INVOICE_EMAIL_TEST_TO') ?? null)
    const sent = await sendEmail({
      to: payment?.owner?.email ?? null,
      stableName: note.stable?.name ?? '',
      replyTo: note.stable?.email ?? null,
      subject: email.subject,
      text: email.text,
    })
    if (!sent) return jsonResponse({ sent: false })

    const { error: saveError } = await admin
      .from('credit_notes')
      .update({ email_sent_at: new Date().toISOString(), email_sent_to: to })
      .eq('id', creditNoteId)
    if (saveError) throw saveError
    return jsonResponse({ sent: true })
  } catch (error) {
    console.error('credit-note failed:', error)
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Unexpected error' },
      500,
    )
  }
})
