// Colours a course or a single lesson can have. They're used as stripes and dots
// next to the text, never behind it, and each reads on both backgrounds.
export const LESSON_COLORS: { key: string; hex: string }[] = [
  { key: 'green', hex: '#3A6B52' },
  { key: 'brown', hex: '#B45309' },
  { key: 'blue', hex: '#2563EB' },
  { key: 'purple', hex: '#7C3AED' },
  { key: 'pink', hex: '#D6006A' },
  { key: 'red', hex: '#DC2626' },
  { key: 'teal', hex: '#0F766E' },
  { key: 'orange', hex: '#EA580C' },
  { key: 'indigo', hex: '#4338CA' },
  { key: 'grey', hex: '#475569' },
]

// What lessons and courses had before colours could be chosen.
export const DEFAULT_LESSON_COLOR = '#3A6B52'
export const DEFAULT_COURSE_COLOR = '#B45309'

// A course's sessions take the course's colour; a single lesson its own.
export function sessionColor(session: {
  color?: string | null
  course?: { color?: string | null } | null
}): string {
  if (session.course) return session.course.color ?? DEFAULT_COURSE_COLOR
  return session.color ?? DEFAULT_LESSON_COLOR
}
