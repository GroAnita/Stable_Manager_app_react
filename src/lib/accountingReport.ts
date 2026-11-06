// Works out the figures a stable's accountant needs. Stalldrift only shows the
// numbers: how they're booked and reported is up to the accountant.

export type ReportInvoiceLine = {
  payment_id: string
  description: string
  period_start: string | null
  period_end: string | null
  vat_code: string
  vat_rate: number
  amount_net: number
  vat_amount: number
  amount_gross: number
  invoice_date: string
  invoice_number: string | null
}

export type ReportCreditLine = {
  vat_code: string
  vat_rate: number
  amount_net: number
  vat_amount: number
  amount_gross: number
}

export type ReportCreditNote = {
  credit_note_number: string
  issued_on: string
  reason: string
  amount_net: number
  vat_amount: number
  amount_gross: number
  invoice_number: string | null
  owner_name: string | null
  lines: ReportCreditLine[]
}

export type ReportPayment = {
  id: string
  invoice_number: string | null
  created_at: string
  due_date: string
  paid_date: string | null
  status: string
  amount: number
  credited_amount: number
  credited_after_payment: number
  refunded_amount: number
  refunded_at: string | null
  dispute_status: string | null
  dispute_amount: number | null
  dispute_opened_at: string | null
  dispute_lost_at: string | null
  dispute_fee: number | null
  owner: { full_name: string } | null
}

function toOre(amount: number): number {
  return Math.round(Number(amount) * 100)
}

function fromOre(ore: number): number {
  return ore / 100
}

// Invoices are dated in Norwegian time, not the database's.
export function osloDate(iso: string): string {
  return new Date(iso).toLocaleDateString('sv-SE', {
    timeZone: 'Europe/Oslo',
  })
}

export function inPeriod(date: string | null, from: string, to: string) {
  return date !== null && date >= from && date <= to
}

export type InvoiceSummaryRow = {
  invoice_number: string | null
  invoice_date: string
  owner_name: string | null
  status: string
  // Null for older invoices, which have no lines to take VAT from.
  net: number | null
  vat: number | null
  gross: number
  credited: number
}

export function invoiceSummary(
  payments: ReportPayment[],
  lines: ReportInvoiceLine[],
  from: string,
  to: string,
): InvoiceSummaryRow[] {
  const totals = new Map<string, { net: number; vat: number }>()
  for (const line of lines) {
    const current = totals.get(line.payment_id) ?? { net: 0, vat: 0 }
    totals.set(line.payment_id, {
      net: current.net + toOre(line.amount_net),
      vat: current.vat + toOre(line.vat_amount),
    })
  }
  return payments
    .filter((payment) => inPeriod(osloDate(payment.created_at), from, to))
    .map((payment) => {
      const sums = totals.get(payment.id)
      return {
        invoice_number: payment.invoice_number,
        invoice_date: osloDate(payment.created_at),
        owner_name: payment.owner?.full_name ?? null,
        status: payment.status,
        net: sums ? fromOre(sums.net) : null,
        vat: sums ? fromOre(sums.vat) : null,
        gross: Number(payment.amount),
        credited: Number(payment.credited_amount),
      }
    })
    .sort((a, b) => a.invoice_date.localeCompare(b.invoice_date))
}

export type VatBasisRow = {
  vat_code: string
  vat_rate: number
  invoiced_net: number
  invoiced_vat: number
  credited_net: number
  credited_vat: number
  net: number
  vat: number
}

// Invoices count by invoice date and credit notes by their own date, so a credit
// note reduces the period it was issued in, even for an older invoice.
export function vatBasis(
  lines: ReportInvoiceLine[],
  creditNotes: ReportCreditNote[],
  from: string,
  to: string,
): VatBasisRow[] {
  const rows = new Map<
    string,
    {
      vat_code: string
      vat_rate: number
      invoicedNet: number
      invoicedVat: number
      creditedNet: number
      creditedVat: number
    }
  >()
  const row = (code: string, rate: number) => {
    const key = `${code}:${Number(rate)}`
    const existing = rows.get(key)
    if (existing) return existing
    const created = {
      vat_code: code,
      vat_rate: Number(rate),
      invoicedNet: 0,
      invoicedVat: 0,
      creditedNet: 0,
      creditedVat: 0,
    }
    rows.set(key, created)
    return created
  }
  for (const line of lines) {
    if (!inPeriod(line.invoice_date, from, to)) continue
    const current = row(line.vat_code, line.vat_rate)
    current.invoicedNet += toOre(line.amount_net)
    current.invoicedVat += toOre(line.vat_amount)
  }
  for (const note of creditNotes) {
    if (!inPeriod(note.issued_on, from, to)) continue
    for (const line of note.lines) {
      const current = row(line.vat_code, line.vat_rate)
      current.creditedNet += toOre(line.amount_net)
      current.creditedVat += toOre(line.vat_amount)
    }
  }
  return [...rows.values()]
    .sort(
      (a, b) => b.vat_rate - a.vat_rate || a.vat_code.localeCompare(b.vat_code),
    )
    .map((current) => ({
      vat_code: current.vat_code,
      vat_rate: current.vat_rate,
      invoiced_net: fromOre(current.invoicedNet),
      invoiced_vat: fromOre(current.invoicedVat),
      credited_net: fromOre(current.creditedNet),
      credited_vat: fromOre(current.creditedVat),
      net: fromOre(current.invoicedNet - current.creditedNet),
      vat: fromOre(current.invoicedVat - current.creditedVat),
    }))
}

