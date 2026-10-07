import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { Modal } from '../../components/Modal'
import {
  logFeedingExtra,
  parseFeedingExtras,
  removeFeedingExtra,
  type FeedingExtraEntry,
  type FeedingPlan,
} from '../../features/horses/api'
import { getPayment } from '../../features/payments/api'
import {
  listPriceListItems,
  type PriceListItem,
} from '../../features/priceList/api'
import { amountIncVat, billingCycleDueDate } from '../../lib/billing'
import { usePreferences } from '../../lib/PreferencesContext'

const FEED_CATEGORIES = ['Hay', 'Grain', 'Supplements']

type ExtraFormState = {
  priceListItemId: string
  quantity: string
  date: string
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function FeedingExtras({
  horseId,
  stableId,
  plan,
  onPlanSaved,
}: {
  horseId: string
  stableId: string
  plan: FeedingPlan | null
  onPlanSaved: (plan: FeedingPlan) => void
}) {
  const { t, formatCurrency, formatDate } = usePreferences()

  const extras = parseFeedingExtras(plan?.extras ?? null)

  const [extraOpen, setExtraOpen] = useState(false)
  const [extraItems, setExtraItems] = useState<PriceListItem[]>([])
  const [extraForm, setExtraForm] = useState<ExtraFormState>({
    priceListItemId: '',
    quantity: '1',
    date: todayIso(),
  })
  const [extraSaving, setExtraSaving] = useState(false)
  const [extraError, setExtraError] = useState<string | null>(null)
  const [extraMessage, setExtraMessage] = useState<string | null>(null)

  async function openExtra() {
    setExtraError(null)
    setExtraMessage(null)
    const items = await listPriceListItems()
    const feedItems = items.filter((item) =>
      FEED_CATEGORIES.includes(item.category ?? ''),
    )
    setExtraItems(feedItems)
    setExtraForm({
      priceListItemId: feedItems[0]?.id ?? '',
      quantity: '1',
      date: todayIso(),
    })
    setExtraOpen(true)
  }

  function updateExtraField<K extends keyof ExtraFormState>(
    key: K,
    value: ExtraFormState[K],
  ) {
    setExtraForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleExtraSubmit(event: FormEvent) {
    event.preventDefault()
    if (!extraForm.priceListItemId) return
    setExtraSaving(true)
    setExtraError(null)
    try {
      const { plan: updatedPlan, message } = await logFeedingExtra({
        horseId,
        stableId,
        priceListItemId: extraForm.priceListItemId,
        quantity: Number(extraForm.quantity) || 0,
        date: extraForm.date,
        extras,
        t,
        formatCurrency,
        formatDate,
      })
      onPlanSaved(updatedPlan)
      setExtraMessage(message)
      setExtraOpen(false)
    } catch (err) {
      setExtraError(
        t('horseDetail.extraLogError', { error: (err as Error).message }),
      )
    } finally {
      setExtraSaving(false)
    }
  }

  async function handleRemoveExtra(entry: FeedingExtraEntry) {
    const payment = await getPayment(entry.paymentId)
    const confirmed = window.confirm(
      payment
        ? t('horseDetail.extraRemoveConfirmWithPayment', {
            amount: formatCurrency(entry.amount),
            date: formatDate(payment.due_date),
          })
        : t('horseDetail.extraRemoveConfirmPlain'),
    )
    if (!confirmed) return
    const updatedPlan = await removeFeedingExtra({
      horseId,
      stableId,
      entry,
      extras,
    })
    onPlanSaved(updatedPlan)
    setExtraMessage(null)
  }

  const selectedExtraItem = extraItems.find(
    (item) => item.id === extraForm.priceListItemId,
  )
  const estimatedExtraAmount = selectedExtraItem
    ? amountIncVat(selectedExtraItem.price, Number(extraForm.quantity) || 0)
    : 0
  const estimatedExtraDueDate = billingCycleDueDate(
    extraForm.date || todayIso(),
  )

  return (
    <div className="mt-8 border-t border-slate-100 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">
            {t('horseDetail.extraFeedTitle')}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {t('horseDetail.extraFeedDescription')}
          </p>
        </div>
        <button type="button" className="btn-ghost" onClick={openExtra}>
          <Icon name="plus" className="h-4 w-4" />
          {t('horseDetail.logExtraFeed')}
        </button>
      </div>

      {extraMessage && (
        <p className="mt-3 text-sm text-forest">{extraMessage}</p>
      )}

      <div className="mt-3 space-y-2">
        {extras.length === 0 ? (
          <p className="text-sm text-slate-500">
            {t('horseDetail.noExtrasLogged')}
          </p>
        ) : (
          extras.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 p-3"
            >
              <div>
                <p className="font-medium text-slate-900">
                  {entry.item}
                  {entry.category && (
                    <span className="ml-1 text-xs font-normal text-slate-400">
                      ({entry.category})
                    </span>
                  )}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {entry.quantity}
                  {entry.unit ? ` ${entry.unit}` : ''} ·{' '}
                  {formatCurrency(entry.amount)} · {formatDate(entry.date)}
                </p>
              </div>
              <button
                type="button"
                className="btn-ghost px-3 py-2"
                onClick={() => handleRemoveExtra(entry)}
              >
                {t('common.remove')}
              </button>
            </div>
          ))
        )}
      </div>

      <Modal
        open={extraOpen}
        onClose={() => setExtraOpen(false)}
        title={t('horseDetail.logExtraFeed')}
      >
        {extraError && (
          <p role="alert" className="mb-4 text-sm text-red-600">
            {extraError}
          </p>
        )}
        {extraItems.length === 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              {t('horseDetail.extraEmptyCategories')}
            </p>
            <Link
              to="/price-list"
              className="btn-primary inline-flex"
              onClick={() => setExtraOpen(false)}
            >
              {t('horseDetail.goToPriceList')}
            </Link>
          </div>
        ) : (
          <form onSubmit={handleExtraSubmit} className="grid gap-4">
            <label>
              <span className="field-label">{t('horseDetail.extraItem')}</span>
              <select
                required
                className="field"
                value={extraForm.priceListItemId}
                onChange={(e) =>
                  updateExtraField('priceListItemId', e.target.value)
                }
              >
                {FEED_CATEGORIES.map((category) => {
                  const categoryItems = extraItems.filter(
                    (item) => item.category === category,
                  )
                  if (categoryItems.length === 0) return null
                  return (
                    <optgroup key={category} label={category}>
                      {categoryItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.item} ({formatCurrency(amountIncVat(item.price, 1))}
                          {item.unit ? ` / ${item.unit}` : ''})
                        </option>
                      ))}
                    </optgroup>
                  )
                })}
              </select>
            </label>
            <label>
              <span className="field-label">
                {t('horseDetail.extraQuantity')}
              </span>
              <input
                required
                type="number"
                step="0.01"
                min="0.01"
                className="field"
                value={extraForm.quantity}
                onChange={(e) => updateExtraField('quantity', e.target.value)}
              />
            </label>
            <label>
              <span className="field-label">{t('horseDetail.extraDate')}</span>
              <input
                required
                type="date"
                className="field"
                value={extraForm.date}
                onChange={(e) => updateExtraField('date', e.target.value)}
              />
            </label>
            <p className="text-sm text-slate-500">
              {t('horseDetail.extraEstimatedCharge')}{' '}
              <span className="font-medium text-slate-800">
                {formatCurrency(estimatedExtraAmount)}
              </span>
            </p>
            <p className="text-xs text-slate-400">
              {t('horseDetail.extraBilledOn', {
                date: formatDate(estimatedExtraDueDate),
              })}
            </p>
            <button
              type="submit"
              disabled={extraSaving}
              className="btn-primary"
            >
              {extraSaving ? t('common.saving') : t('horseDetail.extraSubmit')}
            </button>
          </form>
        )}
      </Modal>
    </div>
  )
}
