import { supabase } from '../../lib/supabaseClient'
import type { Database } from '../../types/supabase'

export type Payment = Database['public']['Tables']['payments']['Row']

export type PaymentListItem = Pick<
  Payment,
  | 'id'
  | 'invoice_number'
  | 'amount'
  | 'due_date'
  | 'paid_date'
  | 'status'
  | 'notes'
> & {
  owner: Pick<
    Database['public']['Tables']['owners']['Row'],
    'id' | 'full_name'
  > | null
  contract: {
    id: string
    horse: Pick<
      Database['public']['Tables']['horses']['Row'],
      'id' | 'name'
    > | null
  } | null
}

export async function listPayments(): Promise<PaymentListItem[]> {
  const { data, error } = await supabase
    .from('payments')
    .select(
      `id, invoice_number, amount, due_date, paid_date, status, notes,
       owner:owners(id, full_name),
       contract:contracts(id, horse:horses(id, name))`,
    )
    .order('due_date', { ascending: false })
  if (error) throw error
  return data
}

export async function markPaymentPaid(id: string): Promise<void> {
  const { error } = await supabase
    .from('payments')
    .update({
      status: 'paid',
      paid_date: new Date().toISOString().slice(0, 10),
    })
    .eq('id', id)
  if (error) throw error
}
