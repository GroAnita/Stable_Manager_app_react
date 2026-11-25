import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '../../components/Badge'
import {
  listPaymentsNeedingAttention,
  type OverduePayment,
  type UpcomingPayment,
} from '../../features/dashboard/api'
import {
  listUpcomingBills,
  setExpensePaid,
  type Expense,
} from '../../features/expenses/api'
import { BILL_REMINDER_WINDOW_DAYS, daysUntilDue } from '../../lib/bills'
import { usePreferences } from '../../lib/PreferencesContext'
import { categoryLabel } from '../../lib/reports'

// What needs looking at, at the top of the payments page: invoices to horse owners
// that are overdue or due soon, and the stable's own bills due in the next 30 days.
// Hidden when there's nothing.
export function AttentionPanel() {
  const { t, formatCurrency, formatDate } = usePreferences()
  const [payments, setPayments] = useState<
    (UpcomingPayment | OverduePayment)[] | null
  >(null)
  const [bills, setBills] = useState<Expense[] | null>(null)
  const [markingBill, setMarkingBill] = useState<string | null>(null)
  const [billError, setBillError] = useState<string | null>(null)

  async function handleBillPaid(id: string) {
    setMarkingBill(id)
    setBillError(null)
    try {
      await setExpensePaid(id, true)
      setBills((prev) => prev?.filter((bill) => bill.id !== id) ?? prev)
    } catch (err) {
      setBillError((err as Error).message)
    } finally {
      setMarkingBill(null)
    }
  }

  useEffect(() => {
    let cancelled = false
    Promise.all([listPaymentsNeedingAttention(), listUpcomingBills()])
      .then(([paymentList, billList]) => {
        if (cancelled) return
        setPayments(paymentList)
        setBills(billList)
      })
      .catch(() => {
        if (!cancelled) {
          setPayments([])
          setBills([])
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!payments || !bills) return null
  if (payments.length === 0 && bills.length === 0) return null

  return (
    <section className="grid gap-6 xl:grid-cols-2">
      <div className="panel p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="section-title">
            {t('dashboard.paymentsNeedingAttention')}
          </h2>
        </div>
        {payments.length === 0 ? (
          <p className="text-sm text-slate-500">
            {t('dashboard.nothingDueOrOverdue')}
          </p>
        ) : (
          <div className="space-y-3">
            {payments.map((payment) => (
              <div
                key={payment.id}
                className="flex items-start justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-slate-800">
                    {payment.horse_name}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {formatCurrency(payment.amount ?? 0)} · {t('dashboard.due')}{' '}
                    {formatDate(payment.due_date)}
                  </p>
                </div>
                {payment.status && <Badge status={payment.status} />}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="section-title">{t('dashboard.billsToPay')}</h2>
          <span className="text-sm text-slate-400">
            {t('dashboard.next30Days')}
          </span>
        </div>
        {billError && (
          <p role="alert" className="mb-3 text-sm text-red-600">
            {billError}
          </p>
        )}
        {bills.length === 0 ? (
          <p className="text-sm text-slate-500">
            {t('dashboard.nothingBillsDue')}
          </p>
        ) : (
          <div className="space-y-3">
            {bills.map((bill) => {
              const days = daysUntilDue(bill.expense_date)
              const dueLabel =
                days <= 0
                  ? t('dashboard.billDueToday')
                  : days === 1
                    ? t('dashboard.billDueTomorrow')
                    : t('dashboard.billDueInDays', { count: days })
              return (
                <div
                  key={bill.id}
                  className="flex items-start justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-slate-800">
                      {categoryLabel(t, bill.category)}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {formatCurrency(bill.amount)}
                      {bill.notes ? ` · ${bill.notes}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <Badge
                      status={
                        days <= BILL_REMINDER_WINDOW_DAYS ? 'high' : 'due soon'
                      }
                      label={dueLabel}
                    />
                    <button
                      type="button"
                      className="btn-ghost px-3 py-1.5 text-sm"
                      disabled={markingBill === bill.id}
                      onClick={() => handleBillPaid(bill.id)}
                    >
                      {markingBill === bill.id
                        ? t('paymentList.marking')
                        : t('common.markPaid')}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <Link
          to="/reports"
          className="mt-4 inline-block text-sm font-medium text-forest hover:underline"
        >
          {t('dashboard.viewAllBills')}
        </Link>
      </div>
    </section>
  )
}
