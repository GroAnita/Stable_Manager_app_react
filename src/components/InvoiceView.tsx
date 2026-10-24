import { useEffect, useState } from 'react'
import { Badge } from './Badge'
import { Icon } from './Icon'
import { Modal } from './Modal'
import { getPaymentDetail, type PaymentDetail } from '../features/payments/api'
import {
  formatBankAccountNumber,
  parseInvoiceLineItems,
} from '../lib/billing'
import { usePreferences } from '../lib/PreferencesContext'

export function InvoiceFields({ payment }: { payment: PaymentDetail }) {
  const { t, formatCurrency, formatDate } = usePreferences()
  const stable = payment.stable
  const owner = payment.owner
  const lineItems = parseInvoiceLineItems(payment.notes, payment.amount)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          {stable?.logo_url && (
            <img
              src={stable.logo_url}
              alt=""
              className="mb-2 h-12 w-12 rounded-xl object-cover"
            />
          )}
          <h2 className="text-xl font-semibold text-slate-900">
            {stable?.name ?? '—'}
          </h2>
          {stable && (
            <>
              <p className="text-sm text-slate-500">
                {[stable.address, stable.postal_code, stable.city]
                  .filter(Boolean)
                  .join(', ')}
              </p>
              {stable.org_number && (
                <p className="text-sm text-slate-500">
                  {stable.org_number}
                  {stable.vat_registered ? ` ${t('invoice.vatSuffix')}` : ''}
                </p>
              )}
              <p className="text-sm text-slate-500">
                {[stable.phone, stable.email].filter(Boolean).join(' · ')}
              </p>
            </>
          )}
        </div>
        <div className="shrink-0 text-right">
          <h1 className="text-2xl font-bold text-slate-900">
            {t('invoice.title')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {payment.invoice_number ?? '—'}
          </p>
          <div className="mt-2">
            <Badge status={payment.status} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="field-label">{t('invoice.billTo')}</span>
          <p className="font-medium text-slate-900">
            {owner?.full_name ?? '—'}
          </p>
          {owner && (
            <>
              <p className="text-slate-500">
                {[owner.address, owner.postal_code, owner.city]
                  .filter(Boolean)
                  .join(', ')}
              </p>
              <p className="text-slate-500">
                {[owner.phone, owner.email].filter(Boolean).join(' · ')}
              </p>
            </>
          )}
        </div>
        <div>
          <span className="field-label">{t('invoice.horse')}</span>
          <p className="text-slate-900">
            {payment.contract?.horse?.name ?? '—'}
          </p>
          <span className="field-label mt-3 block">
            {t('invoice.issueDate')}
          </span>
          <p className="text-slate-900">{formatDate(payment.created_at)}</p>
          <span className="field-label mt-3 block">
            {t('invoice.dueDate')}
          </span>
          <p className="text-slate-900">{formatDate(payment.due_date)}</p>
        </div>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="py-2 font-medium">{t('invoice.description')}</th>
            <th className="py-2 text-right font-medium">
              {t('invoice.amount')}
            </th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map((item, index) => (
            <tr key={index} className="border-b border-slate-100">
              <td className="py-2 text-slate-700">{item.description}</td>
              <td className="py-2 text-right text-slate-700">
                {formatCurrency(item.amount)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="pt-3 font-semibold text-slate-900">
              {t('invoice.total')}
            </td>
            <td className="pt-3 text-right font-semibold text-slate-900">
              {formatCurrency(payment.amount)}
            </td>
          </tr>
        </tfoot>
      </table>

      {stable && (
        <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
          <h3 className="mb-2 text-sm font-semibold text-slate-800">
            {t('invoice.paymentInfo')}
          </h3>
          {stable.bank_account_number && (
            <p>
              {t('invoice.bankAccount')}:{' '}
              {formatBankAccountNumber(stable.bank_account_number)}
            </p>
          )}
          <p>
            {t('invoice.paymentTerms')}:{' '}
            {t('invoice.daysNet', { days: stable.payment_terms_days })}
          </p>
          {payment.invoice_number && (
            <p>
              {t('invoice.reference')}: {payment.invoice_number}
            </p>
          )}
        </div>
      )}

      {stable?.invoice_footer_text && (
        <p className="whitespace-pre-wrap text-xs text-slate-400">
          {stable.invoice_footer_text}
        </p>
      )}
    </div>
  )
}

export function InvoiceView({
  paymentId,
  onClose,
}: {
  paymentId: string | null
  onClose: () => void
}) {
  const { t } = usePreferences()
  const [payment, setPayment] = useState<PaymentDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const loading = paymentId !== null && payment?.id !== paymentId && !error

  useEffect(() => {
    if (!paymentId) return
    let cancelled = false
    getPaymentDetail(paymentId)
      .then((data) => {
        if (!cancelled) {
          setPayment(data)
          setError(null)
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [paymentId])

  function handleClose() {
    setPayment(null)
    setError(null)
    onClose()
  }

  return (
    <>
      <Modal
        open={paymentId !== null}
        onClose={handleClose}
        title={t('invoice.title')}
        size="lg"
      >
        {loading && (
          <p className="text-sm text-slate-500">{t('invoice.loading')}</p>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {t('invoice.failedToLoad', { error })}
          </p>
        )}
        {payment && payment.id === paymentId && (
          <>
            <div className="mb-4 flex justify-end">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => window.print()}
              >
                <Icon name="fileText" className="h-4 w-4" />
                {t('invoice.print')}
              </button>
            </div>
            <InvoiceFields payment={payment} />
          </>
        )}
      </Modal>

      {payment && payment.id === paymentId && (
        <div className="print-area hidden print:block">
          <InvoiceFields payment={payment} />
        </div>
      )}
    </>
  )
}
