// Tells the boarder about a failed charge, once per attempt. Both the charge
// function and Stripe's webhook can report the same failure.
// deno-lint-ignore-file no-explicit-any
import {
  buildChargeFailureEmail,
  isHardDecline,
  MAX_CHARGE_FAILURES,
  retryDate,
} from './chargeFailureEmail.ts'
import { sendEmail } from './sendEmail.ts'

// Returns whether the boarder has been told about this attempt.
export async function notifyChargeFailure(
  admin: any,
  paymentId: string,
): Promise<boolean> {
  const { data: row, error } = await admin
    .from('payments')
    .select(
      `charge_status, charge_attempts, charge_failure_notified_attempt,
       charge_failure_count, charge_error,
       amount, credited_amount, invoice_number,
       owner:owners(email),
       stable:stables(name, email, phone)`,
    )
    .eq('id', paymentId)
    .maybeSingle()
  if (error) throw error
  if (!row || row.charge_status !== 'failed') return false
  if (row.charge_failure_notified_attempt === row.charge_attempts) return true

  const previousFailures: number = row.charge_failure_count ?? 0
  const failures = previousFailures + 1
  const retryOn =
    failures < MAX_CHARGE_FAILURES && !isHardDecline(row.charge_error)
      ? retryDate(new Date().toISOString())
      : null
  // Claiming first means two reports of one failure send one email.
  const { data: claimed, error: claimError } = await admin
    .from('payments')
    .update({
      charge_failure_notified_attempt: row.charge_attempts,
      charge_failure_count: failures,
      charge_retry_not_before: retryOn,
    })
    .eq('id', paymentId)
    .or(
      `charge_failure_notified_attempt.is.null,charge_failure_notified_attempt.lt.${row.charge_attempts}`,
    )
    .select('id')
  if (claimError) throw claimError
  if (!claimed?.length) return true

  const email = buildChargeFailureEmail({
    invoiceNumber: row.invoice_number,
    amount: Number(row.amount) - Number(row.credited_amount ?? 0),
    retryOn,
    stableEmail: row.stable?.email ?? null,
    stablePhone: row.stable?.phone ?? null,
  })
  const sent = await sendEmail({
    to: row.owner?.email ?? null,
    stableName: row.stable?.name ?? '',
    replyTo: row.stable?.email ?? null,
    subject: email.subject,
    text: email.text,
  })
  if (sent) return true

  // No notice was given, so a retry stays blocked until one is.
  const { error: undoError } = await admin
    .from('payments')
    .update({
      charge_failure_notified_attempt: null,
      charge_failure_count: previousFailures,
      charge_retry_not_before: null,
    })
    .eq('id', paymentId)
  if (undoError) throw undoError
  return false
}
