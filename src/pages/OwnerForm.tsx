import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  createOwner,
  getOwner,
  updateOwner,
  type OwnerInsert,
} from '../features/owners/api'
import { usePreferences } from '../lib/PreferencesContext'
import { getCurrentStableId } from '../lib/stableContext'

type FormState = {
  full_name: string
  phone: string
  email: string
  address: string
  city: string
  postal_code: string
  emergency_contact: string
  emergency_phone: string
  notes: string
}

const emptyForm: FormState = {
  full_name: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  postal_code: '',
  emergency_contact: '',
  emergency_phone: '',
  notes: '',
}

export default function OwnerForm() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { t } = usePreferences()

  const [form, setForm] = useState<FormState>(emptyForm)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    getOwner(id)
      .then((owner) => {
        if (cancelled) return
        setForm({
          full_name: owner.full_name,
          phone: owner.phone ?? '',
          email: owner.email ?? '',
          address: owner.address ?? '',
          city: owner.city ?? '',
          postal_code: owner.postal_code ?? '',
          emergency_contact: owner.emergency_contact ?? '',
          emergency_phone: owner.emergency_phone ?? '',
          notes: owner.notes ?? '',
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
        full_name: form.full_name,
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        city: form.city || null,
        postal_code: form.postal_code || null,
        emergency_contact: form.emergency_contact || null,
        emergency_phone: form.emergency_phone || null,
        notes: form.notes || null,
      }

      if (isEdit && id) {
        await updateOwner(id, payload)
        navigate(`/owners/${id}`)
      } else {
        const stableId = await getCurrentStableId()
        if (!stableId) throw new Error(t('ownerForm.noStableFound'))
        const insertPayload: OwnerInsert = { ...payload, stable_id: stableId }
        const created = await createOwner(insertPayload)
        navigate(`/owners/${created.id}`)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (loading)
    return <p className="text-sm text-slate-500">{t('ownerForm.loading')}</p>

  return (
    <div className="page-shell">
      <h1 className="text-3xl font-semibold text-slate-900">
        {isEdit ? t('ownerForm.editOwner') : t('ownerForm.newOwner')}
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
          <span className="field-label">{t('ownerForm.fullName')}</span>
          <input
            required
            className="field"
            value={form.full_name}
            onChange={(e) => updateField('full_name', e.target.value)}
          />
        </label>
        <label>
          <span className="field-label">{t('ownerForm.phone')}</span>
          <input
            type="tel"
            className="field"
            value={form.phone}
            onChange={(e) => updateField('phone', e.target.value)}
          />
        </label>
        <label>
          <span className="field-label">{t('ownerForm.email')}</span>
          <input
            type="email"
            className="field"
            value={form.email}
            onChange={(e) => updateField('email', e.target.value)}
          />
        </label>
        <label className="sm:col-span-2">
          <span className="field-label">{t('ownerForm.address')}</span>
          <input
            className="field"
            value={form.address}
            onChange={(e) => updateField('address', e.target.value)}
          />
        </label>
        <label>
          <span className="field-label">{t('ownerForm.city')}</span>
          <input
            className="field"
            value={form.city}
            onChange={(e) => updateField('city', e.target.value)}
          />
        </label>
        <label>
          <span className="field-label">{t('ownerForm.postalCode')}</span>
          <input
            className="field"
            value={form.postal_code}
            onChange={(e) => updateField('postal_code', e.target.value)}
          />
        </label>
        <label>
          <span className="field-label">{t('ownerForm.emergencyContact')}</span>
          <input
            className="field"
            value={form.emergency_contact}
            onChange={(e) => updateField('emergency_contact', e.target.value)}
          />
        </label>
        <label>
          <span className="field-label">{t('ownerForm.emergencyPhone')}</span>
          <input
            type="tel"
            className="field"
            value={form.emergency_phone}
            onChange={(e) => updateField('emergency_phone', e.target.value)}
          />
        </label>
        <label className="sm:col-span-2">
          <span className="field-label">{t('ownerForm.notes')}</span>
          <textarea
            className="field"
            value={form.notes}
            onChange={(e) => updateField('notes', e.target.value)}
          />
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
