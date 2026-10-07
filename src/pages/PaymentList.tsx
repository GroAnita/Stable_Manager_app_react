import { useEffect, useMemo, useState } from 'react'
import { Badge } from '../components/Badge'
import { Card } from '../components/Card'
import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import {
  getPaymentSummary,
  listPayments,
  markPaymentPaid,
  type PaymentListItem,
  type PaymentSummary,
} from '../features/payments/api'
import { usePreferences } from '../lib/PreferencesContext'

type StatusFilter = 'all' | 'paid' | 'due' | 'overdue'

export default function PaymentList() {
  const { t, formatCurrency, formatDate } = usePreferences()
  const [payments, setPayments] = useState<PaymentListItem[]>([])
  const [summary, setSummary] = useState<PaymentSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [selected, setSelected] = useState<PaymentListItem | null>(null)
  const [markingPaid, setMarkingPaid] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([listPayments(), getPaymentSummary()])
      .then(([paymentsData, summaryData]) => {
        if (!cancelled) {
          setPayments(paymentsData)
          setSummary(summaryData)
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    const query = search.toLowerCase()
    return payments.filter((payment) => {
      const matchesSearch =
        !query ||
        [
          payment.invoice_number,
          payment.contract?.horse?.name,
          payment.owner?.full_name,
        ].some((value) => value?.toLowerCase().includes(query))
      const matchesStatus =
        statusFilter === 'all' || payment.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [payments, search, statusFilter])

  async function handleMarkPaid(id: string) {
    setMarkingPaid(id)
    try {
      await markPaymentPaid(id)
      const paidDate = new Date().toISOString().slice(0, 10)
      setPayments((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, status: 'paid', paid_date: paidDate } : p,
        ),
      )
      setSummary(await getPaymentSummary())
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setMarkingPaid(null)
    }
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">
            {t('paymentList.title')}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {t('paymentList.subtitle')}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card
          label={t('paymentList.paidThisMonth')}
          value={formatCurrency(summary?.paid_this_month ?? 0)}
          icon={<Icon name="dollar" className="h-5 w-5" />}
        />
        <Card
          label={t('paymentList.currentlyDue')}
          value={formatCurrency(summary?.total_due ?? 0)}
          icon={<Icon name="calendar" className="h-5 w-5" />}
        />
        <Card
          label={t('paymentList.overdueTotal')}
          value={formatCurrency(summary?.total_overdue ?? 0)}
          icon={<Icon name="alert" className="h-5 w-5" />}
        />
      </div>

      <div className="panel p-4">
        <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
          <input
            type="search"
            className="field"
            placeholder={t('paymentList.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="field"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          >
            <option value="all">{t('paymentList.allStatuses')}</option>
            <option value="paid">{t('status.paid')}</option>
            <option value="due">{t('status.due')}</option>
            <option value="overdue">{t('status.overdue')}</option>
          </select>
        </div>
      </div>

      {loading && (
        <p className="text-sm text-slate-500">{t('paymentList.loading')}</p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {t('paymentList.failedToLoad', { error })}
        </p>
      )}
      {!loading && !error && filtered.length === 0 && (
        <EmptyState
          title={t('paymentList.noPayments')}
          message={t('paymentList.noPaymentsFiltered')}
        />
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('paymentList.invoice')}</th>
                <th>{t('paymentList.horse')}</th>
                <th>{t('paymentList.owner')}</th>
                <th>{t('paymentList.amount')}</th>
                <th>{t('paymentList.dueDate')}</th>
                <th>{t('paymentList.status')}</th>
                <th>{t('paymentList.action')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((payment) => (
                <tr
                  key={payment.id}
                  className="cursor-pointer"
                  onClick={() => setSelected(payment)}
                >
                  <td>{payment.invoice_number ?? '—'}</td>
                  <td>{payment.contract?.horse?.name ?? '—'}</td>
                  <td>{payment.owner?.full_name ?? '—'}</td>
                  <td>{formatCurrency(payment.amount)}</td>
                  <td>{formatDate(payment.due_date)}</td>
                  <td>
                    <Badge status={payment.status} />
                  </td>
                  <td>
                    {payment.status === 'paid' ? (
                      <span className="text-sm text-slate-400">
                        {t('common.settled')}
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="btn-ghost px-3 py-2"
                        disabled={markingPaid === payment.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleMarkPaid(payment.id)
                        }}
                      >
                        {markingPaid === payment.id
                          ? t('paymentList.marking')
                          : t('common.markPaid')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.invoice_number || t('paymentList.detailsFallback')}
      >
        {selected && (
          <div className="space-y-3 text-sm text-slate-600">
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-800">
                {t('paymentList.status')}
              </span>
              <Badge status={selected.status} />
            </div>
            <div>
              <span className="font-medium text-slate-800">
                {t('paymentList.horse')}:
              </span>{' '}
              {selected.contract?.horse?.name ?? '—'}
            </div>
            <div>
              <span className="font-medium text-slate-800">
                {t('paymentList.owner')}:
              </span>{' '}
              {selected.owner?.full_name ?? '—'}
            </div>
            <div>
              <span className="font-medium text-slate-800">
                {t('paymentList.amount')}:
              </span>{' '}
              {formatCurrency(selected.amount)}
            </div>
            <div>
              <span className="font-medium text-slate-800">
                {t('paymentList.dueDate')}:
              </span>{' '}
              {formatDate(selected.due_date)}
            </div>
            {selected.paid_date && (
              <div>
                <span className="font-medium text-slate-800">
                  {t('paymentList.paidDate')}:
                </span>{' '}
                {formatDate(selected.paid_date)}
              </div>
            )}
            {selected.notes && (
              <div className="border-t border-slate-100 pt-3">
                <p className="mb-2 font-medium text-slate-800">
                  {t('paymentList.breakdown')}
                </p>
                <ul className="space-y-1.5">
                  {selected.notes
                    .split('\n')
                    .filter(Boolean)
                    .map((line) => (
                      <li
                        key={line}
                        className="rounded-xl bg-slate-50 px-3 py-2"
                      >
                        {line}
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
