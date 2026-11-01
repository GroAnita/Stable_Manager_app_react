import { supabase } from '../../lib/supabaseClient'
import type { Database } from '../../types/supabase'

export type LessonSession = Database['public']['Tables']['lesson_sessions']['Row']
export type LessonSessionInsert =
  Database['public']['Tables']['lesson_sessions']['Insert']

export type Course = Database['public']['Tables']['courses']['Row']
export type CourseInsert = Database['public']['Tables']['courses']['Insert']
export type CourseUpdate = Database['public']['Tables']['courses']['Update']
export type CourseBookingMode = Course['booking_mode']

export type Enrolment = Database['public']['Tables']['enrolments']['Row'] & {
  course: Pick<Course, 'id' | 'title' | 'instructor_name'> | null
}

export type LessonBooking =
  Database['public']['Tables']['lesson_bookings']['Row'] & {
    owner: Pick<
      Database['public']['Tables']['owners']['Row'],
      'id' | 'full_name'
    > | null
    rider: Pick<Database['public']['Tables']['riders']['Row'], 'id' | 'full_name'> | null
    horse: Pick<Database['public']['Tables']['horses']['Row'], 'id' | 'name'> | null
  }

export type LessonSessionWithBookings = LessonSession & {
  course: Pick<
    Course,
    'id' | 'title' | 'booking_mode' | 'spare_release_days_before'
  > | null
  bookings: LessonBooking[]
}

export type MyBooking = LessonBooking & {
  session: (Pick<LessonSession, 'id' | 'title' | 'starts_at' | 'ends_at' | 'status'> & {
    course: Pick<Course, 'id' | 'title'> | null
  }) | null
}

export type CourseEnrolment = Database['public']['Tables']['enrolments']['Row'] & {
  rider: Pick<Database['public']['Tables']['riders']['Row'], 'id' | 'full_name'> | null
}

export type BlockedDate = Database['public']['Tables']['blocked_dates']['Row']
export type BlockedDateInsert = Database['public']['Tables']['blocked_dates']['Insert']

const BOOKING_SELECT =
  'id, session_id, owner_id, rider_id, horse_id, enrolment_id, status, cancelled_at, created_at, owner:owners(id, full_name), rider:riders(id, full_name), horse:horses(id, name)'

const SESSION_SELECT = `*, course:courses(id, title, booking_mode, spare_release_days_before), bookings:lesson_bookings(${BOOKING_SELECT})`

function startOfTodayIso(): string {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date.toISOString()
}

// Local (not UTC) Y-M-D — a date near midnight can land on a different
// UTC day than the stable's local calendar day, which would silently
// mis-match against blocked_dates.
export function toLocalIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// ---------------------------------------------------------------------------
// Sessions (both course-generated and standalone/ad-hoc)

export async function listUpcomingSessions(): Promise<LessonSessionWithBookings[]> {
  const { data, error } = await supabase
    .from('lesson_sessions')
    .select(SESSION_SELECT)
    .gte('starts_at', startOfTodayIso())
    .order('starts_at')
  if (error) throw error
  return data
}

/** The Riding lessons tab is for one-off, ad-hoc lessons only — a
 * course's generated sessions live under that course instead, so they
 * don't show up twice. Booking a lesson still needs to see both (a
 * drop-in seat can be in a course session), so this is separate from
 * listUpcomingSessions() rather than a filter on it. */
export async function listUpcomingStandaloneSessions(): Promise<
  LessonSessionWithBookings[]
> {
  const { data, error } = await supabase
    .from('lesson_sessions')
    .select(SESSION_SELECT)
    .is('course_id', null)
    .gte('starts_at', startOfTodayIso())
    .order('starts_at')
  if (error) throw error
  return data
}

export async function listSessionsInRange(
  fromIso: string,
  toIso: string,
): Promise<LessonSessionWithBookings[]> {
  const { data, error } = await supabase
    .from('lesson_sessions')
    .select(SESSION_SELECT)
    .gte('starts_at', fromIso)
    .lte('starts_at', toIso)
    .order('starts_at')
  if (error) throw error
  return data
}

