// Records the result of a card charge. Both the charge function and Stripe's
// webhook report results, sometimes for the same payment, so applying one twice
// or in the wrong order has to be safe.
// deno-lint-ignore-file no-explicit-any
export async function recordChargeSucceeded(
  admin: any,
  paymentId: string,
  paymentIntentId: string,
): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await admin
    .from('payments')
    .update({
      status: 'paid',
      paid_date: now.slice(0, 10),
      payment_method: 'card',
      charge_status: 'succeeded',
      charge_error: null,
      charged_at: now,
      stripe_payment_intent_id: paymentIntentId,
    })
    .eq('id', paymentId)
    .or('charge_status.is.null,charge_status.neq.succeeded')
  if (error) throw error
}

// A failure only counts for the current attempt, so a late report about an
// earlier attempt can't overwrite a later result.
export async function recordChargeFailed(
  admin: any,
  paymentId: string,
  paymentIntentId: string | null,
  reason: string,
): Promise<void> {
  let query = admin
    .from('payments')
    .update({
      charge_status: 'failed',
      charge_error: reason,
      ...(paymentIntentId ? { stripe_payment_intent_id: paymentIntentId } : {}),
    })
    .eq('id', paymentId)
    .eq('charge_status', 'processing')
  if (paymentIntentId) {
    query = query.or(
      `stripe_payment_intent_id.is.null,stripe_payment_intent_id.eq.${paymentIntentId}`,
    )
  }
  const { error } = await query
  if (error) throw error
}

export async function recordChargeProcessing(
  admin: any,
  paymentId: string,
  paymentIntentId: string,
): Promise<void> {
  const { error } = await admin
    .from('payments')
    .update({ stripe_payment_intent_id: paymentIntentId })
    .eq('id', paymentId)
    .eq('charge_status', 'processing')
  if (error) throw error
}
