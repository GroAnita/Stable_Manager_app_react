import type { Workload } from '../../features/forage/calc'
import { usePreferences } from '../../lib/PreferencesContext'

const WORKLOAD_KEY: Record<Workload, string> = {
  none: 'None',
  light: 'Light',
  moderate: 'Moderate',
  hard: 'Hard',
}

export function workloadLabelKey(workload: Workload): string {
  return `forage.workload${WORKLOAD_KEY[workload]}`
}

export function workloadPhraseKey(workload: Workload): string {
  return `forage.workloadIn${WORKLOAD_KEY[workload]}`
}

// Numbers the way the language writes them: "13,5" in Norwegian, "13.5" in English.
export function useForageNumber() {
  const { language } = usePreferences()
  const locale = language === 'no' ? 'nb-NO' : 'en-GB'
  // minDecimals keeps "0,50" from showing as "0,5" for values per kg.
  return (value: number, decimals = 1, minDecimals = 0) =>
    new Intl.NumberFormat(locale, {
      minimumFractionDigits: minDecimals,
      maximumFractionDigits: decimals,
    }).format(value)
}
