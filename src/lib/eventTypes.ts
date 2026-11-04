import type { Database } from '../types/supabase'

export type EventType = Database['public']['Enums']['calendar_event_type']

export const EVENT_TYPES: EventType[] = [
  'vet',
  'farrier',
  'therapist',
  'vaccination',
  'worming',
  'training',
  'stable_event',
  'arena_booking',
  'other',
]

export const CUSTOM_TYPE_MAX_LENGTH = 50

// Only "other" events keep typed-in text, so switching an event to another
// type clears it.
export function customTypeFor(
  eventType: EventType,
  customType: string,
): string | null {
  return eventType === 'other' ? customType.trim() || null : null
}
