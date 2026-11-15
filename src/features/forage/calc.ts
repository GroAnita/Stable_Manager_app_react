// The fôrkalkulator's arithmetic: how many kg of hay cover a horse's energy need.
//
// Energy need: 0.8 FEh per 100 kg ideal weight for maintenance, times a factor for
// the workload. FEh per kg feed is FEh per kg dry matter times the dry matter share.
// Hay needed = (need − energy from concentrate) / FEh per kg feed.
//
// The minimum check: a horse should eat at least 1.5 kg dry matter of roughage per
// 100 kg body weight a day, for the gut and for chewing, even when energy-rich hay
// would cover the energy with less.

export type Workload = 'none' | 'light' | 'moderate' | 'hard'
export type HayClass = 'H1' | 'H2' | 'H3' | 'H4' | 'H5'

export const WORKLOADS: Workload[] = ['none', 'light', 'moderate', 'hard']

export const WORKLOAD_FACTOR: Record<Workload, number> = {
  none: 1,
  light: 1.25,
  moderate: 1.5,
  hard: 1.75,
}

export const MAINTENANCE_FEH_PER_100_KG = 0.8
export const MIN_DRY_MATTER_KG_PER_100_KG = 1.5

export function isWorkload(value: unknown): value is Workload {
  return WORKLOADS.includes(value as Workload)
}

// Rounded to two decimals, as the analysis prints it, so the result matches what
// people get when they do the sum with the number on their analysis sheet.
export function fehPerKgFeed(
  dryMatterPercent: number,
  fehPerKgDm: number,
): number {
  return roundTo((dryMatterPercent / 100) * fehPerKgDm, 2)
}

// The small nudge keeps floating point from rounding 0.575 down to 0.57.
function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor + 1e-9) / factor
}

// For an analysis that only gives FEh per kg feed.
export function fehPerKgDmFromFeed(
  dryMatterPercent: number,
  fehPerKgFeedValue: number,
): number {
  return fehPerKgFeedValue / (dryMatterPercent / 100)
}

// The classes are given to two decimals (H3 is 0.52–0.57), so the value is rounded
// first and the gaps between classes disappear.
export function hayClass(fehPerKgDm: number): HayClass {
  const value = roundTo(fehPerKgDm, 2)
  if (value > 0.62) return 'H1'
  if (value >= 0.58) return 'H2'
  if (value >= 0.52) return 'H3'
  if (value >= 0.46) return 'H4'
  return 'H5'
}

// Horses in little or no work should have H3–H5; horses in moderate or hard work
// H1–H3. 'energyRich' and 'energyPoor' say which way a class misses.
export type ClassFit = 'good' | 'energyRich' | 'energyPoor'

export function classFit(
  workload: Workload,
  hayClassValue: HayClass,
): ClassFit {
  const light = workload === 'none' || workload === 'light'
  if (light) {
    return hayClassValue === 'H1' || hayClassValue === 'H2'
      ? 'energyRich'
      : 'good'
  }
  return hayClassValue === 'H4' || hayClassValue === 'H5'
    ? 'energyPoor'
    : 'good'
}

export type CalculationInput = {
  idealWeightKg: number
  workload: Workload
  dryMatterPercent: number
  fehPerKgDm: number
  concentrateKgPerDay?: number | null
  concentrateFehPerKg?: number | null
}

export type CalculationResult = {
  maintenanceFeh: number
  needFeh: number
  concentrateFeh: number
  hayFehNeeded: number
  fehPerKgFeed: number
  hayKg: number
  hayDryMatterKg: number
  minDryMatterKg: number
  minHayKg: number
  belowMinimum: boolean
  hayClass: HayClass
  classFit: ClassFit
}

export function calculate(input: CalculationInput): CalculationResult {
  const maintenanceFeh =
    (input.idealWeightKg / 100) * MAINTENANCE_FEH_PER_100_KG
  const needFeh = maintenanceFeh * WORKLOAD_FACTOR[input.workload]
  const concentrateFeh =
    (input.concentrateKgPerDay ?? 0) * (input.concentrateFehPerKg ?? 0)
  const hayFehNeeded = Math.max(0, needFeh - concentrateFeh)
  const perKgFeed = fehPerKgFeed(input.dryMatterPercent, input.fehPerKgDm)
  const hayKg = hayFehNeeded / perKgFeed
  const dryMatterShare = input.dryMatterPercent / 100
  const minDryMatterKg =
    (input.idealWeightKg / 100) * MIN_DRY_MATTER_KG_PER_100_KG
  const minHayKg = minDryMatterKg / dryMatterShare
  const cls = hayClass(input.fehPerKgDm)
  return {
    maintenanceFeh,
    needFeh,
    concentrateFeh,
    hayFehNeeded,
    fehPerKgFeed: perKgFeed,
    hayKg,
    hayDryMatterKg: hayKg * dryMatterShare,
    minDryMatterKg,
    minHayKg,
    // A little slack, so rounding alone never sets off the warning.
    belowMinimum: hayKg < minHayKg - 0.05,
    hayClass: cls,
    classFit: classFit(input.workload, cls),
  }
}

// The feeding plan's hay amounts are free text. "3", "3 kg", "2,5kg" and "0.75 kg"
// count; anything else ("samme som frokost", "stor pose") is reported as unreadable.
export function parseHayKg(text: string | null | undefined): number | null {
  const match = /^\s*(\d+(?:[.,]\d+)?)\s*(?:kg)?\s*$/i.exec(text ?? '')
  if (!match) return null
  return Number(match[1].replace(',', '.'))
}

export type PlanHay = {
  totalKg: number
  readable: number
  unreadable: string[]
}

export function sumPlanHay(amounts: (string | null | undefined)[]): PlanHay {
  const result: PlanHay = { totalKg: 0, readable: 0, unreadable: [] }
  for (const text of amounts) {
    if (!text || !text.trim()) continue
    const kg = parseHayKg(text)
    if (kg === null) {
      result.unreadable.push(text.trim())
    } else {
      result.totalKg += kg
      result.readable += 1
    }
  }
  return result
}

// Rounded the way it's shown: kg to one decimal, FEh to two.
export function roundKg(value: number): number {
  return roundTo(value, 1)
}

export function roundFeh(value: number): number {
  return roundTo(value, 2)
}
