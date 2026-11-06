// Ends a card agreement and removes the saved card from Stripe. The agreement ends
// first, because that alone stops all charges and must stick even if Stripe can't
// be reached. A failed card removal is recorded, and card-cleanup tries it again.
// deno-lint-ignore-file no-explicit-any
import type Stripe from 'npm:stripe@23.1.0'

// Stripe answers these when the card is already gone, which is what we wanted.
export function cardAlreadyRemoved(error: unknown): boolean {
  const code = (error as { code?: string })?.code
  const message = String((error as { message?: string })?.message ?? '')
  return code === 'resource_missing' || /not attached/i.test(message)
}

export async function removeSavedCard(
  stripe: Stripe,
  admin: any,
  agreement: { id: string; stripe_payment_method_id: string | null },
  stripeAccount: string | undefined,
): Promise<boolean> {
  let failure: string | null = null
  if (agreement.stripe_payment_method_id) {
    if (!stripeAccount) {
      failure = 'no_stripe_account'
    } else {
      try {
        await stripe.paymentMethods.detach(
          agreement.stripe_payment_method_id,
          {},
          { stripeAccount },
        )
      } catch (error) {
        if (!cardAlreadyRemoved(error)) {
          console.error('card removal failed:', error)
          failure = (error as Error).message ?? 'card_removal_failed'
        }
      }
    }
  }
  const { error: saveError } = await admin
    .from('card_agreements')
    .update(
      failure
        ? { card_removal_error: failure }
        : {
            card_removed_at: new Date().toISOString(),
            card_removal_error: null,
          },
    )
    .eq('id', agreement.id)
  if (saveError) throw saveError
  return failure === null
}

export async function endCardAgreement(
  stripe: Stripe,
  admin: any,
  agreement: {
    id: string
    contract_id: string
    stripe_payment_method_id: string | null
    pending_card_session_id: string | null
  },
  stripeAccount: string | undefined,
  endedBy: string | null,
): Promise<boolean> {
  const { error: withdrawError } = await admin
    .from('card_agreements')
    .update({ withdrawn_at: new Date().toISOString(), withdrawn_by: endedBy })
    .eq('id', agreement.id)
  if (withdrawError) throw withdrawError
  const { error: contractError } = await admin
    .from('contracts')
    .update({ card_agreement_accepted_at: null })
    .eq('id', agreement.contract_id)
  if (contractError) throw contractError

  // An open page to change the card must not save one after this.
  if (agreement.pending_card_session_id && stripeAccount) {
    try {
      await stripe.checkout.sessions.expire(
        agreement.pending_card_session_id,
        {},
        { stripeAccount },
      )
    } catch (error) {
      console.error('expiring the card page failed:', error)
    }
  }
  return await removeSavedCard(stripe, admin, agreement, stripeAccount)
}
