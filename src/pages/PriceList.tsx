import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import {
  createPriceListItems,
  deletePriceListItem,
  listPriceListItems,
  updatePriceListItem,
  type PriceListItem,
} from '../features/priceList/api'
import { usePreferences } from '../lib/PreferencesContext'
import { unitLabel } from '../lib/reports'
import { getCurrentStableId } from '../lib/stableContext'

const UNIT_OPTIONS = [
  'per month',
  'per week',
  'per day',
  'per visit',
  'one-time',
  'Kg',
  'Litre',
  'Bag',
  'Box',
  'Other',
]

const CATEGORY_OPTIONS = [
  'Boarding',
  'EmptyBox',
  'RidingLessons',
  'RidingCourses',
  'Hay',
  'Grain',
  'Supplements',
  'Veterinary',
  'Farrier',
  'Bedding',
  'Mucking',
  'Other',
]

type FormState = {
  item: string
  category: string
  unit: string
  price: string
  notes: string
  vat_exempt: boolean
}

type AddDraft = {
  key: number
  form: FormState
}

const emptyForm: FormState = {
  item: '',
  category: '',
  unit: '',
  price: '',
  notes: '',
  vat_exempt: false,
}

function toFormState(item: PriceListItem): FormState {
  return {
    item: item.item,
    category: item.category ?? '',
    unit: item.unit ?? '',
    price: item.price.toString(),
    notes: item.notes ?? '',
    vat_exempt: item.vat_exempt,
  }
}

function categoryLabel(
  t: (key: string) => string,
  value: string | null,
): string {
  if (!value) return '—'
  const key = `category.${value.toLowerCase()}`
  const translated = t(key)
  return translated === key ? value : translated
}

