import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  createContract,
  getContract,
  getEmptyBoxRate,
  listBeddingItems,
  listBoardingItems,
  listHayItems,
  updateContract,
  type ContractInsert,
  type PriceListItemOption,
} from '../features/contracts/api'
import { createHorse, updateHorse } from '../features/horses/api'
import { createOwner } from '../features/owners/api'
import { getStable } from '../features/settings/api'
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
  listTurnoutShelterOptions,
} from '../lib/options'
import type {
  HorseOption,
  OwnerOption,
  StallOption,
  TurnoutShelterOption,
} from '../lib/options'
import { unitLabel } from '../lib/reports'
import { getCurrentStableId } from '../lib/stableContext'

type ContractStatus = 'active' | 'ending_soon' | 'expired' | 'cancelled'

type FormState = {
  horse_id: string
  owner_id: string
  stall_id: string
  turnout_shelter_id: string
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
  additional_services: string
  notes: string
  contract_terms: string
}

const emptyForm: FormState = {
  horse_id: '',
  owner_id: '',
  stall_id: '',
  turnout_shelter_id: '',
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
  additional_services: '',
  notes: '',
  contract_terms: '',
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
  const [turnoutShelters, setTurnoutShelters] = useState<
    TurnoutShelterOption[]
  >([])
  const [boardingItems, setBoardingItems] = useState<PriceListItemOption[]>([])
  const [hayItems, setHayItems] = useState<PriceListItemOption[]>([])
  const [beddingItems, setBeddingItems] = useState<PriceListItemOption[]>([])
  const [emptyBoxRate, setEmptyBoxRate] = useState<number | null>(null)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const [addingNewOwner, setAddingNewOwner] = useState(false)
  const [newOwnerName, setNewOwnerName] = useState('')
  const [addingNewHorse, setAddingNewHorse] = useState(false)
  const [newHorseName, setNewHorseName] = useState('')

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
    listTurnoutShelterOptions()
      .then(setTurnoutShelters)
      .catch((err: Error) => setError(err.message))
    listBoardingItems()
      .then(setBoardingItems)
      .catch((err: Error) => setError(err.message))
    getCurrentStableId()
      .then((stableId) => (stableId ? getEmptyBoxRate(stableId) : null))
      .then(setEmptyBoxRate)
      .catch((err: Error) => setError(err.message))
    if (!isEdit) {
      getCurrentStableId()
        .then((stableId) => (stableId ? getStable(stableId) : null))
        .then((stable) => {
          if (stable?.default_contract_terms) {
            setForm((prev) => ({
              ...prev,
              contract_terms: stable.default_contract_terms ?? '',
            }))
          }
        })
        .catch((err: Error) => setError(err.message))
    }
    listHayItems()
      .then(setHayItems)
      .catch((err: Error) => setError(err.message))
    listBeddingItems()
      .then(setBeddingItems)
      .catch((err: Error) => setError(err.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          turnout_shelter_id: contract.turnout_shelter_id ?? '',
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
          additional_services: contract.additional_services ?? '',
          notes: contract.notes ?? '',
          contract_terms: contract.contract_terms ?? '',
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
  }

  // Stalls and turnout shelters share one dropdown, so a contract can only
  // ever hold one of them.
  function selectHousing(value: string) {
    const [kind, housingId = ''] = value.split(':')
    setForm((prev) => ({
      ...prev,
      stall_id: kind === 'stall' ? housingId : '',
      turnout_shelter_id: kind === 'shelter' ? housingId : '',
    }))
  }

  function selectBoardingItem(itemId: string) {
    const item = boardingItems.find((option) => option.id === itemId)
    setForm((prev) => ({
      ...prev,
      boarding_price_list_item_id: itemId,
      monthly_rent: item ? item.price.toString() : prev.monthly_rent,
    }))
  }

  const horseIsAway = horses.find((h) => h.id === form.horse_id)?.away ?? false

  const cycleDays = currentBillingCycleDays()
  const selectedBoardingItem = boardingItems.find(
    (item) => item.id === form.boarding_price_list_item_id,
  )
  const selectedHayItem = hayItems.find(
    (item) => item.id === form.hay_price_list_item_id,
  )
  const selectedBeddingItem = beddingItems.find(
    (item) => item.id === form.bedding_price_list_item_id,
  )
  const hayValue = useMemo(() => {
    const kgPerDay = Number(form.included_hay_kg) || 0
    return selectedHayItem
      ? hayValueIncVat(
          selectedHayItem.price,
          kgPerDay,
          cycleDays,
          selectedHayItem.vat_exempt,
        )
      : 0
  }, [selectedHayItem, form.included_hay_kg, cycleDays])
  const beddingAmount = useMemo(() => {
    const qty = Number(form.bedding_quantity) || 0
    return selectedBeddingItem
      ? beddingAmountIncVat(
          selectedBeddingItem.price,
          qty,
          selectedBeddingItem.vat_exempt,
        )
      : 0
  }, [selectedBeddingItem, form.bedding_quantity])
  const effectiveHayValue = horseIsAway ? 0 : hayValue
  const effectiveBeddingAmount = horseIsAway ? 0 : beddingAmount
  const rent = horseIsAway
    ? (emptyBoxRate ?? 0)
    : Number(form.monthly_rent) || 0
  const total =
    Math.round((rent + effectiveHayValue + effectiveBeddingAmount) * 100) / 100

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null
    const addAnother = submitter?.value === 'addAnother'
    setSaving(true)
    setError(null)
    setSuccessMessage(null)
    try {
      const stableId = await getCurrentStableId()
      if (!stableId) throw new Error(t('contractForm.noStableFound'))

      let ownerId = form.owner_id
      if (!isEdit && addingNewOwner) {
        const createdOwner = await createOwner({
          full_name: newOwnerName,
          stable_id: stableId,
        })
        ownerId = createdOwner.id
      }

      let horseId = form.horse_id
      const createdHorseName = addingNewHorse
        ? newHorseName
        : (horses.find((h) => h.id === horseId)?.name ?? '')
      if (!isEdit && addingNewHorse) {
        const createdHorse = await createHorse({
          name: newHorseName,
          stable_id: stableId,
          owner_id: ownerId || null,
        })
        horseId = createdHorse.id
      }

      // The stall or turnout shelter picked here is the horse's actual
      // assignment, not just a note on the contract — keep the horse in sync
      // so the Stalls and Turnout pages reflect it. Only sets what was chosen
      // and never clears the other, since a horse can have both.
      if (form.stall_id) {
        await updateHorse(horseId, { stall_id: form.stall_id })
      } else if (form.turnout_shelter_id) {
        await updateHorse(horseId, {
          turnout_shelter_id: form.turnout_shelter_id,
        })
      }

      const payload = {
        horse_id: horseId,
        owner_id: ownerId,
        stall_id: form.stall_id || null,
        turnout_shelter_id: form.turnout_shelter_id || null,
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
        additional_services: form.additional_services || null,
        notes: form.notes || null,
        contract_terms: form.contract_terms || null,
      }

      if (isEdit && id) {
        await updateContract(id, payload)
        navigate('/contracts')
      } else {
        const insertPayload: ContractInsert = {
          ...payload,
          stable_id: stableId,
        }
        await createContract(insertPayload)
        if (addAnother) {
          const [horseOpts, ownerOpts, stallOpts] = await Promise.all([
            listHorseOptions(),
            listOwnerOptions(),
            listStallOptions(),
          ])
          setHorses(horseOpts)
          setOwners(ownerOpts)
          setStalls(stallOpts)
          setForm((prev) => ({
            ...emptyForm,
            owner_id: ownerId,
            contract_terms: prev.contract_terms,
            start_date: prev.start_date,
          }))
          setAddingNewOwner(false)
          setAddingNewHorse(false)
          setNewOwnerName('')
          setNewHorseName('')
          setSuccessMessage(
            t('contractForm.addedAnother', { name: createdHorseName }),
          )
        } else {
          navigate('/contracts')
        }
      }
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
      {successMessage && (
        <p className="text-sm text-forest">{successMessage}</p>
      )}
      <form
        onSubmit={handleSubmit}
        className="panel grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3"
      >
        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="field-label">{t('contractForm.horse')}</span>
            {!isEdit && (
              <button
                type="button"
                className="text-xs font-medium text-forest hover:underline"
                onClick={() => {
                  setAddingNewHorse((prev) => !prev)
                  setNewHorseName('')
                  updateField('horse_id', '')
                }}
              >
                {addingNewHorse
                  ? t('contractForm.selectExistingHorse')
                  : t('contractForm.addNewHorse')}
              </button>
            )}
          </div>
          {addingNewHorse ? (
            <input
              required
              className="field"
              placeholder={t('contractForm.newHorseNamePlaceholder')}
              value={newHorseName}
              onChange={(e) => setNewHorseName(e.target.value)}
            />
          ) : (
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
                  {horse.away ? ` (${t('status.away')})` : ''}
                </option>
              ))}
            </select>
          )}
        </div>
        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="field-label">{t('contractForm.owner')}</span>
            {!isEdit && (
              <button
                type="button"
                className="text-xs font-medium text-forest hover:underline"
                onClick={() => {
                  setAddingNewOwner((prev) => !prev)
                  setNewOwnerName('')
                  updateField('owner_id', '')
                }}
              >
                {addingNewOwner
                  ? t('contractForm.selectExistingOwner')
                  : t('contractForm.addNewOwner')}
              </button>
            )}
          </div>
          {addingNewOwner ? (
            <input
              required
              className="field"
              placeholder={t('contractForm.newOwnerNamePlaceholder')}
              value={newOwnerName}
              onChange={(e) => setNewOwnerName(e.target.value)}
            />
          ) : (
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
          )}
        </div>
        <label>
          <span className="field-label">{t('contractForm.housing')}</span>
          <select
            className="field"
            value={
              form.turnout_shelter_id
                ? `shelter:${form.turnout_shelter_id}`
                : form.stall_id
                  ? `stall:${form.stall_id}`
                  : ''
            }
            onChange={(e) => selectHousing(e.target.value)}
          >
            <option value="">{t('contractForm.selectHousing')}</option>
            <optgroup label={t('contractForm.stallGroup')}>
              {stalls.map((stall) => {
                const occupiedByOther =
                  stall.occupant && stall.occupant.id !== form.horse_id
                return (
                  <option key={stall.id} value={`stall:${stall.id}`}>
                    {stall.stall_number} —{' '}
                    {occupiedByOther
                      ? t('horseForm.stallOccupied', {
                          name: stall.occupant!.name,
                        })
                      : t('status.available')}
                  </option>
                )
              })}
            </optgroup>
            <optgroup label={t('contractForm.turnoutShelterGroup')}>
              {turnoutShelters.map((shelter) => (
                <option key={shelter.id} value={`shelter:${shelter.id}`}>
                  {shelter.name}
                </option>
              ))}
            </optgroup>
          </select>
        </label>

        {horseIsAway && (
          <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 md:col-span-2 xl:col-span-3">
            <p className="text-sm font-medium text-orange-900">
              {t('contractForm.emptyBoxToggle')}
            </p>
            <p className="mt-1 text-xs text-orange-700">
              {emptyBoxRate !== null
                ? t('contractForm.emptyBoxHint', {
                    amount: formatCurrency(emptyBoxRate),
                  })
                : t('contractForm.noEmptyBoxItems')}
            </p>
          </div>
        )}

        <div>
          <span className="field-label">{t('contractForm.boardingItem')}</span>
          {boardingItems.length ? (
            <select
              className="field"
              disabled={horseIsAway}
              value={form.boarding_price_list_item_id}
              onChange={(e) => selectBoardingItem(e.target.value)}
            >
              <option value="">{t('contractForm.selectBoardingItem')}</option>
              {boardingItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.item}
                  {item.unit ? ` (${unitLabel(t, item.unit)})` : ''}
                </option>
              ))}
            </select>
          ) : (
            <p className="field flex items-center text-sm text-slate-400">
              {t('contractForm.noBoardingItems')}
            </p>
          )}
          {selectedBoardingItem && (
            <span className="mt-1 block text-xs text-slate-400">
              {selectedBoardingItem.vat_exempt
                ? t('contractForm.boardingVatExempt')
                : t('contractForm.boardingVatIncluded')}
            </span>
          )}
        </div>
        <label>
          <span className="field-label">{t('contractForm.monthlyRent')}</span>
          <input
            required
            type="number"
            step="0.01"
            min="0"
            disabled={horseIsAway}
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
              disabled={horseIsAway}
              value={form.hay_price_list_item_id}
              onChange={(e) =>
                updateField('hay_price_list_item_id', e.target.value)
              }
            >
              <option value="">{t('contractForm.selectHayItem')}</option>
              {hayItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.item}
                  {item.unit ? ` (${unitLabel(t, item.unit)})` : ''}
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
              {t(
                selectedHayItem?.vat_exempt
                  ? 'contractForm.exemptOverDays'
                  : 'contractForm.incVatOverDays',
                {
                  amount: formatCurrency(hayValue),
                  days: cycleDays,
                },
              )}
            </span>
          )}
        </div>
        <label>
          <span className="field-label">{t('contractForm.hayQuantity')}</span>
          <input
            type="number"
            step="0.01"
            min="0"
            disabled={horseIsAway}
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
              disabled={horseIsAway}
              value={form.bedding_price_list_item_id}
              onChange={(e) =>
                updateField('bedding_price_list_item_id', e.target.value)
              }
            >
              <option value="">{t('contractForm.selectBeddingItem')}</option>
              {beddingItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.item}
                  {item.unit ? ` (${unitLabel(t, item.unit)})` : ''}
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
              {t(
                selectedBeddingItem?.vat_exempt
                  ? 'contractForm.exempt'
                  : 'contractForm.incVat',
                { amount: formatCurrency(beddingAmount) },
              )}
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
            disabled={horseIsAway}
            className="field"
            value={form.bedding_quantity}
            onChange={(e) => updateField('bedding_quantity', e.target.value)}
          />
        </label>
        <div />

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

        <label className="md:col-span-2 xl:col-span-3">
          <span className="field-label">
            {t('contractForm.contractTerms')}
          </span>
          <textarea
            className="field min-h-40"
            value={form.contract_terms}
            onChange={(e) => updateField('contract_terms', e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-400">
            {t('contractForm.contractTermsHint')}
          </p>
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
            {horseIsAway && (
              <p className="text-xs text-orange-600">
                {t('contractForm.emptyBoxSummaryNote')}
              </p>
            )}
            {effectiveHayValue > 0 && (
              <div className="flex justify-between">
                <span>
                  {t('contractForm.summaryHay', {
                    kg: form.included_hay_kg || 0,
                    days: cycleDays,
                  })}
                </span>
                <span>{formatCurrency(effectiveHayValue)}</span>
              </div>
            )}
            {effectiveBeddingAmount > 0 && (
              <div className="flex justify-between">
                <span>
                  {t('contractForm.summaryBedding', {
                    qty: form.bedding_quantity || 0,
                  })}
                </span>
                <span>{formatCurrency(effectiveBeddingAmount)}</span>
              </div>
            )}
            <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 font-semibold text-slate-900">
              <span>{t('contractForm.summaryTotal')}</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 md:col-span-2 xl:col-span-3">
          <button
            type="submit"
            name="intent"
            value="save"
            disabled={saving}
            className="btn-primary"
          >
            {saving ? t('common.saving') : t('common.save')}
          </button>
          {!isEdit && (
            <button
              type="submit"
              name="intent"
              value="addAnother"
              disabled={saving}
              className="btn-ghost"
            >
              {t('contractForm.saveAndAddAnotherHorse')}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
