// Works out what became of a boarder's Stripe payment page for an invoice.
// deno-lint-ignore-file no-explicit-any
import type Stripe from 'npm:stripe@23.1.0'
import { recordChargeSucceeded } from './invoiceCharge.ts'

export type CheckoutState =
  | { state: 'paid' }
  | { state: 'open'; url: string | null }
  | { state: 'released' }

// Frees the invoice once its payment page has ended unpaid.
export async function releaseCheckoutClaim(
  admin: any,
  paymentId: string,
  sessionId: string,
): Promise<void> {
  const { error } = await admin
    .from('payments')
    .update({
      charge_status: null,
      charge_error: null,
      stripe_checkout_session_id: null,
    })
    .eq('id', paymentId)
    .eq('stripe_checkout_session_id', sessionId)
    .eq('charge_status', 'processing')
  if (error) throw error
}

export async function syncCheckout(
  stripe: Stripe,
  admin: any,
  paymentId: string,
  sessionId: string,
  stripeAccount: string,
): Promise<CheckoutState> {
  const session = await stripe.checkout.sessions.retrieve(
    sessionId,
    {},
    { stripeAccount },
  )
  if (session.status === 'complete' && session.payment_status === 'paid') {
    await recordChargeSucceeded(
      admin,
      paymentId,
      session.payment_intent as string,
    )
    return { state: 'paid' }
  }
  if (session.status === 'expired') {
    await releaseCheckoutClaim(admin, paymentId, sessionId)
    return { state: 'released' }
  }
  return { state: 'open', url: session.url }
}
