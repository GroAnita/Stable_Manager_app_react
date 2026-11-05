// Keeps an invoice in step with what happens to its card payment after it
// succeeds. Each function reads the current state from Stripe rather than trusting
// the event, so events arriving late, twice or out of order are harmless.
// deno-lint-ignore-file no-explicit-any
import type Stripe from 'npm:stripe@23.1.0'
import { buildDisputeEmail } from './disputeEmail.ts'
import { sendEmail } from './sendEmail.ts'

function fromMinorUnits(amount: number): number {
  return Math.round(amount) / 100
}

// Stripe's fee only exists once the charge has settled, so this can find nothing
// yet. charge.updated calls it again when it does.
export async function recordStripeFee(
  stripe: Stripe,
  admin: any,
  paymentId: string,
  chargeId: string,
  stripeAccount: string,
): Promise<void> {
  const charge = await stripe.charges.retrieve(
    chargeId,
    { expand: ['balance_transaction'] },
    { stripeAccount },
  )
  const balance = charge.balance_transaction as
    Stripe.BalanceTransaction | string | null
  if (!balance || typeof balance === 'string') return
  const { error } = await admin
    .from('payments')
    .update({
      stripe_fee: fromMinorUnits(balance.fee),
      stripe_net: fromMinorUnits(balance.net),
    })
    .eq('id', paymentId)
  if (error) throw error
}

export async function syncRefunds(
  stripe: Stripe,
  admin: any,
  paymentId: string,
  chargeId: string,
  stripeAccount: string,
): Promise<void> {
  const charge = await stripe.charges.retrieve(chargeId, {}, { stripeAccount })
  const { error } = await admin
    .from('payments')
    .update({
      refunded_amount: fromMinorUnits(charge.amount_refunded),
      refunded_at: charge.amount_refunded > 0 ? new Date().toISOString() : null,
    })
    .eq('id', paymentId)
  if (error) throw error
}

export async function syncDispute(
  stripe: Stripe,
  admin: any,
  paymentId: string,
  disputeId: string,
  stripeAccount: string,
): Promise<void> {
  const dispute = await stripe.disputes.retrieve(
    disputeId,
    {},
    { stripeAccount },
  )
  const dueBy = dispute.evidence_details?.due_by
  const evidenceDueBy = dueBy ? new Date(dueBy * 1000).toISOString() : null
  const amount = fromMinorUnits(dispute.amount)

  const { data: current, error: readError } = await admin
    .from('payments')
    .select('invoice_number, dispute_lost_at, stable:stables(name, email)')
    .eq('id', paymentId)
    .single()
  if (readError) throw readError

  const { error } = await admin
    .from('payments')
    .update({
      dispute_id: dispute.id,
      dispute_status: dispute.status,
      dispute_reason: dispute.reason,
      dispute_amount: amount,
      // Summed across the dispute's movements, so a fee returned after a win nets out.
      dispute_fee: fromMinorUnits(
        (dispute.balance_transactions ?? []).reduce(
          (sum, transaction) => sum + transaction.fee,
          0,
        ),
      ),
      dispute_opened_at: new Date(dispute.created * 1000).toISOString(),
      dispute_evidence_due_by: evidenceDueBy,
      dispute_lost_at:
        dispute.status === 'lost'
          ? (current.dispute_lost_at ?? new Date().toISOString())
          : null,
    })
    .eq('id', paymentId)
  if (error) throw error

  // Claiming first means repeated events send one email.
  const { data: claimed, error: claimError } = await admin
    .from('payments')
    .update({ dispute_notified_at: new Date().toISOString() })
    .eq('id', paymentId)
    .is('dispute_notified_at', null)
    .select('id')
  if (claimError) throw claimError
  if (!claimed?.length) return

  const email = buildDisputeEmail({
    invoiceNumber: current.invoice_number,
    amount,
    evidenceDueBy,
  })
  const sent = await sendEmail({
    to: current.stable?.email ?? null,
    stableName: current.stable?.name ?? '',
    replyTo: null,
    subject: email.subject,
    text: email.text,
  })
  if (!sent) {
    const { error: undoError } = await admin
      .from('payments')
      .update({ dispute_notified_at: null })
      .eq('id', paymentId)
    if (undoError) throw undoError
  }
}
