// Receives Resend's reports on what happened to each invoice email. Auth is
// Resend's webhook signature rather than a user JWT, so this function is deployed
// with --no-verify-jwt. Invoices are matched by the payment_id tag that
// send-invoice-emails puts on each email.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Webhook } from 'npm:svix@1'
import {
  deliveryOutcome,
  paymentIdOf,
  type DeliveryEvent,
} from './deliveryEvent.ts'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('RESEND_WEBHOOK_SECRET')
  if (!secret) {
    return jsonResponse({ error: 'Webhook is not configured' }, 503)
  }

  // The signature covers the exact bytes sent, so read the body as raw text.
  const payload = await req.text()
  let event: DeliveryEvent
  try {
    event = new Webhook(secret).verify(payload, {
      'svix-id': req.headers.get('svix-id') ?? '',
      'svix-timestamp': req.headers.get('svix-timestamp') ?? '',
      'svix-signature': req.headers.get('svix-signature') ?? '',
    }) as DeliveryEvent
  } catch {
    return jsonResponse({ error: 'Invalid signature' }, 400)
  }

  const paymentId = paymentIdOf(event)
  if (!paymentId) return jsonResponse({ ignored: true })

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: payment, error } = await admin
    .from('payments')
    .select('invoice_email_sent_to, invoice_email_delivery_status')
    .eq('id', paymentId)
    .maybeSingle()
  if (error) {
    console.error('resend-webhook read failed:', error)
    return jsonResponse({ error: 'Could not read the invoice' }, 500)
  }
  // The invoice may have been deleted since the email went out.
  if (!payment) return jsonResponse({ ignored: true })

  const outcome = deliveryOutcome(event, payment)
  if (outcome.kind === 'ignore') return jsonResponse({ ignored: true })
  if (outcome.kind === 'retry') {
    return jsonResponse({ error: 'The send is not recorded yet' }, 503)
  }

  const { error: updateError } = await admin
    .from('payments')
    .update(outcome.update)
    .eq('id', paymentId)
  if (updateError) {
    console.error('resend-webhook update failed:', updateError)
    return jsonResponse({ error: 'Could not update the invoice' }, 500)
  }
  return jsonResponse({ updated: true })
})
