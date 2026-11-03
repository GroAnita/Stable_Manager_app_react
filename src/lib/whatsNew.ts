// Product changelog shown via the "What's new" bell in the header. Add a new
// entry here (newest first) whenever a feature worth telling users about
// ships — remember to add the matching i18n keys to en.ts and no.ts too.
export type WhatsNewEntry = {
  id: string
  date: string // ISO date, used for sorting and "new since" comparisons
  titleKey: string
  bodyKey: string
  linkTo?: string
}

export const WHATS_NEW_ENTRIES: WhatsNewEntry[] = [
  {
    id: 'vat-exempt-price-list',
    date: '2026-11-03',
    titleKey: 'whatsNew.vatExempt.title',
    bodyKey: 'whatsNew.vatExempt.body',
    linkTo: '/price-list',
  },
  {
    id: 'co-rider',
    date: '2026-11-02',
    titleKey: 'whatsNew.coRider.title',
    bodyKey: 'whatsNew.coRider.body',
    linkTo: '/settings?section=features',
  },
]

const LAST_SEEN_KEY = 'whatsNew.lastSeenDate'

export function getLastSeenDate(): string | null {
  try {
    return localStorage.getItem(LAST_SEEN_KEY)
  } catch {
    return null
  }
}

export function markWhatsNewSeen(): void {
  try {
    const latest = WHATS_NEW_ENTRIES[0]?.date
    if (latest) localStorage.setItem(LAST_SEEN_KEY, latest)
  } catch {
    // ignore — storage may be unavailable (private mode, etc.)
  }
}

export function unseenWhatsNewCount(): number {
  const lastSeen = getLastSeenDate()
  if (!lastSeen) return WHATS_NEW_ENTRIES.length
  return WHATS_NEW_ENTRIES.filter((entry) => entry.date > lastSeen).length
}
