// The agreement boarders accept before their card can be charged. Everything
// specific is filled in from the stable, boarder and contract. Change VERSION
// whenever the wording changes, because each acceptance is stored with it.

export const AGREEMENT_VERSION = '1.1-utkast, 6. november 2026'

export type AgreementFields = {
  stableName: string
  stableOrgNumber: string | null
  stableEmail: string | null
  stablePhone: string | null
  ownerName: string
  horseName: string
  contractStartDate: string
  chargeDay: number
  today: string
  stablePrivacyPolicyUrl: string | null
}

export type AgreementSection = { heading: string; paragraphs: string[] }

export type Agreement = {
  version: string
  title: string
  intro: string
  details: string[]
  sections: AgreementSection[]
  acceptance: string
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-')
  return `${day}.${month}.${year}`
}

// The first charge date that still leaves time for the 7 days' notice, since invoices
// go out 8 days before the charge.
export function firstChargeDate(chargeDay: number, today: string): string {
  const [year, month, day] = today.split('-').map(Number)
  const earliest = Date.UTC(year, month - 1, day + 8)
  for (let offset = 0; ; offset += 1) {
    const candidate = Date.UTC(year, month - 1 + offset, chargeDay)
    if (candidate >= earliest) {
      return new Date(candidate).toISOString().slice(0, 10)
    }
  }
}

