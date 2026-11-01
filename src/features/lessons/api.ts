import { supabase } from '../../lib/supabaseClient'
import type { Database } from '../../types/supabase'

export type LessonSession = Database['public']['Tables']['lesson_sessions']['Row']
export type LessonSessionInsert =
  Database['public']['Tables']['lesson_sessions']['Insert']

export type Course = Database['public']['Tables']['courses']['Row']
export type CourseInsert = Database['public']['Tables']['courses']['Insert']
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

const BOOKING_SELECT =
  'id, session_id, owner_id, rider_id, horse_id, enrolment_id, status, cancelled_at, created_at, owner:owners(id, full_name), rider:riders(id, full_name), horse:horses(id, name)'

const SESSION_SELECT = `*, course:courses(id, title, booking_mode, spare_release_days_before), bookings:lesson_bookings(${BOOKING_SELECT})`

function startOfTodayIso(): string {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date.toISOString()
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

/** Every date between the course's term dates landing on its weekday, at
 * its local start/end time — computed here (not server-side) so the
 * instant is correct for the browser's time zone, the same way the
 * existing ad-hoc "add lesson" form already works. */
export function computeCourseSessionDates(
  course: Pick<Course, 'term_start_date' | 'term_end_date' | 'weekday' | 'start_time' | 'end_time'>,
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
    const startsAt = new Date(current)
    startsAt.setHours(startHour, startMinute, 0, 0)
    const endsAt = new Date(current)
    endsAt.setHours(endHour, endMinute, 0, 0)
    sessions.push({ starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString() })
    current.setDate(current.getDate() + 7)
  }
  return sessions
}

export async function generateSessionsForCourse(
  course: Course,
): Promise<LessonSession[]> {
  const { data, error } = await supabase.rpc('generate_course_sessions', {
    p_course_id: course.id,
    p_sessions: computeCourseSessionDates(course),
  })
  if (error) throw error
  return data
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
