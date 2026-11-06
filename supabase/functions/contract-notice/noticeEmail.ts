// Builds the confirmation both sides get when notice is given. Kept separate from
// the function so it has no Deno or network dependency.

export type NoticeEmailInput = {
  stableName: string
  ownerName: string | null
  horseName: string | null
  endDate: string
  givenBy: 'boarder' | 'stable'
  givenOn: string
  openInvoiceCount: number
  openAmount: number
  cardAgreementActive: boolean
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

export function buildNoticeEmail(input: NoticeEmailInput): {
  subject: string
  text: string
} {
  const horse = input.horseName ?? 'hesten'
  const contact = [input.stableEmail, input.stablePhone]
    .filter(Boolean)
    .join(' / ')
  return {
    subject: `Oppsigelse av stallplass for ${horse}: slutter ${formatDate(input.endDate)}`,
    text: [
      `Stallplassen for ${horse} hos ${input.stableName} er sagt opp.`,
      [
        `Sluttdato: ${formatDate(input.endDate)}`,
        ...(input.ownerName ? [`Hesteeier: ${input.ownerName}`] : []),
        `Sagt opp av: ${input.givenBy === 'boarder' ? 'hesteeieren' : 'stallen'}`,
        `Registrert: ${formatDate(input.givenOn)}`,
      ].join('\n'),
      'Stallplassen løper og faktureres som vanlig frem til sluttdatoen. Den siste fakturaen er et sluttoppgjør for dagene som gjenstår og tillegg som ikke er fakturert ennå. Den sendes minst 7 dager før den skal betales.',
      input.openInvoiceCount > 0
        ? `Ubetalte fakturaer nå: ${input.openInvoiceCount}, til sammen ${formatKroner(input.openAmount)}.`
        : 'Det er ingen ubetalte fakturaer nå.',
      ...(input.cardAgreementActive
        ? [
            'Automatisk betaling fortsetter frem til sluttoppgjøret er betalt, og avsluttes da av seg selv. Du kan stoppe den tidligere under Min kontrakt, men da må gjenstående fakturaer betales på annen måte.',
          ]
        : []),
      contact
        ? `Er noe feil, kontakt stallen: ${contact}.`
        : 'Er noe feil, kontakt stallen.',
    ].join('\n\n'),
  }
}
