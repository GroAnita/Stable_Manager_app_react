// Builds the invoice email boarders get before a charge. Kept separate from the
// function so it has no Deno or network dependency.

export type InvoiceEmailInput = {
  invoiceNumber: string | null
  amount: number
  dueDate: string
  notes: string | null
  ownerName: string | null
  horseName: string | null
  // True only for boarders who have agreed to automatic card charges.
  cardChargePlanned: boolean
  stableName: string
  stableOrgNumber: string | null
  stableEmail: string | null
  stablePhone: string | null
}

type Line = { description: string; amount: number }

// Same reading of payments.notes as parseInvoiceLineItems in src/lib/billing.ts:
// a line ending in "— amount" is itemised, and the base line gets what's left.
function parseLines(notes: string | null, total: number): Line[] {
  const raw = (notes ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  if (raw.length === 0) return [{ description: 'Faktura', amount: total }]

  const lines: Line[] = []
  let explicitSum = 0
  let baseIndex = -1
  for (const line of raw) {
    const match = line.match(/^(.*?)\s+—\s+([\d]+(?:[.,]\d+)?)\s*$/)
    if (match) {
      const amount = Number(match[2].replace(',', '.'))
      lines.push({ description: match[1], amount })
      explicitSum += amount
    } else {
      lines.push({ description: line, amount: 0 })
      if (baseIndex === -1) baseIndex = lines.length - 1
    }
  }
  if (baseIndex !== -1) {
    lines[baseIndex].amount = Math.round((total - explicitSum) * 100) / 100
  }
  return lines
}

function formatKroner(amount: number): string {
  return `${new Intl.NumberFormat('nb-NO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)} kr`
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-')
  return `${day}.${month}.${year}`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function buildInvoiceEmail(input: InvoiceEmailInput): {
  subject: string
  html: string
  text: string
} {
  const lines = parseLines(input.notes, input.amount)
  const total = formatKroner(input.amount)
  const dueDate = formatDate(input.dueDate)
  const contact = [input.stableEmail, input.stablePhone]
    .filter(Boolean)
    .join(' / ')
  const sender = input.stableOrgNumber
    ? `${input.stableName} (org.nr. ${input.stableOrgNumber})`
    : input.stableName
  const invoiceLabel = input.invoiceNumber
    ? `Faktura ${input.invoiceNumber}`
    : 'Faktura'
  const complaint = contact
    ? `Hvis du mener fakturaen er feil, kontakt stallen: ${contact}.`
    : 'Hvis du mener fakturaen er feil, kontakt stallen.'
  const dateLabel = input.cardChargePlanned
    ? 'Planlagt trekkdato'
    : 'Forfallsdato'
  const chargeNote = input.cardChargePlanned
    ? `Beløpet trekkes automatisk fra kortet ditt ${dueDate}.`
    : null
  const details = [
    input.ownerName ? `Til: ${input.ownerName}` : null,
    input.horseName ? `Hest: ${input.horseName}` : null,
    `${dateLabel}: ${dueDate}`,
  ].filter((line): line is string => line !== null)

  const text = [
    `${invoiceLabel} fra ${sender}`,
    '',
    ...details,
    '',
    ...lines.map((line) => `${line.description}: ${formatKroner(line.amount)}`),
    '',
    `Å betale: ${total} (NOK)`,
    '',
    ...(chargeNote ? [chargeNote, ''] : []),
    complaint,
  ].join('\n')

  const html = `<!DOCTYPE html>
<html lang="nb">
<body style="font-family: Arial, sans-serif; color: #1e293b; max-width: 600px;">
  <h2 style="margin-bottom: 4px;">${escapeHtml(invoiceLabel)}</h2>
  <p style="margin-top: 0; color: #64748b;">Fra ${escapeHtml(sender)}</p>
  <p>${details.map(escapeHtml).join('<br>')}</p>
  <table style="width: 100%; border-collapse: collapse;">
    ${lines
      .map(
        (line) => `<tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${escapeHtml(line.description)}</td>
      <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; text-align: right; white-space: nowrap;">${escapeHtml(formatKroner(line.amount))}</td>
    </tr>`,
      )
      .join('\n    ')}
    <tr>
      <td style="padding: 8px 0; font-weight: bold;">Å betale (NOK)</td>
      <td style="padding: 8px 0; font-weight: bold; text-align: right; white-space: nowrap;">${escapeHtml(total)}</td>
    </tr>
  </table>
  ${chargeNote ? `<p>${escapeHtml(chargeNote)}</p>` : ''}
  <p style="color: #64748b; font-size: 14px;">${escapeHtml(complaint)}</p>
</body>
</html>`

  return {
    subject: `${invoiceLabel} fra ${input.stableName}, ${input.cardChargePlanned ? 'trekk' : 'forfall'} ${dueDate}`,
    html,
    text,
  }
}
