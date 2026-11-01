import { supabase } from '../../lib/supabaseClient'
import type { Database } from '../../types/supabase'

export type Lesson = Database['public']['Tables']['lessons']['Row']
export type LessonInsert = Database['public']['Tables']['lessons']['Insert']
export type LessonUpdate = Database['public']['Tables']['lessons']['Update']

export type LessonBooking =
  Database['public']['Tables']['lesson_bookings']['Row'] & {
    owner: Pick<
      Database['public']['Tables']['owners']['Row'],
      'id' | 'full_name'
    > | null
    horse: Pick<Database['public']['Tables']['horses']['Row'], 'id' | 'name'> | null
  }

export type LessonWithBookings = Lesson & { bookings: LessonBooking[] }

const LESSON_SELECT =
  '*, bookings:lesson_bookings(id, lesson_id, owner_id, horse_id, created_at, owner:owners(id, full_name), horse:horses(id, name))'

const BOOKING_SELECT =
  'id, lesson_id, owner_id, horse_id, created_at, owner:owners(id, full_name), horse:horses(id, name)'

function startOfTodayIso(): string {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date.toISOString()
}

export async function listUpcomingLessons(): Promise<LessonWithBookings[]> {
  const { data, error } = await supabase
    .from('lessons')
    .select(LESSON_SELECT)
    .gte('starts_at', startOfTodayIso())
    .order('starts_at')
  if (error) throw error
  return data
}

export async function createLesson(input: LessonInsert): Promise<Lesson> {
  const { data, error } = await supabase
    .from('lessons')
    .insert(input)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteLesson(id: string): Promise<void> {
  const { error } = await supabase.from('lessons').delete().eq('id', id)
  if (error) throw error
}

export async function bookLesson(
  lessonId: string,
  ownerId: string,
  horseId: string,
): Promise<LessonBooking> {
  const { data, error } = await supabase
    .from('lesson_bookings')
    .insert({ lesson_id: lessonId, owner_id: ownerId, horse_id: horseId })
    .select(BOOKING_SELECT)
    .single()
  if (error) throw error
  return data
}

export async function cancelLessonBooking(bookingId: string): Promise<void> {
  const { error } = await supabase
    .from('lesson_bookings')
    .delete()
    .eq('id', bookingId)
  if (error) throw error
}
