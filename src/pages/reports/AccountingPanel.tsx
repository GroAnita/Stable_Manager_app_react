import { Capacitor } from '@capacitor/core'
import { Share } from '@capacitor/share'
import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../../components/Icon'
import {
  listCreditNotesInPeriod,
  listInvoiceLinesInPeriod,
  listStripePayouts,
  type PayoutSummary,
} from '../../features/payments/accounting'
import {
  accruals,
  invoiceSummary,
  openItems,
  refundsAndDisputes,
  toCsv,
  vatBasis,
  type CsvCell,
  type ReportCreditNote,
  type ReportInvoiceLine,
  type ReportPayment,
} from '../../lib/accountingReport'
import { usePreferences } from '../../lib/PreferencesContext'

const TABS = [
  'invoices',
  'creditNotes',
  'vat',
  'open',
  'moneyBack',
  'accruals',
  'payouts',
] as const

type Tab = (typeof TABS)[number]

type Table = { headers: string[]; rows: CsvCell[][]; note?: string }

function todayOslo(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Oslo' })
}

export function AccountingPanel({
  from,
  to,
  payments,
}: {
  from: string
  to: string
  payments: ReportPayment[]
}) {
  const { t, formatCurrency, formatDate } = usePreferences()
  const [tab, setTab] = useState<Tab>('vat')
  const [lines, setLines] = useState<ReportInvoiceLine[]>([])
  const [creditNotes, setCreditNotes] = useState<ReportCreditNote[]>([])
  const [error, setError] = useState<string | null>(null)
  const [payouts, setPayouts] = useState<{
    period: string
    connected: boolean
    list: PayoutSummary[]
  } | null>(null)
  const [loadingPayouts, setLoadingPayouts] = useState(false)

  const period = `${from}:${to}`
  const currentPayouts = payouts?.period === period ? payouts : null

  useEffect(() => {
    let cancelled = false
    Promise.all([
      listInvoiceLinesInPeriod(from, to),
      listCreditNotesInPeriod(from, to),
    ])
      .then(([lineRows, noteRows]) => {
        if (cancelled) return
        setLines(lineRows)
        setCreditNotes(noteRows)
        setError(null)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [from, to])

  async function handleLoadPayouts() {
    setLoadingPayouts(true)
    setError(null)
    try {
      const result = await listStripePayouts(from, to)
      setPayouts({
        period,
        connected: result.connected,
        list: result.payouts,
      })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoadingPayouts(false)
    }
  }

  const statusLabel = (status: string) => t(`status.${status}`)
  const codeLabel = (code: string) => t(`priceList.vatCode_${code}`)

  const table: Table = useMemo(() => {
    const p = (key: string) => t(`reports.accounting_${key}`)
    switch (tab) {
      case 'invoices':
        return {
          headers: [
            p('invoiceNumber'),
            p('date'),
            p('customer'),
            p('status'),
            p('net'),
            p('vat'),
            p('gross'),
            p('credited'),
          ],
          rows: invoiceSummary(payments, lines, from, to).map((row) => [
            row.invoice_number,
            row.invoice_date,
            row.owner_name,
            statusLabel(row.status),
            row.net,
            row.vat,
            row.gross,
            row.credited,
          ]),
          note: p('invoicesNote'),
        }
      case 'creditNotes':
        return {
          headers: [
            p('creditNoteNumber'),
            p('date'),
            p('invoiceNumber'),
            p('customer'),
            p('reason'),
            p('net'),
            p('vat'),
            p('gross'),
          ],
          rows: creditNotes.map((note) => [
            note.credit_note_number,
            note.issued_on,
            note.invoice_number,
            note.owner_name,
            note.reason,
            Number(note.amount_net),
            Number(note.vat_amount),
            Number(note.amount_gross),
          ]),
        }
      case 'vat':
        return {
          headers: [
            p('vatCode'),
            p('invoicedNet'),
            p('invoicedVat'),
            p('creditedNet'),
            p('creditedVat'),
            p('net'),
            p('vat'),
          ],
          rows: vatBasis(lines, creditNotes, from, to).map((row) => [
            codeLabel(row.vat_code),
            row.invoiced_net,
            row.invoiced_vat,
            row.credited_net,
            row.credited_vat,
            row.net,
            row.vat,
          ]),
          note: p('vatNote'),
        }
      case 'open':
        return {
          headers: [
            p('invoiceNumber'),
            p('customer'),
            p('dueDate'),
            p('daysOverdue'),
            p('gross'),
            p('credited'),
            p('due'),
          ],
          rows: openItems(payments, todayOslo()).map((row) => [
            row.invoice_number,
            row.owner_name,
            row.due_date,
            String(row.days_overdue),
            row.amount,
            row.credited,
            row.due,
          ]),
          note: p('openNote'),
        }
      case 'moneyBack':
        return {
          headers: [
            p('kind'),
            p('invoiceNumber'),
            p('customer'),
            p('date'),
            p('gross'),
            p('status'),
            p('fee'),
          ],
          rows: refundsAndDisputes(payments, from, to).map((row) => [
            p(`kind_${row.kind}`),
            row.invoice_number,
            row.owner_name,
            row.date,
            row.amount,
            row.status,
            row.fee,
          ]),
        }
      case 'accruals':
        return {
          headers: [
            p('invoiceNumber'),
            p('date'),
            p('description'),
            p('periodStart'),
            p('periodEnd'),
            p('net'),
            p('vat'),
          ],
          rows: accruals(lines, from, to).map((row) => [
            row.invoice_number,
            row.invoice_date,
            row.description,
            row.period_start,
            row.period_end,
            row.net,
            row.vat,
          ]),
          note: p('accrualsNote'),
        }
      case 'payouts':
        return {
          headers: [
            p('payoutDate'),
            p('payout'),
            p('movement'),
            p('invoiceNumber'),
            p('gross'),
            p('fee'),
            p('net'),
          ],
          rows: (currentPayouts?.list ?? []).flatMap((payout) => [
            [
              payout.arrivalDate,
              payout.id,
              p('paidOut'),
              null,
              null,
              null,
              payout.amount,
            ] as CsvCell[],
            ...payout.rows.map((row): CsvCell[] => [
              row.date,
              payout.id,
              row.type,
              row.invoiceNumber,
              row.gross,
              row.fee,
              row.net,
            ]),
          ]),
          note: p('payoutsNote'),
        }
    }
    // statusLabel and codeLabel only depend on t.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, payments, lines, creditNotes, from, to, currentPayouts, t])

  async function handleExport() {
    const csv = toCsv(table.headers, table.rows)
    const filename = `stalldrift-${tab}-${from}-${to}.csv`
    if (Capacitor.isNativePlatform()) {
      try {
        await Share.share({ title: filename, text: csv })
      } catch {
        // user cancelled the share sheet — nothing to do
      }
      return
    }
    const url = URL.createObjectURL(
      new Blob([csv], { type: 'text/csv;charset=utf-8' }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  const showCell = (value: CsvCell) => {
    if (value === null) return '—'
    if (typeof value === 'number') return formatCurrency(value)
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? formatDate(value) : value
  }

  const unbalanced = (currentPayouts?.list ?? []).filter(
    (payout) => !payout.manual && payout.difference !== 0,
  )
  const manual = (currentPayouts?.list ?? []).filter((payout) => payout.manual)

  return (
    <div className="panel space-y-4 p-5 print:hidden">
      <div>
        <h3 className="section-title">{t('reports.accountingTitle')}</h3>
        <p className="mt-1 text-sm text-slate-500">
          {t('reports.accountingHint')}
        </p>
      </div>

      <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
        {TABS.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={tab === value}
            onClick={() => setTab(value)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === value ? 'bg-card text-forest shadow-sm' : 'text-slate-500'
            }`}
          >
            {t(`reports.accountingTab_${value}`)}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {table.note && <p className="text-xs text-slate-500">{table.note}</p>}

      {tab === 'payouts' && (
        <div className="space-y-2">
          <button
            type="button"
            className="btn-ghost"
            disabled={loadingPayouts}
            onClick={handleLoadPayouts}
          >
            {loadingPayouts
              ? t('common.loading')
              : t('reports.accounting_loadPayouts')}
          </button>
          {currentPayouts && !currentPayouts.connected && (
            <p className="text-sm text-slate-500">
              {t('reports.accounting_notConnected')}
            </p>
          )}
          {unbalanced.map((payout) => (
            <p key={payout.id} className="text-sm text-amber-700">
              {t('reports.accounting_payoutDifference', {
                id: payout.id,
                amount: formatCurrency(payout.difference),
              })}
            </p>
          ))}
          {manual.map((payout) => (
            <p key={payout.id} className="text-sm text-amber-700">
              {t('reports.accounting_payoutManual', { id: payout.id })}
            </p>
          ))}
        </div>
      )}

      {table.rows.length === 0 ? (
        <p className="text-sm text-slate-500">
          {t('reports.accounting_empty')}
        </p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                {table.headers.map((header) => (
                  <th key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex}>{showCell(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button
        type="button"
        className="btn-ghost"
        disabled={table.rows.length === 0}
        onClick={handleExport}
      >
        <Icon name="fileText" className="h-4 w-4" />
        {t('reports.accounting_exportCsv')}
      </button>
    </div>
  )
}
