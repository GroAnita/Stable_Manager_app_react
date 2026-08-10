import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  createHorse,
  getHorse,
  updateHorse,
  type HorseInsert,
} from '../features/horses/api'
import {
  listOwnerOptions,
  listStallOptions,
  type OwnerOption,
  type StallOption,
} from '../lib/options'
import { usePreferences } from '../lib/PreferencesContext'
import { getCurrentStableId } from '../lib/stableContext'

type FormState = {
  name: string
  breed: string
  age: string
  gender: string
  color: string
  passport_number: string
  microchip_number: string
  insurance_company: string
  insurance_number: string
  vaccination_status: string
  allergies: string
  feeding_notes: string
  medical_notes: string
  notes: string
  arrival_date: string
  owner_id: string
  stall_id: string
  active: boolean
}

const emptyForm: FormState = {
  name: '',
  breed: '',
  age: '',
  gender: '',
  color: '',
  passport_number: '',
  microchip_number: '',
  insurance_company: '',
  insurance_number: '',
  vaccination_status: '',
  allergies: '',
  feeding_notes: '',
  medical_notes: '',
  notes: '',
  arrival_date: '',
  owner_id: '',
  stall_id: '',
  active: true,
}

export default function HorseForm() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { t } = usePreferences()

  const [form, setForm] = useState<FormState>(emptyForm)
  const [owners, setOwners] = useState<OwnerOption[]>([])
  const [stalls, setStalls] = useState<StallOption[]>([])
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listOwnerOptions()
      .then(setOwners)
      .catch((err: Error) => setError(err.message))
    listStallOptions()
      .then(setStalls)
      .catch((err: Error) => setError(err.message))
  }, [])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    getHorse(id)
      .then((horse) => {
        if (cancelled) return
        setForm({
          name: horse.name,
          breed: horse.breed ?? '',
          age: horse.age?.toString() ?? '',
          gender: horse.gender ?? '',
          color: horse.color ?? '',
          passport_number: horse.passport_number ?? '',
          microchip_number: horse.microchip_number ?? '',
          insurance_company: horse.insurance_company ?? '',
          insurance_number: horse.insurance_number ?? '',
          vaccination_status: horse.vaccination_status ?? '',
          allergies: horse.allergies ?? '',
          feeding_notes: horse.feeding_notes ?? '',
          medical_notes: horse.medical_notes ?? '',
          notes: horse.notes ?? '',
          arrival_date: horse.arrival_date ?? '',
          owner_id: horse.owner_id ?? '',
          stall_id: horse.stall_id ?? '',
          active: horse.active,
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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: form.name,
        breed: form.breed || null,
        age: form.age ? Number(form.age) : null,
        gender: form.gender || null,
        color: form.color || null,
        passport_number: form.passport_number || null,
        microchip_number: form.microchip_number || null,
        insurance_company: form.insurance_company || null,
        insurance_number: form.insurance_number || null,
        vaccination_status: form.vaccination_status || null,
        allergies: form.allergies || null,
        feeding_notes: form.feeding_notes || null,
        medical_notes: form.medical_notes || null,
        notes: form.notes || null,
        arrival_date: form.arrival_date || null,
        owner_id: form.owner_id || null,
        stall_id: form.stall_id || null,
        active: form.active,
      }

      if (isEdit && id) {
        await updateHorse(id, payload)
        navigate(`/horses/${id}`)
      } else {
        const stableId = await getCurrentStableId()
        if (!stableId) throw new Error(t('horseForm.noStableFound'))
        const insertPayload: HorseInsert = { ...payload, stable_id: stableId }
        const created = await createHorse(insertPayload)
        navigate(`/horses/${created.id}`)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (loading)
    return <p className="text-sm text-slate-500">{t('horseForm.loading')}</p>

  return (
    <div className="page-shell">
      <h1 className="text-3xl font-semibold text-slate-900">
        {isEdit ? t('horseForm.editHorse') : t('horseForm.newHorse')}
      </h1>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <form
        onSubmit={handleSubmit}
        className="panel grid gap-4 p-5 sm:grid-cols-2"
      >
        <label>
          <span className="field-label">{t('horseForm.name')}</span>
          <input
            required
            className="field"
            value={form.name}
            onChange={(e) => updateField('name', e.target.value)}
          />
        </label>
        <label>
          <span className="field-label">{t('horseForm.breed')}</span>
          <input
            className="field"
            value={form.breed}
            onChange={(e) => updateField('breed', e.target.value)}
          />
        </label>
        <label>
          <span className="field-label">{t('horseForm.age')}</span>
          <input
            type="number"
            className="field"
            value={form.age}
            onChange={(e) => updateField('age', e.target.value)}
          />
        </label>
        <label>
          <span className="field-label">{t('horseForm.gender')}</span>
          <input
            className="field"
            value={form.gender}
            onChange={(e) => updateField('gender', e.target.value)}
          />
        </label>
        <label>
          <span className="field-label">{t('horseForm.color')}</span>
          <input
            className="field"
            value={form.color}
            onChange={(e) => updateField('color', e.target.value)}
          />
        </label>
        <label>
          <span className="field-label">{t('horseForm.owner')}</span>
          <select
            className="field"
            value={form.owner_id}
            onChange={(e) => updateField('owner_id', e.target.value)}
          >
            <option value="">—</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.full_name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">{t('horseForm.stall')}</span>
          <select
            className="field"
            value={form.stall_id}
            onChange={(e) => updateField('stall_id', e.target.value)}
          >
            <option value="">—</option>
            {stalls.map((stall) => (
              <option key={stall.id} value={stall.id}>
                {stall.stall_number}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">{t('horseForm.arrivalDate')}</span>
          <input
            type="date"
            className="field"
            value={form.arrival_date}
            onChange={(e) => updateField('arrival_date', e.target.value)}
          />
        </label>
        <label>
          <span className="field-label">{t('horseForm.passportNumber')}</span>
          <input
            className="field"
            value={form.passport_number}
            onChange={(e) => updateField('passport_number', e.target.value)}
          />
        </label>
        <label>
          <span className="field-label">{t('horseForm.microchipNumber')}</span>
          <input
            className="field"
            value={form.microchip_number}
            onChange={(e) => updateField('microchip_number', e.target.value)}
          />
        </label>
        <label>
          <span className="field-label">{t('horseForm.insuranceCompany')}</span>
          <input
            className="field"
            value={form.insurance_company}
            onChange={(e) => updateField('insurance_company', e.target.value)}
          />
        </label>
        <label>
          <span className="field-label">{t('horseForm.insuranceNumber')}</span>
          <input
            className="field"
            value={form.insurance_number}
            onChange={(e) => updateField('insurance_number', e.target.value)}
          />
        </label>
        <label>
          <span className="field-label">
            {t('horseForm.vaccinationStatus')}
          </span>
          <input
            className="field"
            value={form.vaccination_status}
            onChange={(e) => updateField('vaccination_status', e.target.value)}
          />
        </label>
        <label className="sm:col-span-2">
          <span className="field-label">{t('horseForm.allergies')}</span>
          <textarea
            className="field"
            value={form.allergies}
            onChange={(e) => updateField('allergies', e.target.value)}
          />
        </label>
        <label className="sm:col-span-2">
          <span className="field-label">{t('horseForm.feedingNotes')}</span>
          <textarea
            className="field"
            value={form.feeding_notes}
            onChange={(e) => updateField('feeding_notes', e.target.value)}
          />
        </label>
        <label className="sm:col-span-2">
          <span className="field-label">{t('horseForm.medicalNotes')}</span>
          <textarea
            className="field"
            value={form.medical_notes}
            onChange={(e) => updateField('medical_notes', e.target.value)}
          />
        </label>
        <label className="sm:col-span-2">
          <span className="field-label">{t('horseForm.generalNotes')}</span>
          <textarea
            className="field"
            value={form.notes}
            onChange={(e) => updateField('notes', e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => updateField('active', e.target.checked)}
          />
          {t('horseForm.active')}
        </label>

        <div className="sm:col-span-2">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </form>
    </div>
  )
}
