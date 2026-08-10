import { supabase } from '../../lib/supabaseClient'
import type { Database } from '../../types/supabase'

export type DashboardStats =
  Database['public']['Views']['dashboard_stats']['Row']
export type TodayTask = Database['public']['Views']['today_tasks_list']['Row']
export type UpcomingPayment =
  Database['public']['Views']['upcoming_payments_list']['Row']
export type OverduePayment =
  Database['public']['Views']['overdue_payments_list']['Row']
export type UpcomingVisit =
  Database['public']['Views']['upcoming_vet_visits_list']['Row']
export type RecentActivityItem =
  Database['public']['Views']['recent_activity']['Row']

export async function getDashboardStats(): Promise<DashboardStats> {
  const { data, error } = await supabase
    .from('dashboard_stats')
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function listTodayTasks(): Promise<TodayTask[]> {
  const { data, error } = await supabase.from('today_tasks_list').select('*')
  if (error) throw error
  return data
}

export async function listPaymentsNeedingAttention(): Promise<
  (UpcomingPayment | OverduePayment)[]
> {
  const [overdue, upcoming] = await Promise.all([
    supabase.from('overdue_payments_list').select('*'),
    supabase.from('upcoming_payments_list').select('*'),
  ])
  if (overdue.error) throw overdue.error
  if (upcoming.error) throw upcoming.error
  return [...overdue.data, ...upcoming.data]
}

export async function listUpcomingVisits(): Promise<UpcomingVisit[]> {
  const [vet, farrier] = await Promise.all([
    supabase.from('upcoming_vet_visits_list').select('*'),
    supabase.from('upcoming_farrier_visits_list').select('*'),
  ])
  if (vet.error) throw vet.error
  if (farrier.error) throw farrier.error
  return [...vet.data, ...farrier.data].sort((a, b) =>
    (a.start_time ?? '').localeCompare(b.start_time ?? ''),
  )
}

export async function listRecentActivity(
  limit = 6,
): Promise<RecentActivityItem[]> {
  const { data, error } = await supabase
    .from('recent_activity')
    .select('*')
    .limit(limit)
  if (error) throw error
  return data
}
