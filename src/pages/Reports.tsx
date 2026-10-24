import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Card } from '../components/Card'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import {
  listActiveContractAllocations,
  type ContractAllocation,
} from '../features/contracts/api'
import {
  createExpense,
  deleteExpense,
  listExpenses,
  type Expense,
} from '../features/expenses/api'
import { listPayments, type PaymentListItem } from '../features/payments/api'
import {
  listPriceListItems,
  type PriceListItem,
} from '../features/priceList/api'
import { useAuth } from '../lib/AuthContext'
import { usePreferences } from '../lib/PreferencesContext'
import { monthRange, usageByCategory } from '../lib/reports'

const EXPENSE_CATEGORIES = [
  'Feed',
  'Bedding',
  'Veterinary',
  'Farrier',
  'Maintenance',
  'Insurance',
  'Other',
]

function categoryLabel(
  t: (key: string) => string,
  value: string | null,
): string {
  if (!value) return '—'
  const key = `category.${value.toLowerCase()}`
  const translated = t(key)
  return translated === key ? value : translated
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

type ExpenseFormState = {
  category: string
  amount: string
  expense_date: string
  notes: string
}

function emptyExpenseForm(): ExpenseFormState {
  return { category: '', amount: '', expense_date: todayIso(), notes: '' }
}

export default function Reports() {
  const { t, formatCurrency, formatDate, language } = usePreferences()
  const { profile } = useAuth()

  const [cursor, setCursor] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })

  const [allocations, setAllocations] = useState<ContractAllocation[]>([])
  const [priceListItems, setPriceListItems] = useState<PriceListItem[]>([])
  const [payments, setPayments] = useState<PaymentListItem[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState<ExpenseFormState>(emptyExpenseForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const { from, to, days } = useMemo(
    () => monthRange(cursor.year, cursor.month),
    [cursor],
  )

  useEffect(() => {
    let cancelled = false
    Promise.all([
      listActiveContractAllocations(),
      listPriceListItems(),
      listPayments(),
      listExpenses(from, to),
    ])
      .then(([allocationsData, priceListData, paymentsData, expensesData]) => {
        if (cancelled) return
        setAllocations(allocationsData)
        setPriceListItems(priceListData)
        setPayments(paymentsData)
        setExpenses(expensesData)
        setError(null)
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
  }, [from, to])

  const hayLines = useMemo(
    () => usageByCategory('Hay', priceListItems, allocations, days),
    [priceListItems, allocations, days],
  )
  const beddingLines = useMemo(
    () => usageByCategory('Bedding', priceListItems, allocations, days),
    [priceListItems, allocations, days],
  )

  const invoiced = useMemo(
    () =>
      payments
        .filter((p) => p.due_date >= from && p.due_date <= to)
        .reduce((sum, p) => sum + p.amount, 0),
    [payments, from, to],
  )
  const collected = useMemo(
    () =>
      payments
        .filter(
          (p) =>
            p.status === 'paid' &&
            p.paid_date &&
            p.paid_date >= from &&
            p.paid_date <= to,
        )
        .reduce((sum, p) => sum + p.amount, 0),
    [payments, from, to],
  )
  const expensesTotal = useMemo(
    () => expenses.reduce((sum, e) => sum + e.amount, 0),
    [expenses],
  )
  const net = collected - expensesTotal

  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString(
    language === 'no' ? 'nb-NO' : 'en-US',
    { month: 'long', year: 'numeric' },
  )

  function goToPreviousMonth() {
    setCursor(({ year, month }) =>
      month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 },
    )
  }

  function goToNextMonth() {
    setCursor(({ year, month }) =>
      month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 },
    )
  }

  function openAdd() {
    setForm(emptyExpenseForm())
    setFormError(null)
    setAddOpen(true)
  }

  async function handleAddExpense(event: FormEvent) {
    event.preventDefault()
    if (!profile?.stable_id) return
    setSaving(true)
    setFormError(null)
    try {
      const created = await createExpense({
        stable_id: profile.stable_id,
        category: form.category || null,
        amount: Number(form.amount),
        expense_date: form.expense_date,
        notes: form.notes || null,
      })
      if (created.expense_date >= from && created.expense_date <= to) {
        setExpenses((prev) =>
          [created, ...prev].sort((a, b) =>
            b.expense_date.localeCompare(a.expense_date),
          ),
        )
      } else {
        // The expense falls outside the month currently shown — jump to
        // its month so it's visible immediately instead of appearing to
        // have silently failed.
        const [year, month] = created.expense_date.split('-').map(Number)
        setCursor({ year, month: month - 1 })
      }
      setAddOpen(false)
    } catch (err) {
      setFormError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteExpense(id: string) {
    if (!window.confirm(t('reports.confirmDeleteExpense'))) return
    try {
      await deleteExpense(id)
      setExpenses((prev) => prev.filter((e) => e.id !== id))
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="page-shell print-area">
      <div className="page-header print:hidden">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">
            {t('reports.title')}
          </h1>
          <p className="mt-2 text-sm text-slate-500">{t('reports.subtitle')}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-ghost p-2"
            aria-label={t('reports.previousMonth')}
            onClick={goToPreviousMonth}
          >
            <Icon name="chevronLeft" className="h-4 w-4" />
          </button>
          <p className="min-w-40 text-center text-lg font-semibold text-slate-900 capitalize">
            {monthLabel}
          </p>
          <button
            type="button"
            className="btn-ghost p-2"
            aria-label={t('reports.nextMonth')}
            onClick={goToNextMonth}
          >
            <Icon name="chevronRight" className="h-4 w-4" />
          </button>
        </div>
        <button type="button" className="btn-primary" onClick={() => window.print()}>
          <Icon name="fileText" className="h-4 w-4" />
          {t('reports.print')}
        </button>
      </div>

      <h2 className="hidden text-xl font-semibold text-slate-900 capitalize print:block">
        {monthLabel}
      </h2>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {t('reports.failedToLoad', { error })}
        </p>
      )}
      {loading && (
        <p className="text-sm text-slate-500">{t('reports.loading')}</p>
      )}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card
              label={t('reports.invoiced')}
              value={formatCurrency(invoiced)}
              icon={<Icon name="fileText" className="h-4 w-4" />}
            />
            <Card
              label={t('reports.collected')}
              value={formatCurrency(collected)}
              icon={<Icon name="dollar" className="h-4 w-4" />}
            />
            <Card
              label={t('reports.expensesTotal')}
              value={formatCurrency(expensesTotal)}
              icon={<Icon name="box" className="h-4 w-4" />}
            />
            <Card
              label={t('reports.net')}
              value={formatCurrency(net)}
              icon={<Icon name="chart" className="h-4 w-4" />}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="panel p-5">
              <h3 className="section-title">{t('reports.hayUsed')}</h3>
              {hayLines.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">
                  {t('reports.noUsageData')}
                </p>
              ) : (
                <ul className="mt-2 space-y-1 text-sm text-slate-700">
                  {hayLines.map((line) => (
                    <li key={line.item.id} className="flex justify-between">
                      <span>{line.item.item}</span>
                      <span>
                        {line.quantity} {line.item.unit ?? ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="panel p-5">
              <h3 className="section-title">{t('reports.beddingUsed')}</h3>
              {beddingLines.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">
                  {t('reports.noUsageData')}
                </p>
              ) : (
                <ul className="mt-2 space-y-1 text-sm text-slate-700">
                  {beddingLines.map((line) => (
                    <li key={line.item.id} className="flex justify-between">
                      <span>{line.item.item}</span>
                      <span>
                        {line.quantity} {line.item.unit ?? ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          {(hayLines.length > 0 || beddingLines.length > 0) && (
            <p className="text-xs text-slate-400">{t('reports.estimateNote')}</p>
          )}

          <div className="panel p-5">
            <div className="flex items-center justify-between">
              <h3 className="section-title">{t('reports.expensesTitle')}</h3>
              <button
                type="button"
                className="btn-ghost print:hidden"
                onClick={openAdd}
              >
                <Icon name="plus" className="h-4 w-4" />
                {t('reports.addExpense')}
              </button>
            </div>
            {expenses.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                {t('reports.noExpenses')}
              </p>
            ) : (
              <div className="table-wrap mt-3">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('reports.expenseDate')}</th>
                      <th>{t('reports.expenseCategory')}</th>
                      <th>{t('reports.expenseNotes')}</th>
                      <th className="text-right">{t('reports.expenseAmount')}</th>
                      <th className="print:hidden"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((expense) => (
                      <tr key={expense.id}>
                        <td>{formatDate(expense.expense_date)}</td>
                        <td>{categoryLabel(t, expense.category)}</td>
                        <td>{expense.notes ?? '—'}</td>
                        <td className="text-right">
                          {formatCurrency(expense.amount)}
                        </td>
                        <td className="text-right print:hidden">
                          <button
                            type="button"
                            className="btn-ghost px-2 py-1"
                            aria-label={t('common.delete')}
                            onClick={() => handleDeleteExpense(expense.id)}
                          >
                            <Icon name="trash" className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={t('reports.addExpense')}
      >
        <form onSubmit={handleAddExpense} className="space-y-4">
          {formError && (
            <p role="alert" className="text-sm text-red-600">
              {formError}
            </p>
          )}
          <label>
            <span className="field-label">{t('reports.expenseCategory')}</span>
            <select
              className="field"
              value={form.category}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, category: e.target.value }))
              }
            >
              <option value="">{t('priceList.uncategorized')}</option>
              {EXPENSE_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {categoryLabel(t, value)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="field-label">{t('reports.expenseAmount')}</span>
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              className="field"
              value={form.amount}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, amount: e.target.value }))
              }
            />
          </label>
          <label>
            <span className="field-label">{t('reports.expenseDate')}</span>
            <input
              required
              type="date"
              className="field"
              value={form.expense_date}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, expense_date: e.target.value }))
              }
            />
          </label>
          <label>
            <span className="field-label">{t('reports.expenseNotes')}</span>
            <input
              className="field"
              value={form.notes}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, notes: e.target.value }))
              }
            />
          </label>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setAddOpen(false)}
            >
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
