// The email a boarder gets when a charge fails. Kept separate so it has no Deno
// or network dependency. The retry date in it is the notice the agreement promises
// before a new attempt.

// How long after a failure the stable can try the card again.
export const RETRY_NOTICE_DAYS = 3

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
  retryOn: string
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
      `Hvis fakturaen fortsatt er ubetalt, kan stallen prøve å trekke ${amount} fra kortet ditt på nytt fra og med ${formatDate(input.retryOn)}.`,
      contact
        ? `Har du spørsmål, kontakt stallen: ${contact}.`
        : 'Har du spørsmål, kontakt stallen.',
    ].join('\n\n'),
  }
}
