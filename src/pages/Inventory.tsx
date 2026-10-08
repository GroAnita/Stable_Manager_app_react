import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Badge } from '../components/Badge'
import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import {
  listActiveContractAllocations,
  type ContractAllocation,
} from '../features/contracts/api'
import {
  listAllFeedingExtras,
  type FeedingExtraEntry,
} from '../features/horses/api'
import {
  createDelivery,
  createInventoryItem,
  deleteDelivery,
  deleteInventoryItem,
  listInventoryItems,
  updateInventoryItem,
  type InventoryItemWithDeliveries,
} from '../features/inventory/api'
import { listPriceListItems, type PriceListItem } from '../features/priceList/api'
import {
  contractDailyRate,
  currentStock,
  daysRemaining,
  isLowStock,
} from '../lib/inventory'
import { usePreferences } from '../lib/PreferencesContext'
import { getCurrentStableId } from '../lib/stableContext'

const TRACKABLE_CATEGORIES = ['Hay', 'Grain', 'Supplements', 'Bedding']

type ItemFormState = {
  price_list_item_id: string
  low_stock_days_threshold: string
  notes: string
}

function emptyItemForm(): ItemFormState {
  return { price_list_item_id: '', low_stock_days_threshold: '7', notes: '' }
}

type DeliveryFormState = {
  quantity: string
  delivered_on: string
  notes: string
}

function emptyDeliveryForm(): DeliveryFormState {
  return {
    quantity: '',
    delivered_on: new Date().toISOString().slice(0, 10),
    notes: '',
  }
}

