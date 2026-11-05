// The email a stable gets when a boarder disputes a card payment. Kept separate so
// it has no Deno or network dependency.

function formatDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-')
  return `${day}.${month}.${year}`
}

function formatKroner(amount: number): string {
  return `${new Intl.NumberFormat('nb-NO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)} kr`
}

export function buildDisputeEmail(input: {
  invoiceNumber: string | null
  amount: number
  evidenceDueBy: string | null
}): { subject: string; text: string } {
  const invoice = input.invoiceNumber
    ? `faktura ${input.invoiceNumber}`
    : 'en faktura'
  return {
    subject: `Innsigelse på kortbetaling for ${invoice}`,
    text: [
      `En kortinnehaver har bestridt betalingen på ${formatKroner(input.amount)} for ${invoice}. Banken holder normalt beløpet tilbake mens saken behandles.`,
      input.evidenceDueBy
        ? `Du må svare i Stripe innen ${formatDate(input.evidenceDueBy)}. Svarer du ikke, taper du normalt saken.`
        : 'Logg inn i Stripe for å se hva som må gjøres.',
      'Svaret gis i Stripe-kontoen din, ikke i Stalldrift.',
    ].join('\n\n'),
  }
}
