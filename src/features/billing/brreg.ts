export type BrregCompany = {
  orgNumber: string
  name: string
  address: string
  postalCode: string
  city: string
  vatRegistered: boolean
  businessRegisterRegistered: boolean
}

type BrregEnhet = {
  organisasjonsnummer: string
  navn: string
  forretningsadresse?: {
    adresse?: string[]
    postnummer?: string
    poststed?: string
  }
  registrertIMvaregisteret?: boolean
  registrertIForetaksregisteret?: boolean
}

function toCompany(enhet: BrregEnhet): BrregCompany {
  return {
    orgNumber: enhet.organisasjonsnummer,
    name: enhet.navn,
    address: enhet.forretningsadresse?.adresse?.join(', ') ?? '',
    postalCode: enhet.forretningsadresse?.postnummer ?? '',
    city: enhet.forretningsadresse?.poststed ?? '',
    vatRegistered: enhet.registrertIMvaregisteret ?? false,
    businessRegisterRegistered: enhet.registrertIForetaksregisteret ?? false,
  }
}

export async function searchBrregCompanies(
  query: string,
): Promise<BrregCompany[]> {
  const trimmed = query.trim()
  if (/^[0-9]{9}$/.test(trimmed)) {
    const res = await fetch(
      `https://data.brreg.no/enhetsregisteret/api/enheter/${trimmed}`,
    )
    if (res.status === 404) return []
    if (!res.ok) throw new Error('Could not reach the business register.')
    const enhet: BrregEnhet = await res.json()
    return [toCompany(enhet)]
  }

  if (trimmed.length < 3) return []
  const res = await fetch(
    `https://data.brreg.no/enhetsregisteret/api/enheter?navn=${encodeURIComponent(
      trimmed,
    )}&size=5`,
  )
  if (!res.ok) throw new Error('Could not reach the business register.')
  const data: { _embedded?: { enheter: BrregEnhet[] } } = await res.json()
  return (data._embedded?.enheter ?? []).map(toCompany)
}
