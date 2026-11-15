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

function paymentCount() {
  return supabase.from('payments').select('id', { count: 'exact', head: true })
}

// Invoices not paid yet, whenever they're due.
export async function countOpenInvoices(): Promise<number> {
  const { count, error } = await paymentCount().in('status', ['due', 'overdue'])
  if (error) throw error
  return count ?? 0
}

// This month's invoices, by due date: how many are paid and how many aren't.
export async function getMonthPayments(
  monthStart: string,
  monthEnd: string,
): Promise<{ paid: number; open: number }> {
  const [paid, open] = await Promise.all([
    paymentCount()
      .gte('due_date', monthStart)
      .lte('due_date', monthEnd)
      .eq('status', 'paid'),
    paymentCount()
      .gte('due_date', monthStart)
      .lte('due_date', monthEnd)
      .in('status', ['due', 'overdue']),
  ])
  if (paid.error) throw paid.error
  if (open.error) throw open.error
  return { paid: paid.count ?? 0, open: open.count ?? 0 }
}

export type WeekEvent = {
  id: string
  title: string
  event_type: Database['public']['Enums']['calendar_event_type'] | null
  custom_type: string | null
  start_time: string
  horse: { id: string; name: string } | null
}

// Calendar events from the day before `from` to the day after `to`, so the
// caller can group them by Norwegian date without missing any at the edges.
export async function listEventsAround(
  from: string,
  to: string,
): Promise<WeekEvent[]> {
  const start = new Date(`${from}T00:00:00Z`)
  start.setUTCDate(start.getUTCDate() - 1)
  const end = new Date(`${to}T00:00:00Z`)
  end.setUTCDate(end.getUTCDate() + 2)
  const { data, error } = await supabase
    .from('calendar_events')
    .select(
      'id, title, event_type, custom_type, start_time, horse:horses(id, name)',
    )
    .gte('start_time', start.toISOString())
    .lt('start_time', end.toISOString())
    .order('start_time')
  if (error) throw error
  return data
}
