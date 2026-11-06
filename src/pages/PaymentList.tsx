import { useEffect, useMemo, useState } from 'react'
import { Badge } from '../components/Badge'
import { Card } from '../components/Card'
import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/Icon'
import { InvoiceView } from '../components/InvoiceView'
import { Modal } from '../components/Modal'
import {
  disputeState,
  getPaymentSummary,
  listPayments,
  invoiceEmailProblem,
  markPaymentPaid,
  type PaymentListItem,
  type PaymentSummary,
} from '../features/payments/api'
import {
  chargeInvoice,
  listContractsWithCardAgreement,
  setCardAgreementPaused,
  type ChargeResult,
} from '../features/payments/charge'
import { useAuth } from '../lib/AuthContext'
import { useConfirm } from '../lib/ConfirmContext'
import { usePreferences } from '../lib/PreferencesContext'

type StatusFilter = 'all' | 'paid' | 'due' | 'overdue'

export default function PaymentList() {
  const { t, formatCurrency, formatDate } = usePreferences()
  const { profile } = useAuth()
  const confirm = useConfirm()
  const [cardContracts, setCardContracts] = useState<
    Map<string, { paused: boolean }>
  >(new Map())
  const [charging, setCharging] = useState(false)
  const [chargeMessage, setChargeMessage] = useState<{
    ok: boolean
    text: string
  } | null>(null)
  const [payments, setPayments] = useState<PaymentListItem[]>([])
  const [summary, setSummary] = useState<PaymentSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [selected, setSelected] = useState<PaymentListItem | null>(null)
  const [invoicePaymentId, setInvoicePaymentId] = useState<string | null>(
    null,
  )
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

  const isStableOwner = profile?.role === 'stable_owner'

  // Only owners get the charge button, so nobody else needs this list. A failure
  // just means no button, and the rest of the page still works.
  useEffect(() => {
    if (!isStableOwner) return
    listContractsWithCardAgreement()
      .then(setCardContracts)
      .catch(() => setCardContracts(new Map()))
  }, [isStableOwner])

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

  function invoiceEmailStatusText(payment: PaymentListItem): string {
    const problem = invoiceEmailProblem(payment)
    if (problem === 'noEmail') return t('paymentList.emailNoAddress')
    if (problem === 'badAddress') {
      return t('paymentList.emailBadAddress', {
        email: payment.invoice_email_sent_to ?? '—',
      })
    }
    if (problem === 'retrying') return t('paymentList.emailRetrying')
    if (payment.invoice_email_delivered_at) {
      return t('paymentList.emailDelivered', {
        date: formatDate(payment.invoice_email_delivered_at.slice(0, 10)),
        email: payment.invoice_email_sent_to ?? '—',
      })
    }
    return payment.invoice_email_sent_at
      ? t('paymentList.emailSent')
      : t('paymentList.emailNotSentYet')
  }

  function chargeResultMessage(result: ChargeResult): {
    ok: boolean
    text: string
  } {
    if (result.blocked) {
      const key = `paymentList.chargeBlocked_${result.blocked}`
      const text = t(key)
      return { ok: false, text: text === key ? result.blocked : text }
    }
    const suffix = result.testMode ? ` ${t('paymentList.chargeTestMode')}` : ''
    if (result.outcome === 'succeeded') {
      return { ok: true, text: t('paymentList.chargeSucceeded') + suffix }
    }
    if (result.outcome === 'processing') {
      return { ok: true, text: t('paymentList.chargeProcessing') + suffix }
    }
    if (result.outcome === 'unknown') {
      return { ok: false, text: t('paymentList.chargeUnknown') }
    }
    return {
      ok: false,
      text:
        t('paymentList.chargeFailed', { reason: result.reason ?? '—' }) +
        ' ' +
        t(
          result.boarderNotified
            ? 'paymentList.chargeBoarderNotified'
            : 'paymentList.chargeBoarderNotNotified',
        ) +
        suffix,
    }
  }

  async function handleCharge(payment: PaymentListItem) {
    // Checking a charge already under way can't start a second one, so it needs
    // no confirmation.
    if (payment.charge_status !== 'processing') {
      const confirmed = await confirm(
        t('paymentList.chargeConfirm', {
          amount: formatCurrency(payment.amount),
          owner: payment.owner?.full_name ?? '—',
        }),
        { confirmLabel: t('paymentList.chargeNow') },
      )
      if (!confirmed) return
    }
    setCharging(true)
    setChargeMessage(null)
    try {
      const result = await chargeInvoice(payment.id)
      setChargeMessage(chargeResultMessage(result))
      const [paymentsData, summaryData] = await Promise.all([
        listPayments(),
        getPaymentSummary(),
      ])
      setPayments(paymentsData)
      setSummary(summaryData)
      setSelected(paymentsData.find((p) => p.id === payment.id) ?? null)
    } catch (err) {
      setChargeMessage({ ok: false, text: (err as Error).message })
    } finally {
      setCharging(false)
    }
  }

  async function handleTogglePause(contractId: string, paused: boolean) {
    setChargeMessage(null)
    try {
      await setCardAgreementPaused(contractId, paused)
      setCardContracts(await listContractsWithCardAgreement())
    } catch (err) {
      setChargeMessage({ ok: false, text: (err as Error).message })
    }
  }

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
                    {invoiceEmailProblem(payment) && (
                      <p className="mt-1 text-xs font-medium text-red-600">
                        {t('paymentList.emailNotDelivered')}
                      </p>
                    )}
                    {payment.charge_status === 'failed' &&
                      payment.status !== 'paid' && (
                        <p className="mt-1 text-xs font-medium text-red-600">
                          {t('paymentList.chargeFailedShort')}
                        </p>
                      )}
                    {payment.charge_status === 'processing' && (
                      <p className="mt-1 text-xs font-medium text-amber-700">
                        {t('paymentList.chargeInProgress')}
                      </p>
                    )}
                    {payment.refunded_amount > 0 && (
                      <p className="mt-1 text-xs font-medium text-amber-700">
                        {t(
                          payment.refunded_amount >= payment.amount
                            ? 'paymentList.refunded'
                            : 'paymentList.partlyRefunded',
                        )}
                      </p>
                    )}
                    {disputeState(payment.dispute_status) && (
                      <p className="mt-1 text-xs font-medium text-red-600">
                        {t(
                          `paymentList.dispute_${disputeState(payment.dispute_status)}`,
                        )}
                      </p>
                    )}
                  </td>
                  <td>
                    {payment.status === 'paid' ? (
                      <span className="text-sm text-slate-400">
                        {t('common.settled')}
                      </span>
                    ) : payment.charge_status === 'processing' ? null : (
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
        onClose={() => {
          setSelected(null)
          setChargeMessage(null)
        }}
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
            {selected.invoice_email_required && (
              <div>
                <span className="font-medium text-slate-800">
                  {t('paymentList.invoiceEmail')}:
                </span>{' '}
                {invoiceEmailStatusText(selected)}
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
            {selected.stripe_fee !== null && selected.stripe_net !== null && (
              <div>
                <span className="font-medium text-slate-800">
                  {t('paymentList.stripeFee')}:
                </span>{' '}
                {t('paymentList.stripeFeeDetail', {
                  fee: formatCurrency(selected.stripe_fee),
                  net: formatCurrency(selected.stripe_net),
                })}
              </div>
            )}
            {selected.refunded_amount > 0 && (
              <div>
                <span className="font-medium text-slate-800">
                  {t('paymentList.refundedAmount')}:
                </span>{' '}
                {formatCurrency(selected.refunded_amount)}
                {selected.refunded_at
                  ? ` (${formatDate(selected.refunded_at.slice(0, 10))})`
                  : ''}
              </div>
            )}
            {disputeState(selected.dispute_status) && (
              <p className="text-red-600">
                {t(`paymentList.dispute_${disputeState(selected.dispute_status)}`)}
                {selected.dispute_amount !== null
                  ? `: ${formatCurrency(selected.dispute_amount)}`
                  : ''}
                {disputeState(selected.dispute_status) === 'open' &&
                selected.dispute_evidence_due_by
                  ? `. ${t('paymentList.disputeRespondBy', {
                      date: formatDate(
                        selected.dispute_evidence_due_by.slice(0, 10),
                      ),
                    })}`
                  : ''}
              </p>
            )}
            {!!selected.dispute_fee && (
              <div>
                <span className="font-medium text-slate-800">
                  {t('paymentList.disputeFee')}:
                </span>{' '}
                {formatCurrency(selected.dispute_fee)}
              </div>
            )}
            {selected.charged_at && (
              <div>
                <span className="font-medium text-slate-800">
                  {t('paymentList.chargedOn')}:
                </span>{' '}
                {formatDate(selected.charged_at.slice(0, 10))}
              </div>
            )}
            {selected.charge_status === 'failed' &&
              selected.status !== 'paid' && (
                <p className="text-red-600">
                  {t('paymentList.chargeFailed', {
                    reason: selected.charge_error ?? '—',
                  })}{' '}
                  {selected.charge_failure_notified_attempt !==
                  selected.charge_attempts
                    ? t('paymentList.chargeBoarderNotNotified')
                    : selected.charge_retry_not_before
                      ? t('paymentList.chargeRetryFrom', {
                          date: formatDate(selected.charge_retry_not_before),
                        })
                      : t('paymentList.chargeNoMoreRetries')}
                </p>
              )}
            {selected.contract &&
              cardContracts.get(selected.contract.id)?.paused && (
                <p className="text-amber-700">
                  {t('paymentList.chargesPaused')}
                </p>
              )}
            {chargeMessage && (
              <p
                role={chargeMessage.ok ? undefined : 'alert'}
                className={chargeMessage.ok ? 'text-forest' : 'text-red-600'}
              >
                {chargeMessage.text}
              </p>
            )}
            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
              {isStableOwner &&
                selected.status !== 'paid' &&
                selected.contract &&
                cardContracts.has(selected.contract.id) &&
                !cardContracts.get(selected.contract.id)?.paused && (
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={charging}
                    onClick={() => handleCharge(selected)}
                  >
                    {charging
                      ? t('paymentList.charging')
                      : selected.charge_status === 'processing'
                        ? t('paymentList.chargeCheck')
                        : t('paymentList.chargeNow')}
                  </button>
                )}
              {isStableOwner &&
                selected.contract &&
                cardContracts.has(selected.contract.id) && (
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      const contractId = selected.contract?.id
                      if (!contractId) return
                      void handleTogglePause(
                        contractId,
                        !cardContracts.get(contractId)?.paused,
                      )
                    }}
                  >
                    {cardContracts.get(selected.contract.id)?.paused
                      ? t('paymentList.chargesResume')
                      : t('paymentList.chargesPause')}
                  </button>
                )}
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  const id = selected.id
                  setSelected(null)
                  setInvoicePaymentId(id)
                }}
              >
                <Icon name="fileText" className="h-4 w-4" />
                {t('paymentList.viewInvoice')}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <InvoiceView
        paymentId={invoicePaymentId}
        onClose={() => setInvoicePaymentId(null)}
      />
    </div>
  )
}
