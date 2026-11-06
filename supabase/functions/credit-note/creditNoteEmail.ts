// Builds the email a boarder gets with a credit note. Kept separate from the function
// so it has no Deno or network dependency.

export type CreditNoteEmailInput = {
  creditNoteNumber: string
  issuedOn: string
  invoiceNumber: string | null
  reason: string
  lines: {
    description: string
    vat_rate: number
    vat_amount: number
    amount_gross: number
  }[]
  amountNet: number
  vatAmount: number
  amountGross: number
  // What's left to pay on the invoice, or what the boarder should get back.
  stillToPay: number
  toRefund: number
  ownerName: string | null
  stableName: string
  stableOrgNumber: string | null
  stableVatRegistered: boolean
  stableEmail: string | null
  stablePhone: string | null
}

function formatKroner(amount: number): string {
  return `${new Intl.NumberFormat('nb-NO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)} kr`
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-')
  return `${day}.${month}.${year}`
}

export function buildCreditNoteEmail(input: CreditNoteEmailInput): {
  subject: string
  text: string
} {
  const invoice = input.invoiceNumber
    ? `faktura ${input.invoiceNumber}`
    : 'fakturaen'
  const sender = input.stableOrgNumber
    ? `${input.stableName}, org.nr. ${input.stableOrgNumber}${input.stableVatRegistered ? ' MVA' : ''}`
    : input.stableName
  const contact = [input.stableEmail, input.stablePhone]
    .filter(Boolean)
    .join(' / ')
  const showVat = input.stableVatRegistered && input.vatAmount > 0

  return {
    subject: `Kreditnota ${input.creditNoteNumber} fra ${input.stableName}`,
    text: [
      `Kreditnota ${input.creditNoteNumber}`,
      `Dato: ${formatDate(input.issuedOn)}`,
      `Fra: ${sender}`,
      ...(input.ownerName ? [`Til: ${input.ownerName}`] : []),
      `Gjelder: ${invoice}`,
      `Årsak: ${input.reason}`,
      '',
      ...input.lines.map((line) =>
        input.stableVatRegistered && line.vat_amount > 0
          ? `${line.description}: −${formatKroner(line.amount_gross)} (herav mva ${line.vat_rate} %: ${formatKroner(line.vat_amount)})`
          : `${line.description}: −${formatKroner(line.amount_gross)}`,
      ),
      '',
      ...(showVat
        ? [
            `Sum uten mva: −${formatKroner(input.amountNet)}`,
            `Mva: −${formatKroner(input.vatAmount)}`,
          ]
        : []),
      `Kreditert: −${formatKroner(input.amountGross)}`,
      '',
      input.toRefund > 0
        ? `Du får ${formatKroner(input.toRefund)} tilbake fra stallen.`
        : input.stillToPay > 0
          ? `Igjen å betale på ${invoice}: ${formatKroner(input.stillToPay)}.`
          : `Det er ikke noe igjen å betale på ${invoice}.`,
      '',
      contact
        ? `Har du spørsmål, kontakt stallen: ${contact}.`
        : 'Har du spørsmål, kontakt stallen.',
    ].join('\n'),
  }
}
