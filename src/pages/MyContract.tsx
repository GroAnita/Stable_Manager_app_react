import { invoiceAmountDue } from '../lib/billing'
import { useCallback, useEffect, useState } from 'react'
import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'
import { Badge } from '../components/Badge'
import { ContractFields } from '../components/ContractView'
import { EmptyState } from '../components/EmptyState'
import {
  getActiveContractForHorse,
  getContractDetail,
  type ContractDetail,
} from '../features/contracts/api'
import { listMyHorses } from '../features/horses/api'
import { listPayments, type PaymentListItem } from '../features/payments/api'
import {
  canPayInvoicesOnline,
  startInvoicePayment,
  syncInvoicePayment,
} from '../features/payments/pay'
import { usePreferences } from '../lib/PreferencesContext'
import { CardAgreementPanel } from './myContract/CardAgreementPanel'

export default function MyContract() {
  const { t, formatCurrency, formatDate } = usePreferences()
  const [contracts, setContracts] = useState<ContractDetail[]>([])
  const [payments, setPayments] = useState<PaymentListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [canPay, setCanPay] = useState(false)
  const [paying, setPaying] = useState<string | null>(null)
  const [payError, setPayError] = useState<string | null>(null)

  // Picks up a payment finished on Stripe's page, since the webhook can arrive
  // after the boarder is back here. A failure just leaves the list as it was.
  const refreshPayments = useCallback(async () => {
    const list = await listPayments()
    const inProgress = list.filter((p) => p.charge_status === 'processing')
    if (inProgress.length === 0) {
      setPayments(list)
      return
    }
    await Promise.allSettled(inProgress.map((p) => syncInvoicePayment(p.id)))
    setPayments(await listPayments())
  }, [])

  useEffect(() => {
    canPayInvoicesOnline()
      .then(setCanPay)
      .catch(() => setCanPay(false))
    void refreshPayments().catch(() => undefined)
  }, [refreshPayments])

  // In the iOS app Stripe's page opens in an in-app browser, so re-check when
  // the user closes it instead of relying on a redirect back to this page.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const listener = Browser.addListener('browserFinished', () => {
      void refreshPayments().catch(() => undefined)
    })
    return () => {
      void listener.then((handle) => handle.remove())
    }
  }, [refreshPayments])

  async function handlePay(paymentId: string) {
    setPaying(paymentId)
    setPayError(null)
    try {
      const result = await startInvoicePayment(paymentId)
      if (result.url) {
        if (Capacitor.isNativePlatform()) {
          await Browser.open({ url: result.url })
          setPaying(null)
        } else {
          window.location.assign(result.url)
        }
        return
      }
      if (result.blocked) {
        setPayError(t('myContract.payBlocked'))
      }
      await refreshPayments()
      setPaying(null)
    } catch (err) {
      setPayError((err as Error).message)
      setPaying(null)
    }
  }

  useEffect(() => {
    let cancelled = false
    Promise.all([listMyHorses(), listPayments()])
      .then(async ([horses, paymentsData]) => {
        const activeContracts = await Promise.all(
          horses.map((horse) => getActiveContractForHorse(horse.id)),
        )
        const details = await Promise.all(
          activeContracts
            .filter((c): c is NonNullable<typeof c> => c !== null)
            .map((c) => getContractDetail(c.id)),
        )
        if (!cancelled) {
          setContracts(details)
          setPayments(paymentsData)
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

  return (
    <div className="page-shell">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">
          {t('myContract.title')}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {t('myContract.subtitle')}
        </p>
      </div>

      {loading && (
        <p className="text-sm text-slate-500">{t('myContract.loading')}</p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {t('myContract.failedToLoad', { error })}
        </p>
      )}
      {!loading && !error && contracts.length === 0 && (
        <EmptyState
          title={t('myContract.noContractTitle')}
          message={t('myContract.noContractMessage')}
        />
      )}

      {contracts.map((contract) => (
        <div key={contract.id} className="panel p-6">
          <ContractFields contract={contract} />
          <CardAgreementPanel contractId={contract.id} />
        </div>
      ))}

      <div className="panel p-6">
        <h2 className="section-title">{t('myContract.invoices')}</h2>
        {payError && (
          <p role="alert" className="mt-3 text-sm text-red-600">
            {payError}
          </p>
        )}
        {payments.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            {t('myContract.noInvoices')}
          </p>
        ) : (
          <div className="table-wrap mt-4">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('myContract.invoiceNumber')}</th>
                  <th>{t('myContract.dueDate')}</th>
                  <th>{t('myContract.amount')}</th>
                  <th>{t('myContract.status')}</th>
                  {canPay && <th>{t('myContract.actions')}</th>}
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{payment.invoice_number ?? '—'}</td>
                    <td>{formatDate(payment.due_date)}</td>
                    <td>
                      {formatCurrency(payment.amount)}
                      {payment.credited_amount > 0 && (
                        <p className="mt-1 text-xs text-slate-500">
                          {t('myContract.creditedAmount', {
                            amount: formatCurrency(payment.credited_amount),
                          })}
                        </p>
                      )}
                    </td>
                    <td>
                      <Badge status={payment.status} />
                      {payment.refunded_amount > 0 && (
                        <p className="mt-1 text-xs text-slate-500">
                          {t('myContract.refundedAmount', {
                            amount: formatCurrency(payment.refunded_amount),
                          })}
                        </p>
                      )}
                    </td>
                    {canPay && (
                      <td>
                        {payment.status !== 'paid' &&
                          invoiceAmountDue(payment) > 0 && (
                          <button
                            type="button"
                            className="btn-secondary"
                            disabled={paying === payment.id}
                            onClick={() => handlePay(payment.id)}
                          >
                            {paying === payment.id
                              ? t('myContract.payOpening')
                              : t('myContract.payNow')}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
