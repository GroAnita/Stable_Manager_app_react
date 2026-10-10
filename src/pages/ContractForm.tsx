import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  createContract,
  getContract,
  listBeddingItems,
  listBoardingItems,
  listHayItems,
  updateContract,
  type ContractInsert,
  type PriceListItemOption,
} from '../features/contracts/api'
import {
  beddingAmountIncVat,
  currentBillingCycleDays,
  hayValueIncVat,
} from '../lib/billing'
import { usePreferences } from '../lib/PreferencesContext'
import {
  listHorseOptions,
  listOwnerOptions,
  listStallOptions,
} from '../lib/options'
import type { HorseOption, OwnerOption, StallOption } from '../lib/options'
import { getCurrentStableId } from '../lib/stableContext'

type ContractStatus = 'active' | 'ending_soon' | 'expired' | 'cancelled'
type IncludedService = 'full' | 'weekFull' | 'normal'

const SERVICE_OPTIONS: { value: IncludedService; key: string }[] = [
  { value: 'full', key: 'contractForm.serviceFull' },
  { value: 'weekFull', key: 'contractForm.serviceWeekFull' },
  { value: 'normal', key: 'contractForm.serviceNormal' },
]

type FormState = {
  horse_id: string
  owner_id: string
  stall_id: string
  boarding_price_list_item_id: string
  monthly_rent: string
  deposit: string
  start_date: string
  end_date: string
  status: ContractStatus
  hay_price_list_item_id: string
  included_hay_kg: string
  bedding_price_list_item_id: string
  bedding_quantity: string
  included_services: IncludedService | ''
  additional_services: string
  notes: string
}

const emptyForm: FormState = {
  horse_id: '',
  owner_id: '',
  stall_id: '',
  boarding_price_list_item_id: '',
  monthly_rent: '',
  deposit: '',
  start_date: '',
  end_date: '',
  status: 'active',
  hay_price_list_item_id: '',
  included_hay_kg: '',
  bedding_price_list_item_id: '',
  bedding_quantity: '',
  included_services: '',
  additional_services: '',
  notes: '',
}