function ItemFields({
  form,
  onChange,
  autoFocus = false,
}: {
  form: FormState
  onChange: <K extends keyof FormState>(key: K, value: FormState[K]) => void
  autoFocus?: boolean
}) {
  const { t } = usePreferences()
  return (
    <div className="grid gap-4">
      <label>
        <span className="field-label">{t('priceList.itemName')}</span>
        <input
          required
          autoFocus={autoFocus}
          className="field"
          value={form.item}
          onChange={(e) => onChange('item', e.target.value)}
        />
      </label>
      <label>
        <span className="field-label">{t('priceList.category')}</span>
        <select
          className="field"
          value={form.category}
          onChange={(e) => onChange('category', e.target.value)}
        >
          <option value="">{t('priceList.uncategorized')}</option>
          {CATEGORY_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {categoryLabel(t, value)}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="field-label">{t('priceList.unit')}</span>
        <select
          className="field"
          value={form.unit}
          onChange={(e) => onChange('unit', e.target.value)}
        >
          <option value="">{t('priceList.noUnit')}</option>
          {UNIT_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {unitLabel(t, value)}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="field-label">{t('priceList.price')}</span>
        <input
          required
          type="number"
          step="0.01"
          min="0"
          className="field"
          value={form.price}
          onChange={(e) => onChange('price', e.target.value)}
        />
      </label>
      <label>
        <span className="field-label">{t('priceList.notes')}</span>
        <textarea
          className="field min-h-24"
          value={form.notes}
          onChange={(e) => onChange('notes', e.target.value)}
        />
      </label>
      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          className="mt-1"
          checked={form.vat_exempt}
          onChange={(e) => onChange('vat_exempt', e.target.checked)}
        />
        <span>
          <span className="block text-sm font-medium text-slate-700">
            {t('priceList.vatExempt')}
          </span>
          <span className="block text-xs text-slate-400">
            {t('priceList.vatExemptHint')}
          </span>
        </span>
      </label>
    </div>
  )
}

export default function PriceList() {
  const { t, formatCurrency } = usePreferences()
  const [items, setItems] = useState<PriceListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState('all')

  const [addOpen, setAddOpen] = useState(false)
  const nextDraftKey = useRef(1)
  const [addDrafts, setAddDrafts] = useState<AddDraft[]>([
    { key: 0, form: emptyForm },
  ])
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const [editing, setEditing] = useState<PriceListItem | null>(null)
  const [editForm, setEditForm] = useState<FormState>(emptyForm)
  const [editSaving, setEditSaving] = useState(false)

  function refetch() {
    setLoading(true)
    listPriceListItems()
      .then(setItems)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    listPriceListItems()
      .then(setItems)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(
    () =>
      categoryFilter === 'all'
        ? items
        : items.filter((item) => item.category === categoryFilter),
    [items, categoryFilter],
  )

  function updateDraftField<K extends keyof FormState>(
    draftKey: number,
    key: K,
    value: FormState[K],
  ) {
    setAddDrafts((prev) =>
      prev.map((draft) =>
        draft.key === draftKey
          ? { ...draft, form: { ...draft.form, [key]: value } }
          : draft,
      ),
    )
  }

  function addDraft() {
    const key = nextDraftKey.current++
    setAddDrafts((prev) => [...prev, { key, form: emptyForm }])
  }

  function removeDraft(draftKey: number) {
    setAddDrafts((prev) => prev.filter((draft) => draft.key !== draftKey))
  }

  async function handleAddSubmit(event: FormEvent) {
    event.preventDefault()
    setAddSaving(true)
    setAddError(null)
    try {
      const stableId = await getCurrentStableId()
      if (!stableId) throw new Error(t('priceList.noStableFound'))
      await createPriceListItems(
        addDrafts.map(({ form }) => ({
          item: form.item,
          category: form.category || null,
          unit: form.unit || null,
          price: Number(form.price) || 0,
          notes: form.notes || null,
          vat_exempt: form.vat_exempt,
          stable_id: stableId,
        })),
      )
      setAddOpen(false)
      setAddDrafts([{ key: nextDraftKey.current++, form: emptyForm }])
      refetch()
    } catch (err) {
      // Nothing was saved, so keep the form open with everything still filled in.
      setAddError((err as Error).message)
    } finally {
      setAddSaving(false)
    }
  }

  function openEdit(item: PriceListItem) {
    setEditing(item)
    setEditForm(toFormState(item))
  }

  function updateEditField<K extends keyof FormState>(
    key: K,
    value: FormState[K],
  ) {
    setEditForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleEditSubmit(event: FormEvent) {
    event.preventDefault()
    if (!editing) return
    setEditSaving(true)
    try {
      await updatePriceListItem(editing.id, {
        item: editForm.item,
        category: editForm.category || null,
        unit: editForm.unit || null,
        price: Number(editForm.price) || 0,
        notes: editForm.notes || null,
        vat_exempt: editForm.vat_exempt,
      })
      setEditing(null)
      refetch()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setEditSaving(false)
    }
  }

  async function handleDelete() {
    if (!editing) return
    if (!window.confirm(t('priceList.confirmDelete', { name: editing.item })))
      return
    await deletePriceListItem(editing.id)
    setEditing(null)
    refetch()
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">
            {t('priceList.title')}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {t('priceList.subtitle')}
          </p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => setAddOpen(true)}
        >
          <Icon name="plus" className="h-4 w-4" />
          {t('priceList.addItem')}
        </button>
      </div>

      <div className="panel p-4">
        <select
          className="field max-w-xs"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="all">{t('priceList.allCategories')}</option>
          {CATEGORY_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {categoryLabel(t, value)}
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <p className="text-sm text-slate-500">{t('priceList.loading')}</p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {!loading && !error && filtered.length === 0 && (
        <EmptyState
          title={t('priceList.noItems')}
          message={t('priceList.noItemsMessage')}
        />
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('priceList.item')}</th>
                <th>{t('priceList.category')}</th>
                <th>{t('priceList.unit')}</th>
                <th>{t('priceList.price')}</th>
                <th>{t('priceList.priceIncVat')}</th>
                <th>{t('priceList.notes')}</th>
                <th>{t('priceList.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td>{item.item}</td>
                  <td>{categoryLabel(t, item.category)}</td>
                  <td>{unitLabel(t, item.unit)}</td>
                  <td>{formatCurrency(item.price)}</td>
                  <td>
                    {item.vat_exempt ? (
                      <span className="text-emerald-600">
                        {t('common.vatExempt')}
                      </span>
                    ) : (
                      formatCurrency(item.price * 1.25)
                    )}
                  </td>
                  <td>{item.notes ?? '—'}</td>
                  <td>
                    <button
                      type="button"
                      className="btn-ghost px-3 py-2"
                      onClick={() => openEdit(item)}
                    >
                      {t('common.edit')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={t('priceList.addModalTitle')}
      >
        <form onSubmit={handleAddSubmit} className="grid gap-4">
          {addDrafts.map((draft, index) => (
            <div
              key={draft.key}
              className={
                index > 0
                  ? 'grid gap-4 border-t border-slate-200 pt-4'
                  : 'grid gap-4'
              }
            >
              {addDrafts.length > 1 && (
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">
                    {t('priceList.itemNumber', { number: index + 1 })}
                  </h3>
                  <button
                    type="button"
                    className="btn-ghost px-3 py-2"
                    onClick={() => removeDraft(draft.key)}
                  >
                    <Icon name="trash" className="h-4 w-4" />
                    {t('common.remove')}
                  </button>
                </div>
              )}
              <ItemFields
                form={draft.form}
                autoFocus={index > 0}
                onChange={(key, value) =>
                  updateDraftField(draft.key, key, value)
                }
              />
            </div>
          ))}
          <button type="button" className="btn-ghost" onClick={addDraft}>
            <Icon name="plus" className="h-4 w-4" />
            {t('priceList.addMoreItems')}
          </button>
          {addError && (
            <p role="alert" className="text-sm text-red-600">
              {addError}
            </p>
          )}
          <button type="submit" disabled={addSaving} className="btn-primary">
            {addSaving
              ? t('common.saving')
              : addDrafts.length > 1
                ? t('priceList.addItems', { count: addDrafts.length })
                : t('priceList.addItem')}
          </button>
        </form>
      </Modal>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={t('priceList.editModalTitle')}
      >
        <form onSubmit={handleEditSubmit} className="grid gap-4">
          <ItemFields form={editForm} onChange={updateEditField} />
          <button type="submit" disabled={editSaving} className="btn-primary">
            {editSaving ? t('common.saving') : t('common.save')}
          </button>
        </form>
        <button type="button" className="btn-ghost mt-4" onClick={handleDelete}>
          {t('common.delete')}
        </button>
      </Modal>
    </div>
  )
}
