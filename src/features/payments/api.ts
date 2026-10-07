import { supabase } from '../../lib/supabaseClient'
import type { Database } from '../../types/supabase'

export type Payment = Database['public']['Tables']['payments']['Row']
export type PaymentInsert = Database['public']['Tables']['payments']['Insert']
export type PaymentUpdate = Database['public']['Tables']['payments']['Update']

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

export async function getPayment(id: string): Promise<Payment | null> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function findOpenPayment(
  contractId: string,
  dueDate: string,
): Promise<Payment | null> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('contract_id', contractId)
    .eq('due_date', dueDate)
    .neq('status', 'paid')
    .limit(1)
  if (error) throw error
  return data?.[0] ?? null
}

export async function hasPaidPayment(
  contractId: string,
  dueDate: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('payments')
    .select('id')
    .eq('contract_id', contractId)
    .eq('due_date', dueDate)
    .eq('status', 'paid')
    .limit(1)
  if (error) throw error
  return (data?.length ?? 0) > 0
}

export async function countPaymentsDueOn(dueDate: string): Promise<number> {
  const { count, error } = await supabase
    .from('payments')
    .select('id', { count: 'exact', head: true })
    .eq('due_date', dueDate)
  if (error) throw error
  return count ?? 0
}

export async function createPayment(input: PaymentInsert): Promise<Payment> {
  const { data, error } = await supabase
    .from('payments')
    .insert(input)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updatePayment(
  id: string,
  input: PaymentUpdate,
): Promise<Payment> {
  const { data, error } = await supabase
    .from('payments')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deletePayment(id: string): Promise<void> {
  const { error } = await supabase.from('payments').delete().eq('id', id)
  if (error) throw error
}