export type OpenItemRow = {
  invoice_number: string | null
  owner_name: string | null
  due_date: string
  days_overdue: number
  amount: number
  credited: number
  due: number
}

export function openItems(
  payments: ReportPayment[],
  today: string,
): OpenItemRow[] {
  const day = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 86400000
  return payments
    .filter(
      (payment) =>
        payment.status !== 'paid' &&
        toOre(payment.amount) > toOre(payment.credited_amount),
    )
    .map((payment) => ({
      invoice_number: payment.invoice_number,
      owner_name: payment.owner?.full_name ?? null,
      due_date: payment.due_date,
      days_overdue: Math.max(day(today) - day(payment.due_date), 0),
      amount: Number(payment.amount),
      credited: Number(payment.credited_amount),
      due: fromOre(toOre(payment.amount) - toOre(payment.credited_amount)),
    }))
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
}

export type AccrualRow = {
  invoice_number: string | null
  invoice_date: string
  description: string
  period_start: string
  period_end: string
  net: number
  vat: number
}

// Lines invoiced in the period for something delivered at least partly outside it.
export function accruals(
  lines: ReportInvoiceLine[],
  from: string,
  to: string,
): AccrualRow[] {
  return lines
    .filter(
      (line) =>
        inPeriod(line.invoice_date, from, to) &&
        line.period_start !== null &&
        line.period_end !== null &&
        (line.period_start < from || line.period_end > to),
    )
    .map((line) => ({
      invoice_number: line.invoice_number,
      invoice_date: line.invoice_date,
      description: line.description,
      period_start: line.period_start as string,
      period_end: line.period_end as string,
      net: Number(line.amount_net),
      vat: Number(line.vat_amount),
    }))
    .sort((a, b) => a.invoice_date.localeCompare(b.invoice_date))
}

export type MoneyBackRow = {
  kind: 'refund' | 'dispute'
  invoice_number: string | null
  owner_name: string | null
  date: string
  amount: number
  status: string | null
  fee: number | null
}

export function refundsAndDisputes(
  payments: ReportPayment[],
  from: string,
  to: string,
): MoneyBackRow[] {
  const rows: MoneyBackRow[] = []
  for (const payment of payments) {
    const refunded = payment.refunded_at?.slice(0, 10) ?? null
    if (toOre(payment.refunded_amount) > 0 && inPeriod(refunded, from, to)) {
      rows.push({
        kind: 'refund',
        invoice_number: payment.invoice_number,
        owner_name: payment.owner?.full_name ?? null,
        date: refunded as string,
        amount: Number(payment.refunded_amount),
        status: null,
        fee: null,
      })
    }
    const disputed = payment.dispute_opened_at?.slice(0, 10) ?? null
    if (payment.dispute_status && inPeriod(disputed, from, to)) {
      rows.push({
        kind: 'dispute',
        invoice_number: payment.invoice_number,
        owner_name: payment.owner?.full_name ?? null,
        date: disputed as string,
        amount: Number(payment.dispute_amount ?? 0),
        status: payment.dispute_status,
        fee: payment.dispute_fee === null ? null : Number(payment.dispute_fee),
      })
    }
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date))
}

export type CsvCell = string | number | null

function csvCell(value: CsvCell): string {
  if (value === null) return ''
  if (typeof value === 'number') return value.toFixed(2).replace('.', ',')
  // A spreadsheet would run a text starting with one of these as a formula.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

// Semicolons and decimal commas, as Excel expects in Norway. The mark at the start
// makes it read æ, ø and å correctly.
export function toCsv(headers: string[], rows: CsvCell[][]): string {
  return `﻿${[headers, ...rows]
    .map((row) => row.map(csvCell).join(';'))
    .join('\r\n')}\r\n`
}
