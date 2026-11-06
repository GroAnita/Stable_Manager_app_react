// Decides whether an invoice may be charged to a card. Kept separate from the
// function so it has no Deno or network dependency.

import {
  isHardDecline,
  MAX_CHARGE_FAILURES,
} from '../_shared/chargeFailureEmail.ts'

export const NOTICE_DAYS = 7

export type ChargeBlocker =
  | 'already_paid'
  | 'charge_in_progress'
  | 'no_agreement'
  | 'no_card'
  | 'paused'
  | 'too_many_failures'
  | 'card_refused'
  | 'retry_not_notified'
  | 'retry_too_soon'
  | 'email_not_delivered'
  | 'notice_too_short'
  | 'not_due_yet'
  | 'amount_too_low'

export type ChargeCheck = {
  status: string
  chargeStatus: string | null
  amount: number
  dueDate: string
  agreementActive: boolean
  hasCard: boolean
  paused: boolean
  retryNotBefore: string | null
  failureCount: number
  chargeError: string | null
  deliveryStatus: string | null
  deliveredAt: string | null
  sentTo: string | null
  expectedRecipient: string | null
  today: string
  // The notice and due date rules only apply to real money, so test charges
  // don't have to wait a week.
  isLive: boolean
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso.slice(0, 10)}T00:00:00Z`)
  const to = Date.parse(`${toIso.slice(0, 10)}T00:00:00Z`)
  return Math.round((to - from) / 86400000)
}

export function chargeBlocker(check: ChargeCheck): ChargeBlocker | null {
  if (check.status === 'paid') return 'already_paid'
  if (check.chargeStatus === 'processing') return 'charge_in_progress'
  if (check.chargeStatus === 'succeeded') return 'already_paid'
  if (!check.agreementActive) return 'no_agreement'
  if (!check.hasCard) return 'no_card'
  if (check.paused) return 'paused'
  if (
    check.deliveryStatus !== 'delivered' ||
    !check.deliveredAt ||
    !check.sentTo ||
    !check.expectedRecipient ||
    check.sentTo.toLowerCase() !== check.expectedRecipient.toLowerCase()
  ) {
    return 'email_not_delivered'
  }
  if (check.isLive) {
    if (daysBetween(check.deliveredAt, check.today) < NOTICE_DAYS) {
      return 'notice_too_short'
    }
    if (check.today < check.dueDate) return 'not_due_yet'
    // The boarder must have been told the amount and date of a new attempt.
    if (check.chargeStatus === 'failed') {
      if (check.failureCount >= MAX_CHARGE_FAILURES) return 'too_many_failures'
      if (isHardDecline(check.chargeError)) return 'card_refused'
      if (!check.retryNotBefore) return 'retry_not_notified'
      if (check.today < check.retryNotBefore) return 'retry_too_soon'
    }
  }
  if (toMinorUnits(check.amount) < 300) return 'amount_too_low'
  return null
}

// Stripe takes amounts in øre.
export function toMinorUnits(amount: number): number {
  return Math.round(amount * 100)
}
