// Emails invoices created by generate_addon_invoices to boarders through Resend.
// Called hourly by cron (see migration
// 20261104100000_contract_charge_day_and_invoice_emails.sql), never by the
// client. Auth is a shared secret header, not a user JWT, so this function is
// deployed with --no-verify-jwt.
//
// Sends only to INVOICE_EMAIL_TEST_TO unless INVOICE_EMAIL_ALLOW_REAL is 'true',
// so testing can't email real boarders.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildInvoiceEmail } from './invoiceEmail.ts'

const BATCH_SIZE = 100
// Stays under Resend's default limit of 2 requests per second.
const DELAY_BETWEEN_SENDS_MS = 600

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// Resend rejects display names containing these characters unless quoted.
function fromHeader(stableName: string, address: string): string {
  const name = stableName.replace(/["\\<>\r\n]/g, '').trim()
  return name ? `"${name} via Stalldrift" <${address}>` : address
}

Deno.serve(async (req) => {
  const expectedSecret = Deno.env.get('INVOICE_EMAIL_TRIGGER_SECRET')
  if (
    !expectedSecret ||
    req.headers.get('X-Invoice-Email-Secret') !== expectedSecret
  ) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  const resendKey = Deno.env.get('RESEND_API_KEY')
  const fromAddress = Deno.env.get('INVOICE_EMAIL_FROM')
  const allowReal = Deno.env.get('INVOICE_EMAIL_ALLOW_REAL') === 'true'
  const testRecipient = Deno.env.get('INVOICE_EMAIL_TEST_TO')
  if (!resendKey || !fromAddress || (!allowReal && !testRecipient)) {
    return jsonResponse({ error: 'Invoice email is not configured' }, 503)
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const today = new Date().toISOString().slice(0, 10)
  const { data: payments, error } = await admin
    .from('payments')
    .select(
      `id, invoice_number, amount, due_date, notes,
       owner:owners(full_name, email),
       invoice_email_sent_to, invoice_email_delivery_status,
       contract:contracts(card_agreement_accepted_at, horse:horses(name)),
       stable:stables(name, org_number, vat_registered, email, phone),
       invoice_lines(vat_amount)`,
    )
    .eq('invoice_email_required', true)
    .or(
      'invoice_email_sent_at.is.null,invoice_email_delivery_status.in.(bounced,suppressed,failed)',
    )
    .neq('status', 'paid')
    .gte('due_date', today)
    .order('due_date')
    .limit(BATCH_SIZE)
  if (error) {
    console.error('send-invoice-emails query failed:', error)
    return jsonResponse({ error: error.message }, 500)
  }

  let sent = 0
  let failed = 0
  for (const payment of payments ?? []) {
    // deno-lint-ignore no-explicit-any
    const row = payment as any
    const recipient: string | null = allowReal
      ? (row.owner?.email ?? null)
      : (testRecipient ?? null)

    // After a failed delivery, only try again once the address has been changed.
    if (
      row.invoice_email_delivery_status &&
      row.invoice_email_sent_to === recipient
    ) {
      continue
    }

    let sendError: string | null = null
    if (!recipient) {
      sendError = 'owner_has_no_email'
    } else {
      const email = buildInvoiceEmail({
        invoiceNumber: row.invoice_number,
        amount: Number(row.amount),
        dueDate: row.due_date,
        notes: row.notes,
        ownerName: row.owner?.full_name ?? null,
        horseName: row.contract?.horse?.name ?? null,
        cardChargePlanned: Boolean(row.contract?.card_agreement_accepted_at),
        stableName: row.stable?.name ?? 'Stallen',
        stableOrgNumber: row.stable?.org_number ?? null,
        stableVatRegistered: Boolean(row.stable?.vat_registered),
        vatTotal:
          (row.invoice_lines ?? []).reduce(
            // deno-lint-ignore no-explicit-any
            (sum: number, line: any) =>
              sum + Math.round(Number(line.vat_amount) * 100),
            0,
          ) / 100,
        stableEmail: row.stable?.email ?? null,
        stablePhone: row.stable?.phone ?? null,
      })
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
            // A retry after a lost response can't send a second copy. Includes
            // the recipient because Resend rejects a reused key with new content.
            'Idempotency-Key': `invoice-${row.id}-${recipient}`,
          },
          body: JSON.stringify({
            from: fromHeader(row.stable?.name ?? '', fromAddress),
            to: [recipient],
            ...(row.stable?.email ? { reply_to: row.stable.email } : {}),
            subject: email.subject,
            html: email.html,
            text: email.text,
            // Resend's delivery reports use this to find the invoice.
            tags: [{ name: 'payment_id', value: row.id }],
          }),
        })
        if (!response.ok) {
          sendError = `Resend ${response.status}: ${(await response.text()).slice(0, 300)}`
        }
      } catch (err) {
        sendError =
          err instanceof Error ? err.message : 'Could not reach Resend'
      }
      await new Promise((resolve) =>
        setTimeout(resolve, DELAY_BETWEEN_SENDS_MS),
      )
    }

    const { error: updateError } = await admin
      .from('payments')
      .update(
        sendError
          ? { invoice_email_error: sendError }
          : {
              invoice_email_sent_at: new Date().toISOString(),
              invoice_email_sent_to: recipient,
              invoice_email_error: null,
              invoice_email_delivery_status: null,
              invoice_email_delivered_at: null,
            },
      )
      .eq('id', row.id)
    if (updateError)
      console.error('send-invoice-emails update failed:', updateError)

    if (sendError) {
      failed += 1
      console.error(`send-invoice-emails failed for ${row.id}:`, sendError)
    } else {
      sent += 1
    }
  }

  return jsonResponse({ sent, failed })
})
