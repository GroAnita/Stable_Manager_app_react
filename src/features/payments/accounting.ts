import { supabaseFunctionError } from '../../lib/supabaseFunctionError'
import { supabase } from '../../lib/supabaseClient'
import {
  osloDate,
  type ReportCreditNote,
  type ReportInvoiceLine,
} from '../../lib/accountingReport'

const PAGE_SIZE = 1000

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

// Lines of the invoices dated in the period. Fetches a day either side, because
// invoice dates are in Norwegian time, and narrows it down afterwards.
export async function listInvoiceLinesInPeriod(
  from: string,
  to: string,
): Promise<ReportInvoiceLine[]> {
  const rows: ReportInvoiceLine[] = []
  for (let start = 0; ; start += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('invoice_lines')
      .select(
        `payment_id, description, period_start, period_end, vat_code, vat_rate,
         amount_net, vat_amount, amount_gross, position,
         payment:payments!inner(invoice_number, created_at)`,
      )
      .gte('payment.created_at', addDays(from, -1))
      .lte('payment.created_at', addDays(to, 2))
      .order('payment_id')
      .order('position')
      .range(start, start + PAGE_SIZE - 1)
    if (error) throw error
    for (const row of data) {
      rows.push({
        payment_id: row.payment_id,
        description: row.description,
        period_start: row.period_start,
        period_end: row.period_end,
        vat_code: row.vat_code,
        vat_rate: row.vat_rate,
        amount_net: row.amount_net,
        vat_amount: row.vat_amount,
        amount_gross: row.amount_gross,
        invoice_date: osloDate(row.payment?.created_at ?? ''),
        invoice_number: row.payment?.invoice_number ?? null,
      })
    }
    if (data.length < PAGE_SIZE) break
  }
  return rows.filter(
    (row) => row.invoice_date >= from && row.invoice_date <= to,
  )
}

export async function listCreditNotesInPeriod(
  from: string,
  to: string,
): Promise<ReportCreditNote[]> {
  const rows: ReportCreditNote[] = []
  for (let start = 0; ; start += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('credit_notes')
      .select(
        `credit_note_number, issued_on, reason, amount_net, vat_amount, amount_gross,
         lines:credit_note_lines(vat_code, vat_rate, amount_net, vat_amount, amount_gross),
         payment:payments(invoice_number, owner:owners(full_name))`,
      )
      .gte('issued_on', from)
      .lte('issued_on', to)
      .order('credit_note_number')
      .range(start, start + PAGE_SIZE - 1)
    if (error) throw error
    for (const row of data) {
      rows.push({
        credit_note_number: row.credit_note_number,
        issued_on: row.issued_on,
        reason: row.reason,
        amount_net: row.amount_net,
        vat_amount: row.vat_amount,
        amount_gross: row.amount_gross,
        invoice_number: row.payment?.invoice_number ?? null,
        owner_name: row.payment?.owner?.full_name ?? null,
        lines: row.lines,
      })
    }
    if (data.length < PAGE_SIZE) break
  }
  return rows
}

export type PayoutSummary = {
  id: string
  arrivalDate: string
  status: string
  amount: number
  manual: boolean
  difference: number
  rows: {
    type: string
    date: string
    gross: number
    fee: number
    net: number
    invoiceNumber: string | null
  }[]
}

export async function listStripePayouts(
  from: string,
  to: string,
): Promise<{ connected: boolean; payouts: PayoutSummary[] }> {
  const { data, error } = await supabase.functions.invoke<{
    connected: boolean
    payouts: PayoutSummary[]
  }>('stripe-payouts', { body: { from, to } })
  if (error) throw await supabaseFunctionError(error)
  return data ?? { connected: false, payouts: [] }
}
