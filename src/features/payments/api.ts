import { supabase } from '../../lib/supabaseClient'
import type { Database } from '../../types/supabase'

export type Payment = Database['public']['Tables']['payments']['Row']
export type PaymentInsert = Database['public']['Tables']['payments']['Insert']
export type PaymentUpdate = Database['public']['Tables']['payments']['Update']
export type PaymentSummary =
  Database['public']['Views']['payment_summary']['Row']

export type PaymentListItem = Pick<
  Payment,
  | 'id'
  | 'invoice_number'
  | 'amount'
  | 'due_date'
  | 'paid_date'
  | 'status'
  | 'notes'
  | 'invoice_email_required'
  | 'invoice_email_sent_at'
  | 'invoice_email_sent_to'
  | 'invoice_email_error'
  | 'invoice_email_delivery_status'
  | 'invoice_email_delivered_at'
  | 'charge_status'
  | 'charge_error'
  | 'charged_at'
  | 'charge_attempts'
  | 'charge_failure_notified_attempt'
  | 'charge_retry_not_before'
  | 'charge_failure_count'
  | 'stripe_fee'
  | 'stripe_net'
  | 'refunded_amount'
  | 'refunded_at'
  | 'dispute_status'
  | 'dispute_reason'
  | 'dispute_amount'
  | 'dispute_evidence_due_by'
  | 'dispute_lost_at'
  | 'dispute_fee'
  | 'dispute_opened_at'
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

export type InvoiceEmailProblem = 'noEmail' | 'badAddress' | 'retrying'

// Why an invoice email hasn't reached the boarder, or null if nothing's wrong.
export function invoiceEmailProblem(
  payment: Pick<
    PaymentListItem,
    | 'invoice_email_required'
    | 'invoice_email_error'
    | 'invoice_email_delivery_status'
    | 'status'
  >,
): InvoiceEmailProblem | null {
  if (!payment.invoice_email_required || payment.status === 'paid') return null
  if (payment.invoice_email_error === 'owner_has_no_email') return 'noEmail'
  if (
    payment.invoice_email_delivery_status &&
    payment.invoice_email_delivery_status !== 'delivered'
  ) {
    return 'badAddress'
  }
  return payment.invoice_email_error ? 'retrying' : null
}

export type DisputeState = 'open' | 'won' | 'lost'

export function disputeState(status: string | null): DisputeState | null {
  if (!status) return null
  if (status === 'lost') return 'lost'
  if (status === 'won' || status === 'prevented' || status === 'warning_closed') {
    return 'won'
  }
  return 'open'
}

export async function getPaymentSummary(): Promise<PaymentSummary> {
  const { data, error } = await supabase
    .from('payment_summary')
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function listPayments(): Promise<PaymentListItem[]> {
  const { data, error } = await supabase
    .from('payments')
    .select(
      `id, invoice_number, amount, due_date, paid_date, status, notes,
       invoice_email_required, invoice_email_sent_at, invoice_email_sent_to,
       invoice_email_error, invoice_email_delivery_status, invoice_email_delivered_at,
       charge_status, charge_error, charged_at, charge_attempts,
       charge_failure_notified_attempt, charge_retry_not_before, charge_failure_count,
       stripe_fee, stripe_net, refunded_amount, refunded_at, dispute_status, dispute_reason,
       dispute_amount, dispute_evidence_due_by, dispute_lost_at, dispute_fee, dispute_opened_at,
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

export type InvoicePaymentMode = 'paidByCard' | 'cardChargePlanned' | 'manual'

// What the invoice should tell the boarder about paying. Bank details stay unless
// a card charge is really going to happen, so nobody is left without a way to pay.
export function invoicePaymentMode(input: {
  status: string
  chargeStatus: string | null
  agreementActive: boolean
  agreementPaused: boolean
}): InvoicePaymentMode {
  if (input.status === 'paid') {
    return input.chargeStatus === 'succeeded' ? 'paidByCard' : 'manual'
  }
  if (
    input.agreementActive &&
    !input.agreementPaused &&
    input.chargeStatus !== 'failed'
  ) {
    return 'cardChargePlanned'
  }
  return 'manual'
}

export type PaymentDetail = Payment & {
  paymentMode: InvoicePaymentMode

  owner: Pick<
    Database['public']['Tables']['owners']['Row'],
    'id' | 'full_name' | 'address' | 'postal_code' | 'city' | 'phone' | 'email'
  > | null
  contract: {
    id: string
    horse: Pick<Database['public']['Tables']['horses']['Row'], 'id' | 'name'> | null
  } | null
  lines: Database['public']['Tables']['invoice_lines']['Row'][]
  stable: Pick<
    Database['public']['Tables']['stables']['Row'],
    | 'name'
    | 'logo_url'
    | 'org_number'
    | 'vat_registered'
    | 'business_register_registered'
    | 'address'
    | 'postal_code'
    | 'city'
    | 'phone'
    | 'email'
    | 'bank_account_number'
    | 'payment_terms_days'
    | 'invoice_footer_text'
  > | null
}

export async function getPaymentDetail(id: string): Promise<PaymentDetail> {
  const { data, error } = await supabase
    .from('payments')
    .select(
      `*,
       owner:owners(id, full_name, address, postal_code, city, phone, email),
       contract:contracts(id, horse:horses(id, name)),
       stable:stables(name, logo_url, org_number, vat_registered, business_register_registered,
         address, postal_code, city, phone, email, bank_account_number, payment_terms_days, invoice_footer_text)`,
    )
    .eq('id', id)
    .single()
  if (error) throw error

  const { data: agreement, error: agreementError } = await supabase
    .from('card_agreements')
    .select('paused_at')
    .eq('contract_id', data.contract_id)
    .is('withdrawn_at', null)
    .not('activated_at', 'is', null)
    .maybeSingle()
  if (agreementError) throw agreementError

  const { data: lines, error: linesError } = await supabase
    .from('invoice_lines')
    .select('*')
    .eq('payment_id', id)
    .order('position')
  if (linesError) throw linesError

  return {
    ...data,
    lines,
    paymentMode: invoicePaymentMode({
      status: data.status,
      chargeStatus: data.charge_status,
      agreementActive: agreement !== null,
      agreementPaused: agreement?.paused_at != null,
    }),
  }
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

export async function queueInvoiceExtra(input: {
  contractId: string
  priceListItemId: string
  quantity: number
  purchasedOn: string
  description: string
}): Promise<{ id: string; amount: number; billsOn: string }> {
  const { data, error } = await supabase.rpc('queue_invoice_extra', {
    p_contract_id: input.contractId,
    p_price_list_item_id: input.priceListItemId,
    p_quantity: input.quantity,
    p_purchased_on: input.purchasedOn,
    p_description: input.description,
  })
  if (error) throw error
  const row = data?.[0]
  if (!row) throw new Error('Empty response from queue_invoice_extra')
  return { id: row.id, amount: row.amount, billsOn: row.bills_on }
}

export async function removeInvoiceExtra(id: string): Promise<void> {
  const { error } = await supabase.rpc('remove_invoice_extra', { p_id: id })
  if (error) throw error
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