export default function ContractForm() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { t, formatCurrency } = usePreferences()

  const [form, setForm] = useState<FormState>(emptyForm)
  const [horses, setHorses] = useState<HorseOption[]>([])
  const [owners, setOwners] = useState<OwnerOption[]>([])
  const [stalls, setStalls] = useState<StallOption[]>([])
  const [boardingItems, setBoardingItems] = useState<PriceListItemOption[]>([])
  const [hayItems, setHayItems] = useState<PriceListItemOption[]>([])
  const [beddingItems, setBeddingItems] = useState<PriceListItemOption[]>([])
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [serviceError, setServiceError] = useState(false)

  useEffect(() => {
    listHorseOptions()
      .then(setHorses)
      .catch((err: Error) => setError(err.message))
    listOwnerOptions()
      .then(setOwners)
      .catch((err: Error) => setError(err.message))
    listStallOptions()
      .then(setStalls)
      .catch((err: Error) => setError(err.message))
    listBoardingItems()
      .then(setBoardingItems)
      .catch((err: Error) => setError(err.message))
    listHayItems()
      .then(setHayItems)
      .catch((err: Error) => setError(err.message))
    listBeddingItems()
      .then(setBeddingItems)
      .catch((err: Error) => setError(err.message))
  }, [])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    getContract(id)
      .then((contract) => {
        if (cancelled) return
        setForm({
          horse_id: contract.horse_id,
          owner_id: contract.owner_id,
          stall_id: contract.stall_id ?? '',
          boarding_price_list_item_id:
            contract.boarding_price_list_item_id ?? '',
          monthly_rent: contract.monthly_rent.toString(),
          deposit: contract.deposit?.toString() ?? '',
          start_date: contract.start_date,
          end_date: contract.end_date ?? '',
          status: contract.status as ContractStatus,
          hay_price_list_item_id: contract.hay_price_list_item_id ?? '',
          included_hay_kg: contract.included_hay_kg?.toString() ?? '',
          bedding_price_list_item_id: contract.bedding_price_list_item_id ?? '',
          bedding_quantity: contract.bedding_quantity
            ? contract.bedding_quantity.toString()
            : '',
          included_services:
            (contract.included_services as IncludedService | null) ?? '',
          additional_services: contract.additional_services ?? '',
          notes: contract.notes ?? '',
        })
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (key === 'included_services') setServiceError(false)
  }

  function selectBoardingItem(itemId: string) {
    const item = boardingItems.find((option) => option.id === itemId)
    setForm((prev) => ({
      ...prev,
      boarding_price_list_item_id: itemId,
      monthly_rent: item ? item.price.toString() : prev.monthly_rent,
    }))
  }

  const cycleDays = currentBillingCycleDays()
  const selectedHayItem = hayItems.find(
    (item) => item.id === form.hay_price_list_item_id,
  )
  const selectedBeddingItem = beddingItems.find(
    (item) => item.id === form.bedding_price_list_item_id,
  )
  const hayValue = useMemo(() => {
    const kgPerDay = Number(form.included_hay_kg) || 0
    return selectedHayItem
      ? hayValueIncVat(selectedHayItem.price, kgPerDay, cycleDays)
      : 0
  }, [selectedHayItem, form.included_hay_kg, cycleDays])
  const beddingAmount = useMemo(() => {
    const qty = Number(form.bedding_quantity) || 0
    return selectedBeddingItem
      ? beddingAmountIncVat(selectedBeddingItem.price, qty)
      : 0
  }, [selectedBeddingItem, form.bedding_quantity])
  const rent = Number(form.monthly_rent) || 0
  const total = Math.round((rent + hayValue + beddingAmount) * 100) / 100

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!form.included_services) {
      setServiceError(true)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        horse_id: form.horse_id,
        owner_id: form.owner_id,
        stall_id: form.stall_id || null,
        boarding_price_list_item_id: form.boarding_price_list_item_id || null,
        monthly_rent: Number(form.monthly_rent) || 0,
        deposit: form.deposit ? Number(form.deposit) : null,
        start_date: form.start_date,
        end_date: form.end_date || null,
        status: form.status,
        hay_price_list_item_id: form.hay_price_list_item_id || null,
        included_hay_kg: form.included_hay_kg
          ? Number(form.included_hay_kg)
          : null,
        bedding_price_list_item_id: form.bedding_price_list_item_id || null,
        bedding_quantity: form.bedding_quantity
          ? Number(form.bedding_quantity)
          : 0,
        included_services: form.included_services,
        additional_services: form.additional_services || null,
        notes: form.notes || null,
      }

      if (isEdit && id) {
        await updateContract(id, payload)
      } else {
        const stableId = await getCurrentStableId()
        if (!stableId) throw new Error(t('contractForm.noStableFound'))
        const insertPayload: ContractInsert = {
          ...payload,
          stable_id: stableId,
        }
        await createContract(insertPayload)
      }
      navigate('/contracts')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (loading)
    return <p className="text-sm text-slate-500">{t('contractForm.loading')}</p>

  return (
    <div className="page-shell">
      <h1 className="text-3xl font-semibold text-slate-900">
        {isEdit
          ? t('contractForm.editContract')
          : t('contractForm.newContract')}
      </h1>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <form
        onSubmit={handleSubmit}
        className="panel grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3"
      >
        <label>
          <span className="field-label">{t('contractForm.horse')}</span>
          <select
            required
            className="field"
            value={form.horse_id}
            onChange={(e) => updateField('horse_id', e.target.value)}
          >
            <option value="">{t('contractForm.selectHorse')}</option>
            {horses.map((horse) => (
              <option key={horse.id} value={horse.id}>
                {horse.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">{t('contractForm.owner')}</span>
          <select
            required
            className="field"
            value={form.owner_id}
            onChange={(e) => updateField('owner_id', e.target.value)}
          >
            <option value="">{t('contractForm.selectOwner')}</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.full_name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">{t('contractForm.stall')}</span>
          <select
            className="field"
            value={form.stall_id}
            onChange={(e) => updateField('stall_id', e.target.value)}
          >
            <option value="">{t('contractForm.selectStall')}</option>
            {stalls.map((stall) => (
              <option key={stall.id} value={stall.id}>
                {stall.stall_number}
              </option>
            ))}
          </select>
        </label>
        <div>
          <span className="field-label">{t('contractForm.boardingItem')}</span>
          {boardingItems.length ? (
            <select
              className="field"
              value={form.boarding_price_list_item_id}
              onChange={(e) => selectBoardingItem(e.target.value)}
            >
              <option value="">{t('contractForm.selectBoardingItem')}</option>
              {boardingItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.item}
                  {item.unit ? ` (${item.unit})` : ''}
                </option>
              ))}
            </select>
          ) : (
            <p className="field flex items-center text-sm text-slate-400">
              {t('contractForm.noBoardingItems')}
            </p>
          )}
        </div>
        <label>
          <span className="field-label">{t('contractForm.monthlyRent')}</span>
          <input
            required
            type="number"
            step="0.01"
            min="0"
            className="field"
            value={form.monthly_rent}
            onChange={(e) => updateField('monthly_rent', e.target.value)}
          />
        </label>
        <label>
          <span className="field-label">{t('contractForm.deposit')}</span>
          <input
            type="number"
            step="0.01"
            min="0"
            className="field"
            value={form.deposit}
            onChange={(e) => updateField('deposit', e.target.value)}
          />
        </label>
        <label>
          <span className="field-label">{t('contractForm.status')}</span>
          <select
            required
            className="field"
            value={form.status}
            onChange={(e) =>
              updateField('status', e.target.value as ContractStatus)
            }
          >
            <option value="active">{t('contractForm.statusActive')}</option>
            <option value="ending_soon">
              {t('contractForm.statusEndingSoon')}
            </option>
            <option value="expired">{t('contractForm.statusExpired')}</option>
            <option value="cancelled">
              {t('contractForm.statusCancelled')}
            </option>
          </select>
        </label>
        <label>
          <span className="field-label">{t('contractForm.startDate')}</span>
          <input
            required
            type="date"
            className="field"
            value={form.start_date}
            onChange={(e) => updateField('start_date', e.target.value)}
          />
        </label>
        <label>
          <span className="field-label">{t('contractForm.endDate')}</span>
          <input
            type="date"
            className="field"
            value={form.end_date}
            onChange={(e) => updateField('end_date', e.target.value)}
          />
        </label>
        <div />

        <div>
          <span className="field-label">{t('contractForm.hayItem')}</span>
          {hayItems.length ? (
            <select
              className="field"
              value={form.hay_price_list_item_id}
              onChange={(e) =>
                updateField('hay_price_list_item_id', e.target.value)
              }
            >
              <option value="">{t('contractForm.selectHayItem')}</option>
              {hayItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.item}
                  {item.unit ? ` (${item.unit})` : ''}
                </option>
              ))}
            </select>
          ) : (
            <p className="field flex items-center text-sm text-slate-400">
              {t('contractForm.noHayItems')}
            </p>
          )}
          {hayValue > 0 && (
            <span className="mt-1 block text-xs text-slate-400">
              {t('contractForm.incVatOverDays', {
                amount: formatCurrency(hayValue),
                days: cycleDays,
              })}
            </span>
          )}
        </div>
        <label>
          <span className="field-label">{t('contractForm.hayQuantity')}</span>
          <input
            type="number"
            step="0.01"
            min="0"
            className="field"
            value={form.included_hay_kg}
            onChange={(e) => updateField('included_hay_kg', e.target.value)}
          />
        </label>
        <div />

        <div>
          <span className="field-label">{t('contractForm.beddingItem')}</span>
          {beddingItems.length ? (
            <select
              className="field"
              value={form.bedding_price_list_item_id}
              onChange={(e) =>
                updateField('bedding_price_list_item_id', e.target.value)
              }
            >
              <option value="">{t('contractForm.selectBeddingItem')}</option>
              {beddingItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.item}
                  {item.unit ? ` (${item.unit})` : ''}
                </option>
              ))}
            </select>
          ) : (
            <p className="field flex items-center text-sm text-slate-400">
              {t('contractForm.noBeddingItems')}
            </p>
          )}
          {beddingAmount > 0 && (
            <span className="mt-1 block text-xs text-slate-400">
              {t('contractForm.incVat', {
                amount: formatCurrency(beddingAmount),
              })}
            </span>
          )}
        </div>
        <label>
          <span className="field-label">
            {t('contractForm.beddingQuantity')}
          </span>
          <input
            type="number"
            step="0.01"
            min="0"
            className="field"
            value={form.bedding_quantity}
            onChange={(e) => updateField('bedding_quantity', e.target.value)}
          />
        </label>
        <div />

        <div className="md:col-span-2 xl:col-span-3">
          <span className="field-label">
            {t('contractForm.includedServices')}
          </span>
          <div className="mt-2 flex flex-col gap-2">
            {SERVICE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-2 text-sm text-slate-700"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300"
                  checked={form.included_services === option.value}
                  onChange={() =>
                    updateField('included_services', option.value)
                  }
                />
                {t(option.key)}
              </label>
            ))}
          </div>
          {serviceError && (
            <p className="mt-1 text-xs text-rose-500">
              {t('contractForm.includedServicesError')}
            </p>
          )}
        </div>

        <label className="md:col-span-2 xl:col-span-3">
          <span className="field-label">
            {t('contractForm.additionalServices')}
          </span>
          <textarea
            className="field min-h-24"
            value={form.additional_services}
            onChange={(e) => updateField('additional_services', e.target.value)}
          />
        </label>

        <label className="md:col-span-2 xl:col-span-3">
          <span className="field-label">{t('contractForm.notes')}</span>
          <textarea
            className="field"
            value={form.notes}
            onChange={(e) => updateField('notes', e.target.value)}
          />
        </label>

        <div className="rounded-2xl bg-slate-50 p-4 md:col-span-2 xl:col-span-3">
          <h3 className="text-sm font-semibold text-slate-800">
            {t('contractForm.summaryTitle')}
          </h3>
          <div className="mt-2 space-y-1 text-sm text-slate-600">
            <div className="flex justify-between">
              <span>{t('contractForm.summaryRent')}</span>
              <span>{formatCurrency(rent)}</span>
            </div>
            {hayValue > 0 && (
              <div className="flex justify-between">
                <span>
                  {t('contractForm.summaryHay', {
                    kg: form.included_hay_kg || 0,
                    days: cycleDays,
                  })}
                </span>
                <span>{formatCurrency(hayValue)}</span>
              </div>
            )}
            {beddingAmount > 0 && (
              <div className="flex justify-between">
                <span>
                  {t('contractForm.summaryBedding', {
                    qty: form.bedding_quantity || 0,
                  })}
                </span>
                <span>{formatCurrency(beddingAmount)}</span>
              </div>
            )}
            <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 font-semibold text-slate-900">
              <span>{t('contractForm.summaryTotal')}</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        <div className="md:col-span-2 xl:col-span-3">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </form>
    </div>
  )
}
