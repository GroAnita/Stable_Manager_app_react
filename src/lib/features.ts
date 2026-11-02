import type { StableType } from '../features/settings/api'
import { useAuth } from './AuthContext'

export const STABLE_TYPES: StableType[] = [
  'boarding',
  'riding_school',
  'sales',
  'private',
]

// Keys an optional module checks to decide whether it's visible for a
// stable. New module keys get added here as those modules are built —
// enabling a key that no screen reads yet is harmless, just inert.
export type FeatureKey =
  | 'lesson_booking'
  | 'instructor_scheduling'
  | 'sales_listings'
  | 'co_rider'

export const ALL_FEATURES: { key: FeatureKey; labelKey: string }[] = [
  { key: 'lesson_booking', labelKey: 'settings.featureLessonBooking' },
  {
    key: 'instructor_scheduling',
    labelKey: 'settings.featureInstructorScheduling',
  },
  { key: 'sales_listings', labelKey: 'settings.featureSalesListings' },
  { key: 'co_rider', labelKey: 'settings.featureCoRider' },
]

// What create_stable() seeds enabled_features with for each stable_type
// preset — mirrors the case statement in the
// 20261101000000_stable_feature_flags.sql migration. The owner can
// still flip any of these afterwards; the type is just the starting
// point, not a permanent constraint.
export const FEATURE_PRESETS: Record<StableType, FeatureKey[]> = {
  boarding: [],
  riding_school: ['lesson_booking', 'instructor_scheduling'],
  sales: ['sales_listings'],
  private: [],
}

export function isFeatureEnabled(
  enabledFeatures: unknown,
  key: FeatureKey,
): boolean {
  if (typeof enabledFeatures !== 'object' || enabledFeatures === null) {
    return false
  }
  return Boolean((enabledFeatures as Record<string, unknown>)[key])
}

export function useFeature(key: FeatureKey): boolean {
  const { profile } = useAuth()
  return isFeatureEnabled(profile?.stable?.enabled_features, key)
}
