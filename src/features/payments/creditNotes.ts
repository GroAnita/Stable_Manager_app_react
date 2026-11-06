import { supabaseFunctionError } from '../../lib/supabaseFunctionError'
import { supabase } from '../../lib/supabaseClient'
import type { Database } from '../../types/supabase'

type Tables = Database['public']['Tables']

export type CreditNote = Tables['credit_notes']['Row'] & {
  lines: Tables['credit_note_lines']['Row'][]
}

export type CreditNoteDetail = CreditNote & {
  payment: {
    invoice_number: string | null
    due_date: string
    created_at: string
    owner: Pick<
      Tables['owners']['Row'],
      'full_name' | 'address' | 'postal_code' | 'city'
    > | null
  } | null
  stable: Pick<
    Tables['stables']['Row'],
    | 'name'
    | 'logo_url'
    | 'org_number'
    | 'vat_registered'
    | 'address'
    | 'postal_code'
    | 'city'
    | 'phone'
    | 'email'
  > | null
}

export async function listCreditNotes(
  paymentId: string,
): Promise<CreditNote[]> {
  const { data, error } = await supabase
    .from('credit_notes')
    .select('*, lines:credit_note_lines(*)')
    .eq('payment_id', paymentId)
    .order('created_at')
  if (error) throw error
  return data
}

export async function getCreditNote(id: string): Promise<CreditNoteDetail> {
  const { data, error } = await supabase
    .from('credit_notes')
    .select(
      `*, lines:credit_note_lines(*),
       payment:payments(invoice_number, due_date, created_at,
         owner:owners(full_name, address, postal_code, city)),
       stable:stables(name, logo_url, org_number, vat_registered, address, postal_code, city, phone, email)`,
    )
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function listInvoiceLines(paymentId: string) {
  const { data, error } = await supabase
    .from('invoice_lines')
    .select('*')
    .eq('payment_id', paymentId)
    .order('position')
  if (error) throw error
  return data
}

export async function createCreditNote(input: {
  paymentId: string
  reason: string
  lines: { line_id: string; amount_gross: number }[]
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_credit_note', {
    p_payment_id: input.paymentId,
    p_reason: input.reason,
    p_lines: input.lines,
  })
  if (error) throw error
  return data
}

export async function createAdditionalInvoice(input: {
  paymentId: string
  description: string
  amountGross: number
  vatCode: string
  periodStart: string
  periodEnd: string
  dueDate: string
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_additional_invoice', {
    p_payment_id: input.paymentId,
    p_description: input.description,
    p_amount_gross: input.amountGross,
    p_vat_code: input.vatCode,
    p_period_start: input.periodStart,
    p_period_end: input.periodEnd,
    p_due_date: input.dueDate,
  })
  if (error) throw error
  return data
}

export async function sendCreditNote(creditNoteId: string): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke<{ sent: boolean }>(
    'credit-note',
    { body: { creditNoteId } },
  )
  if (error) throw await supabaseFunctionError(error)
  return data?.sent ?? false
}