export async function createStandaloneSession(
  input: Omit<LessonSessionInsert, 'course_id'>,
): Promise<LessonSession> {
  const { data, error } = await supabase
    .from('lesson_sessions')
    .insert({ ...input, course_id: null })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function cancelSession(id: string): Promise<void> {
  const { error } = await supabase
    .from('lesson_sessions')
    .update({ status: 'cancelled' })
    .eq('id', id)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Courses

export async function listCourses(): Promise<Course[]> {
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .order('term_start_date', { ascending: false })
  if (error) throw error
  return data
}

export async function createCourse(input: CourseInsert): Promise<Course> {
  const { data, error } = await supabase
    .from('courses')
    .insert(input)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCourse(id: string, input: CourseUpdate): Promise<Course> {
  const { data, error } = await supabase
    .from('courses')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

/** Every date between the course's term dates landing on its weekday, at
 * its local start/end time — computed here (not server-side) so the
 * instant is correct for the browser's time zone, the same way the
 * existing ad-hoc "add lesson" form already works. Dates in
 * excludeDates (local Y-M-D, e.g. public holidays) are skipped
 * entirely rather than generated and then cancelled — a course that
 * spans more holidays just ends up with fewer sessions than another. */
export function computeCourseSessionDates(
  course: Pick<Course, 'term_start_date' | 'term_end_date' | 'weekday' | 'start_time' | 'end_time'>,
  excludeDates?: Set<string>,
): { starts_at: string; ends_at: string }[] {
  const sessions: { starts_at: string; ends_at: string }[] = []
  const [startHour, startMinute] = course.start_time.split(':').map(Number)
  const [endHour, endMinute] = course.end_time.split(':').map(Number)

  const current = new Date(`${course.term_start_date}T00:00:00`)
  const end = new Date(`${course.term_end_date}T00:00:00`)
  while (current.getDay() !== course.weekday) {
    current.setDate(current.getDate() + 1)
  }
  while (current <= end) {
    if (!excludeDates?.has(toLocalIsoDate(current))) {
      const startsAt = new Date(current)
      startsAt.setHours(startHour, startMinute, 0, 0)
      const endsAt = new Date(current)
      endsAt.setHours(endHour, endMinute, 0, 0)
      sessions.push({ starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString() })
    }
    current.setDate(current.getDate() + 7)
  }
  return sessions
}

export async function generateSessionsForCourse(
  course: Course,
): Promise<LessonSession[]> {
  const blocked = await listBlockedDates()
  const blockedDates = new Set(blocked.map((b) => b.date))
  const { data, error } = await supabase.rpc('generate_course_sessions', {
    p_course_id: course.id,
    p_sessions: computeCourseSessionDates(course, blockedDates),
  })
  if (error) throw error
  return data
}

// ---------------------------------------------------------------------------
// Blocked dates (holidays/closures) — stable-wide, skipped when
// generating a course's sessions.

export async function listBlockedDates(): Promise<BlockedDate[]> {
  const { data, error } = await supabase
    .from('blocked_dates')
    .select('*')
    .order('date')
  if (error) throw error
  return data
}

export async function addBlockedDate(input: BlockedDateInsert): Promise<BlockedDate> {
  const { data, error } = await supabase
    .from('blocked_dates')
    .insert(input)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteBlockedDate(id: string): Promise<void> {
  const { error } = await supabase.from('blocked_dates').delete().eq('id', id)
  if (error) throw error
}

/** Bulk-add, silently skipping any date already blocked for this
 * stable (the unique constraint backs this up server-side too). */
export async function addBlockedDates(
  stableId: string,
  dates: { date: string; label: string }[],
): Promise<void> {
  const { error } = await supabase.from('blocked_dates').upsert(
    dates.map((d) => ({ stable_id: stableId, date: d.date, label: d.label })),
    { onConflict: 'stable_id,date', ignoreDuplicates: true },
  )
  if (error) throw error
}

const NORWEGIAN_FIXED_HOLIDAYS: { month: number; day: number; label: string }[] = [
  { month: 1, day: 1, label: 'Nyttårsdag' },
  { month: 5, day: 1, label: 'Arbeidernes dag' },
  { month: 5, day: 17, label: 'Grunnlovsdag' },
  { month: 12, day: 25, label: 'Første juledag' },
  { month: 12, day: 26, label: 'Andre juledag' },
]

const NORWEGIAN_EASTER_OFFSET_HOLIDAYS: { offset: number; label: string }[] = [
  { offset: -3, label: 'Skjærtorsdag' },
  { offset: -2, label: 'Langfredag' },
  { offset: 0, label: '1. påskedag' },
  { offset: 1, label: '2. påskedag' },
  { offset: 39, label: 'Kristi himmelfartsdag' },
  { offset: 49, label: '1. pinsedag' },
]

/** Anonymous Gregorian algorithm for the date of Easter Sunday. */
function computeEasterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

/** Norway's official non-working public holidays for a given year
 * ("røde dager"), as local Y-M-D dates with their Norwegian names. */
export function computeNorwegianPublicHolidays(
  year: number,
): { date: string; label: string }[] {
  const holidays = NORWEGIAN_FIXED_HOLIDAYS.map(({ month, day, label }) => ({
    date: toLocalIsoDate(new Date(year, month - 1, day)),
    label,
  }))

  const easter = computeEasterSunday(year)
  for (const { offset, label } of NORWEGIAN_EASTER_OFFSET_HOLIDAYS) {
    const date = new Date(easter)
    date.setDate(date.getDate() + offset)
    holidays.push({ date: toLocalIsoDate(date), label })
  }

  return holidays.sort((a, b) => a.date.localeCompare(b.date))
}

export async function listSessionsForCourse(
  courseId: string,
): Promise<LessonSessionWithBookings[]> {
  const { data, error } = await supabase
    .from('lesson_sessions')
    .select(SESSION_SELECT)
    .eq('course_id', courseId)
    .order('starts_at')
  if (error) throw error
  return data
}

export async function listEnrolmentsForCourse(
  courseId: string,
): Promise<CourseEnrolment[]> {
  const { data, error } = await supabase
    .from('enrolments')
    .select('*, rider:riders(id, full_name)')
    .eq('course_id', courseId)
    .order('enrolled_at')
  if (error) throw error
  return data
}

/** Staff-only: reassign which horse a specific booking uses, independent
 * of every other booking under the same enrolment — a term rider can
 * ride a different horse each week. The DB rejects a horse that isn't
 * even in this stable (see 20261101000005_booking_horse_reassignment_guard.sql);
 * ordinary RLS still blocks non-staff from calling this at all. */
export async function assignBookingHorse(
  bookingId: string,
  horseId: string | null,
): Promise<LessonBooking> {
  const { data, error } = await supabase
    .from('lesson_bookings')
    .update({ horse_id: horseId })
    .eq('id', bookingId)
    .select(BOOKING_SELECT)
    .single()
  if (error) throw error
  return data
}

/** Every confirmed lesson booking a horse has ever had, for a
 * usage/overuse stat on the Horses page — kept simple rather than a
 * server-side date-ranged count, since per-horse lesson volume is
 * small. */
export async function listHorseLessonBookings(
  horseId: string,
): Promise<{ starts_at: string }[]> {
  const { data, error } = await supabase
    .from('lesson_bookings')
    .select('session:lesson_sessions(starts_at)')
    .eq('horse_id', horseId)
    .eq('status', 'confirmed')
  if (error) throw error
  return data
    .map((row) => row.session)
    .filter((session): session is { starts_at: string } => session !== null)
}

// ---------------------------------------------------------------------------
// Booking (term enrolment + drop-in), both funneled through RPCs so the
// capacity/eligibility/timing rules live in one place.

export async function enrolInCourse(params: {
  courseId: string
  ownerId: string
  riderId?: string | null
  horseId?: string | null
}): Promise<Database['public']['Tables']['enrolments']['Row']> {
  const { data, error } = await supabase.rpc('enrol_in_course', {
    p_course_id: params.courseId,
    p_owner_id: params.ownerId,
    p_rider_id: params.riderId ?? undefined,
    p_horse_id: params.horseId ?? undefined,
  })
  if (error) throw error
  return data
}

export async function withdrawFromCourse(enrolmentId: string): Promise<void> {
  const { error } = await supabase.rpc('withdraw_from_course', {
    p_enrolment_id: enrolmentId,
  })
  if (error) throw error
}

export async function bookDropinSession(params: {
  sessionId: string
  ownerId: string
  riderId?: string | null
  horseId?: string | null
}): Promise<Database['public']['Tables']['lesson_bookings']['Row']> {
  const { data, error } = await supabase.rpc('book_dropin_session', {
    p_session_id: params.sessionId,
    p_owner_id: params.ownerId,
    p_rider_id: params.riderId ?? undefined,
    p_horse_id: params.horseId ?? undefined,
  })
  if (error) throw error
  return data
}

export async function cancelBooking(bookingId: string): Promise<void> {
  const { error } = await supabase
    .from('lesson_bookings')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('id', bookingId)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Owner-facing views

export async function listMyBookings(): Promise<MyBooking[]> {
  const { data, error } = await supabase
    .from('lesson_bookings')
    .select(
      `${BOOKING_SELECT}, session:lesson_sessions(id, title, starts_at, ends_at, status, course:courses(id, title))`,
    )
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function listMyEnrolments(): Promise<Enrolment[]> {
  const { data, error } = await supabase
    .from('enrolments')
    .select('*, course:courses(id, title, instructor_name)')
    .order('enrolled_at', { ascending: false })
  if (error) throw error
  return data
}
