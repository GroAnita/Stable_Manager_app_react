// Decides what a Resend webhook event means for an invoice. Kept separate from
// the function so it has no Deno or network dependency.

const STATUS_BY_EVENT: Record<string, string> = {
  'email.delivered': 'delivered',
  'email.bounced': 'bounced',
  'email.suppressed': 'suppressed',
  'email.failed': 'failed',
}

export type DeliveryEvent = {
  type?: string
  created_at?: string
  data?: { to?: string[]; tags?: Record<string, string> }
}

export type InvoiceEmailState = {
  invoice_email_sent_to: string | null
  invoice_email_delivery_status: string | null
}

export type DeliveryOutcome =
  | { kind: 'ignore' }
  // The send hasn't been recorded yet, so the webhook should be delivered again.
  | { kind: 'retry' }
  | {
      kind: 'update'
      update: {
        invoice_email_delivery_status: string
        invoice_email_delivered_at: string | null
        invoice_email_error: string | null
      }
    }

export function paymentIdOf(event: DeliveryEvent): string | null {
  if (!event.type || !STATUS_BY_EVENT[event.type]) return null
  return event.data?.tags?.payment_id ?? null
}

export function deliveryOutcome(
  event: DeliveryEvent,
  state: InvoiceEmailState,
): DeliveryOutcome {
  const status = event.type ? STATUS_BY_EVENT[event.type] : undefined
  if (!status) return { kind: 'ignore' }
  if (!state.invoice_email_sent_to) return { kind: 'retry' }

  // A late event about an earlier send to an old address says nothing about
  // the current one.
  const recipients = (event.data?.to ?? []).map((to) => to.toLowerCase())
  if (!recipients.includes(state.invoice_email_sent_to.toLowerCase())) {
    return { kind: 'ignore' }
  }

  if (status === 'delivered') {
    // A failure is final, so a delivered event arriving out of order can't
    // turn it into proof of notice.
    if (
      state.invoice_email_delivery_status &&
      state.invoice_email_delivery_status !== 'delivered'
    ) {
      return { kind: 'ignore' }
    }
    return {
      kind: 'update',
      update: {
        invoice_email_delivery_status: 'delivered',
        invoice_email_delivered_at:
          event.created_at ?? new Date().toISOString(),
        invoice_email_error: null,
      },
    }
  }

  return {
    kind: 'update',
    update: {
      invoice_email_delivery_status: status,
      invoice_email_delivered_at: null,
      invoice_email_error: `Resend reported ${status}`,
    },
  }
}
