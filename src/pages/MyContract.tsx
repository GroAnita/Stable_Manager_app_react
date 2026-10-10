import { useEffect, useState } from 'react'
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
import { usePreferences } from '../lib/PreferencesContext'

export default function MyContract() {
  const { t, formatCurrency, formatDate } = usePreferences()
  const [contracts, setContracts] = useState<ContractDetail[]>([])
  const [payments, setPayments] = useState<PaymentListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
        </div>
      ))}

      <div className="panel p-6">
        <h2 className="section-title">{t('myContract.invoices')}</h2>
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
                  <th>{t('myContract.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{payment.invoice_number ?? '—'}</td>
                    <td>{formatDate(payment.due_date)}</td>
                    <td>{formatCurrency(payment.amount)}</td>
                    <td>
                      <Badge status={payment.status} />
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={payment.status === 'paid'}
                          className="btn-secondary disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {t('myContract.payWithCard')}
                        </button>
                        <button
                          type="button"
                          disabled={payment.status === 'paid'}
                          className="rounded-xl bg-[#ff5b24] px-3 py-2 text-sm font-semibold text-white hover:bg-[#e54f1d] disabled:cursor-not-allowed disabled:bg-[#ff5b24] disabled:opacity-40 disabled:hover:bg-[#ff5b24]"
                        >
                          {t('myContract.payWithVipps')}
                        </button>
                      </div>
                    </td>
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
