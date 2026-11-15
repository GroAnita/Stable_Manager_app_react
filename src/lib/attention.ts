import { useEffect, useState } from 'react'
import { BILL_REMINDER_WINDOW_DAYS } from './bills'
import { supabase } from './supabaseClient'

function localIso(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// How many things on the payments page need looking at: overdue invoices, and the
// stable's own bills due within BILL_REMINDER_WINDOW_DAYS. Shown as a badge in the
// menu. Checked again on every page change, so it clears once dealt with.
export function usePaymentsAttention(
  enabled: boolean,
  pathname: string,
): number {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const today = new Date()
    const until = new Date(today)
    until.setDate(until.getDate() + BILL_REMINDER_WINDOW_DAYS)
    Promise.all([
      supabase
        .from('payments')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'overdue'),
      supabase
        .from('expenses')
        .select('id', { count: 'exact', head: true })
        .gte('expense_date', localIso(today))
        .lte('expense_date', localIso(until)),
    ])
      .then(([overdue, bills]) => {
        if (cancelled) return
        setCount((overdue.count ?? 0) + (bills.count ?? 0))
      })
      .catch(() => {
        // Without the numbers there's just no badge.
      })
    return () => {
      cancelled = true
    }
  }, [enabled, pathname])

  return enabled ? count : 0
}