export default function Inventory() {
  const { t, formatDate } = usePreferences()
  const [items, setItems] = useState<InventoryItemWithDeliveries[]>([])
  const [priceListItems, setPriceListItems] = useState<PriceListItem[]>([])
  const [contractAllocations, setContractAllocations] = useState<
    ContractAllocation[]
  >([])
  const [extras, setExtras] = useState<FeedingExtraEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [itemModalOpen, setItemModalOpen] = useState(false)
  const [editingItem, setEditingItem] =
    useState<InventoryItemWithDeliveries | null>(null)
  const [itemForm, setItemForm] = useState<ItemFormState>(emptyItemForm)
  const [itemSaving, setItemSaving] = useState(false)
  const [itemError, setItemError] = useState<string | null>(null)

  const [deliveryItem, setDeliveryItem] =
    useState<InventoryItemWithDeliveries | null>(null)
  const [deliveryForm, setDeliveryForm] = useState<DeliveryFormState>(
    emptyDeliveryForm,
  )
  const [deliverySaving, setDeliverySaving] = useState(false)
  const [deliveryError, setDeliveryError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      listInventoryItems(),
      listPriceListItems(),
      listActiveContractAllocations(),
      listAllFeedingExtras(),
    ])
      .then(([itemsData, priceListData, allocationsData, extrasData]) => {
        if (!cancelled) {
          setItems(itemsData)
          setPriceListItems(priceListData)
          setContractAllocations(allocationsData)
          setExtras(extrasData)
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

  const availablePriceListItems = useMemo(
    () =>
      priceListItems.filter(
        (p) =>
          TRACKABLE_CATEGORIES.includes(p.category ?? '') &&
          !items.some((i) => i.price_list_item_id === p.id),
      ),
    [priceListItems, items],
  )

  function openAddItem() {
    setEditingItem(null)
    setItemForm(emptyItemForm())
    setItemError(null)
    setItemModalOpen(true)
  }

  function openEditItem(item: InventoryItemWithDeliveries) {
    setEditingItem(item)
    setItemForm({
      price_list_item_id: item.price_list_item_id,
      low_stock_days_threshold: item.low_stock_days_threshold.toString(),
      notes: item.notes ?? '',
    })
    setItemError(null)
    setItemModalOpen(true)
  }

  function updateItemField<K extends keyof ItemFormState>(
    key: K,
    value: ItemFormState[K],
  ) {
    setItemForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleItemSubmit(event: FormEvent) {
    event.preventDefault()
    setItemSaving(true)
    setItemError(null)
    try {
      if (editingItem) {
        const updated = await updateInventoryItem(editingItem.id, {
          low_stock_days_threshold:
            Number(itemForm.low_stock_days_threshold) || 7,
          notes: itemForm.notes || null,
        })
        setItems((prev) =>
          prev.map((item) =>
            item.id === updated.id
              ? {
                  ...item,
                  ...updated,
                }
              : item,
          ),
        )
      } else {
        if (!itemForm.price_list_item_id) return
        const stableId = await getCurrentStableId()
        if (!stableId) throw new Error(t('inventory.noStableFound'))
        const created = await createInventoryItem({
          price_list_item_id: itemForm.price_list_item_id,
          low_stock_days_threshold:
            Number(itemForm.low_stock_days_threshold) || 7,
          notes: itemForm.notes || null,
          stable_id: stableId,
        })
        const priceListItem = priceListItems.find(
          (p) => p.id === created.price_list_item_id,
        )
        if (!priceListItem) throw new Error(t('inventory.noAvailableItems'))
        setItems((prev) => [
          ...prev,
          {
            ...created,
            price_list_item: priceListItem,
            deliveries: [],
          },
        ])
      }
      setItemModalOpen(false)
    } catch (err) {
      setItemError((err as Error).message)
    } finally {
      setItemSaving(false)
    }
  }

  async function handleDeleteItem(item: InventoryItemWithDeliveries) {
    if (
      !window.confirm(
        t('inventory.confirmDeleteItem', { name: item.price_list_item.item }),
      )
    )
      return
    await deleteInventoryItem(item.id)
    setItems((prev) => prev.filter((i) => i.id !== item.id))
  }

  function openDelivery(item: InventoryItemWithDeliveries) {
    setDeliveryItem(item)
    setDeliveryForm(emptyDeliveryForm())
    setDeliveryError(null)
  }

  function updateDeliveryField<K extends keyof DeliveryFormState>(
    key: K,
    value: DeliveryFormState[K],
  ) {
    setDeliveryForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleDeliverySubmit(event: FormEvent) {
    event.preventDefault()
    if (!deliveryItem) return
    setDeliverySaving(true)
    setDeliveryError(null)
    try {
      const created = await createDelivery({
        inventory_item_id: deliveryItem.id,
        stable_id: deliveryItem.stable_id,
        quantity: Number(deliveryForm.quantity) || 0,
        delivered_on: deliveryForm.delivered_on,
        notes: deliveryForm.notes || null,
      })
      setItems((prev) =>
        prev.map((item) =>
          item.id === deliveryItem.id
            ? { ...item, deliveries: [...item.deliveries, created] }
            : item,
        ),
      )
      setDeliveryItem(null)
    } catch (err) {
      setDeliveryError((err as Error).message)
    } finally {
      setDeliverySaving(false)
    }
  }

  async function handleDeleteDelivery(
    item: InventoryItemWithDeliveries,
    deliveryId: string,
  ) {
    if (!window.confirm(t('inventory.confirmDeleteDelivery'))) return
    await deleteDelivery(deliveryId)
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? { ...i, deliveries: i.deliveries.filter((d) => d.id !== deliveryId) }
          : i,
      ),
    )
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">
            {t('inventory.title')}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {t('inventory.subtitle')}
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={openAddItem}>
          <Icon name="plus" className="h-4 w-4" />
          {t('inventory.addItem')}
        </button>
      </div>

      {loading && (
        <p className="text-sm text-slate-500">{t('inventory.loading')}</p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {t('inventory.failedToLoad', { error })}
        </p>
      )}
      {!loading && !error && items.length === 0 && (
        <EmptyState
          title={t('inventory.noItems')}
          message={t('inventory.noItemsMessage')}
        />
      )}

      {!loading && !error && items.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((item) => {
            const dailyRate = contractDailyRate(
              item.price_list_item_id,
              contractAllocations,
            )
            const matchingExtras = extras.filter(
              (e) => e.priceListItemId === item.price_list_item_id,
            )
            const extrasTotal = matchingExtras.reduce(
              (sum, e) => sum + e.quantity,
              0,
            )
            const stock = currentStock(
              item.deliveries,
              matchingExtras.map((e) => e.quantity),
              dailyRate,
            )
            const remaining = daysRemaining(stock, dailyRate)
            const low = isLowStock(remaining, item.low_stock_days_threshold)
            const unit = item.price_list_item.unit ?? ''

            return (
              <div key={item.id} className="panel p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      {item.price_list_item.item}
                    </h3>
                    {low && (
                      <Badge status="overdue" label={t('inventory.lowStock')} />
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => openEditItem(item)}
                      className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    >
                      <Icon name="edit" className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteItem(item)}
                      className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    >
                      <Icon name="trash" className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="block text-xs uppercase tracking-wide text-slate-400">
                      {t('inventory.currentStock')}
                    </span>
                    <span className="text-xl font-semibold text-slate-900">
                      {stock} {unit}
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs uppercase tracking-wide text-slate-400">
                      {t('inventory.daysRemaining')}
                    </span>
                    <span
                      className={`text-xl font-semibold ${
                        low ? 'text-rose-600' : 'text-slate-900'
                      }`}
                    >
                      {remaining === null
                        ? t('inventory.noUsageRate')
                        : t('inventory.daysRemainingValue', { days: remaining })}
                    </span>
                  </div>
                </div>

                <p className="mt-2 text-xs text-slate-400">
                  {t('inventory.dailyUsageRate')}: {Math.round(dailyRate * 100) / 100}{' '}
                  {unit}/day
                </p>
                {extrasTotal > 0 && (
                  <p className="mt-1 text-xs text-slate-400">
                    {t('inventory.extrasIncluded', {
                      amount: extrasTotal,
                      unit,
                    })}
                  </p>
                )}

                <button
                  type="button"
                  className="btn-ghost mt-4 w-full justify-center"
                  onClick={() => openDelivery(item)}
                >
                  <Icon name="plus" className="h-4 w-4" />
                  {t('inventory.logDelivery')}
                </button>

                <div className="mt-4 border-t border-slate-100 pt-3">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {t('inventory.deliveryHistory')}
                  </h4>
                  {item.deliveries.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-500">
                      {t('inventory.noDeliveries')}
                    </p>
                  ) : (
                    <div className="mt-2 space-y-1.5">
                      {item.deliveries
                        .slice()
                        .sort((a, b) =>
                          b.delivered_on.localeCompare(a.delivered_on),
                        )
                        .map((delivery) => (
                          <div
                            key={delivery.id}
                            className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-1.5 text-sm text-slate-600"
                          >
                            <span>
                              {delivery.quantity} {unit} ·{' '}
                              {formatDate(delivery.delivered_on)}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                handleDeleteDelivery(item, delivery.id)
                              }
                              className="text-slate-400 hover:text-slate-600"
                            >
                              <Icon name="x" className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal
        open={itemModalOpen}
        onClose={() => setItemModalOpen(false)}
        title={
          editingItem ? t('inventory.editItem') : t('inventory.addItem')
        }
      >
        <form onSubmit={handleItemSubmit} className="grid gap-4">
          {itemError && (
            <p role="alert" className="text-sm text-red-600">
              {itemError}
            </p>
          )}
          {!editingItem && (
            <label>
              <span className="field-label">{t('inventory.selectItem')}</span>
              {availablePriceListItems.length ? (
                <select
                  required
                  className="field"
                  value={itemForm.price_list_item_id}
                  onChange={(e) =>
                    updateItemField('price_list_item_id', e.target.value)
                  }
                >
                  <option value="">{t('inventory.chooseItem')}</option>
                  {availablePriceListItems.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.item}
                      {p.unit ? ` (${p.unit})` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="field flex items-center text-sm text-slate-400">
                  {t('inventory.noAvailableItems')}
                </p>
              )}
            </label>
          )}
          <label>
            <span className="field-label">
              {t('inventory.lowStockThreshold')}
            </span>
            <input
              type="number"
              step="1"
              min="0"
              className="field"
              value={itemForm.low_stock_days_threshold}
              onChange={(e) =>
                updateItemField('low_stock_days_threshold', e.target.value)
              }
            />
          </label>
          <label>
            <span className="field-label">{t('inventory.notes')}</span>
            <textarea
              className="field"
              value={itemForm.notes}
              onChange={(e) => updateItemField('notes', e.target.value)}
            />
          </label>
          <button
            type="submit"
            disabled={
              itemSaving ||
              (!editingItem && availablePriceListItems.length === 0)
            }
            className="btn-primary"
          >
            {itemSaving ? t('common.saving') : t('common.save')}
          </button>
        </form>
      </Modal>

      <Modal
        open={deliveryItem !== null}
        onClose={() => setDeliveryItem(null)}
        title={t('inventory.logDelivery')}
      >
        <form onSubmit={handleDeliverySubmit} className="grid gap-4">
          {deliveryError && (
            <p role="alert" className="text-sm text-red-600">
              {deliveryError}
            </p>
          )}
          <label>
            <span className="field-label">
              {t('inventory.deliveryQuantity')}
            </span>
            <input
              required
              type="number"
              step="0.01"
              min="0.01"
              className="field"
              value={deliveryForm.quantity}
              onChange={(e) => updateDeliveryField('quantity', e.target.value)}
            />
          </label>
          <label>
            <span className="field-label">
              {t('inventory.deliveryDate')}
            </span>
            <input
              required
              type="date"
              className="field"
              value={deliveryForm.delivered_on}
              onChange={(e) =>
                updateDeliveryField('delivered_on', e.target.value)
              }
            />
          </label>
          <label>
            <span className="field-label">{t('inventory.notes')}</span>
            <textarea
              className="field"
              value={deliveryForm.notes}
              onChange={(e) => updateDeliveryField('notes', e.target.value)}
            />
          </label>
          <button
            type="submit"
            disabled={deliverySaving}
            className="btn-primary"
          >
            {deliverySaving ? t('common.saving') : t('common.add')}
          </button>
        </form>
      </Modal>
    </div>
  )
}
