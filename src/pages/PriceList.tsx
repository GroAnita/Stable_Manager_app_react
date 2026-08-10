import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import {
  createPriceListItem,
  deletePriceListItem,
  listPriceListItems,
  updatePriceListItem,
  type PriceListItem,
} from '../features/priceList/api'
import { usePreferences } from '../lib/PreferencesContext'
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
}

const emptyForm: FormState = {
  item: '',
  category: '',
  unit: '',
  price: '',
  notes: '',
}

function toFormState(item: PriceListItem): FormState {
  return {
    item: item.item,
    category: item.category ?? '',
    unit: item.unit ?? '',
    price: item.price.toString(),
    notes: item.notes ?? '',
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
}: {
  form: FormState
  onChange: <K extends keyof FormState>(key: K, value: FormState[K]) => void
}) {
  const { t } = usePreferences()
  return (
    <div className="grid gap-4">
      <label>
        <span className="field-label">{t('priceList.itemName')}</span>
        <input
          required
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
              {value}
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
  const [addForm, setAddForm] = useState<FormState>(emptyForm)
  const [addSaving, setAddSaving] = useState(false)

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

  function updateAddField<K extends keyof FormState>(
    key: K,
    value: FormState[K],
  ) {
    setAddForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleAddSubmit(event: FormEvent) {
    event.preventDefault()
    setAddSaving(true)
    try {
      const stableId = await getCurrentStableId()
      if (!stableId) throw new Error(t('priceList.noStableFound'))
      await createPriceListItem({
        item: addForm.item,
        category: addForm.category || null,
        unit: addForm.unit || null,
        price: Number(addForm.price) || 0,
        notes: addForm.notes || null,
        stable_id: stableId,
      })
      setAddOpen(false)
      setAddForm(emptyForm)
      refetch()
    } catch (err) {
      setError((err as Error).message)
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
                  <td>{item.unit ?? '—'}</td>
                  <td>{formatCurrency(item.price)}</td>
                  <td>{formatCurrency(item.price * 1.25)}</td>
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
          <ItemFields form={addForm} onChange={updateAddField} />
          <button type="submit" disabled={addSaving} className="btn-primary">
            {addSaving ? t('common.saving') : t('priceList.addItem')}
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