export function buildAgreement(fields: AgreementFields): Agreement {
  const stable = fields.stableName
  const day = fields.chargeDay
  const contact =
    [fields.stableEmail, fields.stablePhone].filter(Boolean).join(' / ') ||
    'kontaktinformasjonen stallen har oppgitt'
  const withdrawContact = fields.stableEmail ?? contact

  return {
    version: AGREEMENT_VERSION,
    title: 'Avtale om automatiske månedlige korttrekk',
    intro:
      'Denne avtalen gir stallen tillatelse til å trekke betaling for stallleie og avtalte tillegg fra kundens registrerte kort. Avtalen kommer i tillegg til oppstallingsavtalen.',
    details: [
      `Stallen: ${stable}${fields.stableOrgNumber ? `, org.nr. ${fields.stableOrgNumber}` : ''}`,
      `Kontakt: ${contact}`,
      `Kunden: ${fields.ownerName}`,
      `Gjelder: ${fields.horseName}, oppstallingsavtale fra ${formatDate(fields.contractStartDate)}`,
      `Første planlagte trekkdato: ${formatDate(firstChargeDate(day, fields.today))}`,
      `Avtaleversjon: ${AGREEMENT_VERSION}`,
    ],
    sections: [
      {
        heading: '1 Samtykke til automatisk betaling',
        paragraphs: [
          `Jeg gir ${stable} tillatelse til å belaste mitt registrerte betalingskort automatisk hver måned for betaling etter oppstallingsavtalen. Betalingen administreres gjennom Stalldrift og behandles av Stripe.`,
          'Tillatelsen gjelder denne stallen og betalingene beskrevet nedenfor.',
        ],
      },
      {
        heading: '2 Hvordan beløpet beregnes',
        paragraphs: [
          'Det månedlige beløpet består av avtalt stallleie og eventuelle tillegg som jeg har bestilt, eller som følger av oppstallingsavtalen. Dette kan eksempelvis være fôr, strø, inn- og utslipp eller andre avtalte tjenester.',
          `Tillegg faktureres etterskuddsvis etter at faktureringsperioden de gjelder er avsluttet. Faktureringsperioden løper fra dagen etter trekkdatoen til og med neste trekkdato. Med trekk den ${day}. kommer dermed tillegg fra og med ${day + 1}. oktober til og med ${day}. november på fakturaen som trekkes ${day}. desember. Fast stallleie følger perioden som er avtalt i oppstallingsavtalen.`,
          'Beløpet kan variere fra måned til måned. Fakturaen skal vise hvilke tjenester, priser og hvilken periode betalingen gjelder. Denne tillatelsen gir ikke stallen rett til å kreve betaling for tjenester eller prisendringer som ikke har grunnlag i avtalen med meg.',
        ],
      },
      {
        heading: '3 Faktura og varsel før trekk',
        paragraphs: [
          `Trekket gjennomføres den ${day}. hver måned. Planlagt trekkdato oppgis på fakturaen.`,
          'Jeg mottar en spesifisert faktura på oppgitt e-postadresse minst 7 kalenderdager før trekket. Fakturaen oppgir beløp, valuta og planlagt trekkdato.',
          'Hvis beløpet øker eller trekkdatoen endres etter at varselet er sendt, skal jeg få en oppdatert faktura eller et oppdatert varsel minst 7 kalenderdager før det nye trekket. Trekket utsettes dersom det er nødvendig for å overholde fristen. Et lavere beløp, for eksempel etter en kreditnota, kan trekkes uten nytt varsel. Nye kjøp og tillegg etter at fakturaen er sendt, tas med på en senere faktura etter regelen om etterskuddsvis fakturering.',
        ],
      },
      {
        heading: '4 Feil eller spørsmål om fakturaen',
        paragraphs: [
          `Hvis jeg mener fakturaen er feil, kan jeg kontakte stallen på ${contact}. Stallen skal undersøke innsigelsen og avklare videre betaling med meg. Når stallen mottar en konkret innsigelse før trekket er igangsatt, settes automatisk trekk på pause mens innsigelsen undersøkes.`,
          'Avtalen begrenser ikke mine rettigheter til å bestride et krav eller en kortbetaling.',
        ],
      },
      {
        heading: '5 Kortopplysninger og betaling',
        paragraphs: [
          'Jeg samtykker til at betalingskortet lagres hos Stripe for fremtidige betalinger til stallen. Jeg trenger normalt ikke å godkjenne hvert månedlige trekk, men banken kan kreve ekstra bekreftelse.',
          'Jeg er ansvarlig for å holde kontaktinformasjon og betalingskort oppdatert.',
          'Hvis et trekk mislykkes, får jeg beskjed med informasjon om hvordan fakturaen kan betales. Nye automatiske trekkforsøk varsles minst 7 kalenderdager på forhånd med beløp og dato.',
        ],
      },
      {
        heading: '6 Avslutte automatisk betaling',
        paragraphs: [
          `Jeg kan trekke tilbake tillatelsen til fremtidige automatiske korttrekk ved å velge «Avslutt automatisk betaling» under Min kontrakt i Stalldrift, eller ved å sende melding til ${withdrawContact}.`,
          'Tilbaketrekkingen gjelder fra den er registrert i Stalldrift eller meldingen er kommet frem til stallen. Den krever ikke godkjenning fra stallen. Stallen skal da stanse fremtidige automatiske trekk og nye trekkforsøk under denne tillatelsen, og sende meg en bekreftelse.',
          'Et trekk som allerede er gjennomført, blir ikke automatisk tilbakeført. Dersom en betaling allerede er sendt til behandling, skal stallen opplyse om den kan stoppes. Mine rettigheter til å bestride betalingen påvirkes ikke.',
          'Å avslutte automatisk betaling avslutter ikke oppstallingsavtalen og fjerner ikke betalingsplikten for gyldige krav. Ubetalte og fremtidige fakturaer må da betales på annen avtalt måte.',
        ],
      },
      {
        heading: '7 Varighet',
        paragraphs: [
          'Tillatelsen gjelder fra jeg godtar avtalen, og frem til den trekkes tilbake eller betalingsordningen avsluttes. Etter oppstallingsavtalens opphør kan tillatelsen bare brukes til et varslet sluttoppgjør som omfattes av avtalen, dersom jeg ikke allerede har trukket den tilbake.',
        ],
      },
      {
        heading: '8 Personopplysninger',
        paragraphs: [
          `${stable}${fields.stableOrgNumber ? `, org.nr. ${fields.stableOrgNumber},` : ''} er behandlingsansvarlig for personopplysninger som brukes til å administrere oppstallingsforholdet og stallens fakturering. Kontakt: ${contact}.`,
          'Stallen bruker Stalldrift til avtale- og betalingsadministrasjon og Stripe til kortbetaling. Nødvendige kunde-, avtale-, faktura- og betalingsopplysninger behandles for å administrere avtalen, gjennomføre betaling og oppfylle lovpålagte plikter.',
          `Mer informasjon om behandlingsgrunnlag, mottakere, eventuell overføring utenfor EØS, lagringstid og dine personvernrettigheter finnes i ${
            fields.stablePrivacyPolicyUrl
              ? `stallens personvernerklæring: ${fields.stablePrivacyPolicyUrl}`
              : `stallens personvernerklæring, som du får ved å kontakte stallen på ${contact}`
          }. Informasjon om Stripes behandling finnes i Stripes personvernerklæring: https://stripe.com/privacy.`,
          'Når betalingstillatelsen trekkes tilbake, opphører tillatelsen til fremtidige automatiske trekk. Dette medfører ikke automatisk sletting av avtale-, faktura- eller betalingshistorikk som fortsatt må oppbevares på lovlig grunnlag.',
        ],
      },
    ],
    acceptance: `Jeg har lest og godtar avtalen om automatiske månedlige korttrekk. Jeg gir ${stable} tillatelse til å trekke mitt registrerte kort den ${day}. hver måned for avtalt stallleie og avtalte tillegg. Tillegg faktureres etter at faktureringsperioden de gjelder er avsluttet. Beløpet kan variere, og jeg får faktura med beløp og trekkdato minst 7 kalenderdager før trekket. Jeg kan trekke tilbake tillatelsen til fremtidige trekk.`,
  }
}

// The wording stored with an acceptance and sent to the boarder as their copy.
export function agreementAsText(agreement: Agreement): string {
  return [
    agreement.title,
    agreement.intro,
    agreement.details.join('\n'),
    ...agreement.sections.map(
      (section) => `${section.heading}\n${section.paragraphs.join('\n')}`,
    ),
    `Aksept av avtalen\n${agreement.acceptance}`,
  ].join('\n\n')
}
