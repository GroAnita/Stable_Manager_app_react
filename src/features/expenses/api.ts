import { supabase } from '../../lib/supabaseClient'
import type { Database } from '../../types/supabase'

export type Expense = Database['public']['Tables']['expenses']['Row']
export type ExpenseInsert = Database['public']['Tables']['expenses']['Insert']

export async function listExpenses(
  from: string,
  to: string,
): Promise<Expense[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .gte('expense_date', from)
    .lte('expense_date', to)
    .order('expense_date', { ascending: false })
  if (error) throw error
  return data
}

// Bills the stable owner has logged ahead of time (e.g. a hay invoice due
// next week) so Dashboard/Calendar can remind them before the money is due.
// Reuses expense_date as the due date — expenses RLS already restricts this
// to stable_owner/stable_employee, so horse_owner never sees it.
export async function listUpcomingBills(windowDays = 30): Promise<Expense[]> {
  const pad = (n: number) => String(n).padStart(2, '0')
  const toIso = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const today = new Date()
  const until = new Date(today)
  until.setDate(until.getDate() + windowDays)
  return listExpenses(toIso(today), toIso(until))
}

export async function createExpense(input: ExpenseInsert): Promise<Expense> {
  const { data, error } = await supabase
    .from('expenses')
    .insert(input)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase.from('expenses').delete().eq('id', id)
  if (error) throw error
}
