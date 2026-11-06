// The email a boarder gets when a charge fails. Kept separate so it has no Deno
// or network dependency. The retry date in it is the notice the agreement promises
// before a new attempt.

// How long after a failure the stable can try the card again.
export const RETRY_NOTICE_DAYS = 7

// After this many failed charges on an invoice, the card isn't tried again.
export const MAX_CHARGE_FAILURES = 3

// Stripe's hard decline codes: the bank has refused the card, so trying the same
// card again won't work. https://docs.stripe.com/billing/revenue-recovery/smart-retries
const HARD_DECLINE_CODES = [
  'incorrect_number',
  'lost_card',
  'pickup_card',
  'stolen_card',
  'revocation_of_authorization',
  'revocation_of_all_authorizations',
  'authentication_required',
  'highest_risk_level',
  'transaction_not_allowed',
]

export function isHardDecline(reason: string | null): boolean {
  return reason !== null && HARD_DECLINE_CODES.includes(reason)
}

export function retryDate(today: string): string {
  const date = new Date(`${today.slice(0, 10)}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + RETRY_NOTICE_DAYS)
  return date.toISOString().slice(0, 10)
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-')
  return `${day}.${month}.${year}`
}

function formatKroner(amount: number): string {
  return `${new Intl.NumberFormat('nb-NO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)} kr`
}

export function buildChargeFailureEmail(input: {
  invoiceNumber: string | null
  amount: number
  // Null when the limit is reached and the card won't be tried again.
  retryOn: string | null
  stableEmail: string | null
  stablePhone: string | null
}): { subject: string; text: string } {
  const invoice = input.invoiceNumber
    ? `faktura ${input.invoiceNumber}`
    : 'fakturaen din'
  const amount = formatKroner(input.amount)
  const contact = [input.stableEmail, input.stablePhone]
    .filter(Boolean)
    .join(' / ')
  return {
    subject: `Trekket for ${invoice} mislyktes`,
    text: [
      `Vi klarte ikke å trekke ${amount} for ${invoice} fra kortet ditt. Kortet ble ikke belastet, og fakturaen er fortsatt ubetalt.`,
      'Du kan betale den selv: logg inn i Stalldrift, gå til Min kontrakt og velg Betal nå.',
      input.retryOn
        ? `Hvis fakturaen fortsatt er ubetalt, kan stallen prøve å trekke ${amount} fra kortet ditt på nytt fra og med ${formatDate(input.retryOn)}.`
        : 'Kortet ditt blir ikke forsøkt trukket flere ganger for denne fakturaen, så den må betales på annen måte.',
      contact
        ? `Har du spørsmål, kontakt stallen: ${contact}.`
        : 'Har du spørsmål, kontakt stallen.',
    ].join('\n\n'),
  }
}
