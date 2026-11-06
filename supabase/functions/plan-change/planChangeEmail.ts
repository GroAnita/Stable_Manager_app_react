// Builds the notice boarders get when their stable plans to stop using card payments.
// Kept separate from the function so it has no Deno or network dependency.

function formatDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-')
  return `${day}.${month}.${year}`
}

export function buildPlanChangeEmail(input: {
  stableName: string
  horseName: string | null
  switchDate: string | null
  cancelled: boolean
}): { subject: string; text: string } {
  const horse = input.horseName ?? 'hesten din'
  if (input.cancelled || !input.switchDate) {
    return {
      subject: `Automatisk betaling til ${input.stableName} fortsetter`,
      text: `${input.stableName} har likevel valgt å fortsette med kortbetaling gjennom Stalldrift. Automatisk betaling for ${horse} fortsetter som før, og du trenger ikke å gjøre noe.`,
    }
  }
  const date = formatDate(input.switchDate)
  return {
    subject: `Automatisk betaling til ${input.stableName} avsluttes ${date}`,
    text: [
      `${input.stableName} slutter å bruke kortbetaling gjennom Stalldrift ${date}. Automatisk betaling for ${horse} avsluttes da, og kortet ditt fjernes.`,
      'Stallplassen fortsetter som før. Dette endrer ikke oppstallingsavtalen.',
      'Fakturaer med trekkdato før overgangen trekkes som vanlig. Du får en siste faktura for overgangen, og den og senere fakturaer betales på den måten som står på dem. Du blir ikke belastet to ganger for samme periode.',
      `Har du spørsmål, kontakt ${input.stableName}.`,
    ].join('\n\n'),
  }
}
