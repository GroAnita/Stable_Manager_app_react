import { useEffect, useState, type FormEvent } from 'react'
import {
  getMyOwnerRecord,
  updateOwner,
  type Owner,
} from '../features/owners/api'
import { usePreferences } from '../lib/PreferencesContext'

type FormState = {
  full_name: string
  phone: string
  email: string
  address: string
  city: string
  postal_code: string
  emergency_contact: string
  emergency_phone: string
  payment_method: string
  notes: string
}

function toForm(owner: Owner): FormState {
  return {
    full_name: owner.full_name,
    phone: owner.phone ?? '',
    email: owner.email ?? '',
    address: owner.address ?? '',
    city: owner.city ?? '',
    postal_code: owner.postal_code ?? '',
    emergency_contact: owner.emergency_contact ?? '',
    emergency_phone: owner.emergency_phone ?? '',
    payment_method: owner.payment_method ?? '',
    notes: owner.notes ?? '',
  }
}

export default function MyProfile() {
  const { t } = usePreferences()
  const [owner, setOwner] = useState<Owner | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let cancelled = false
    getMyOwnerRecord()
      .then((data) => {
        if (cancelled) return
        setOwner(data)
        if (data) setForm(toForm(data))
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
    setSaved(false)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!owner || !form) return
    setSaving(true)
    setError(null)
    try {
      const updated = await updateOwner(owner.id, {
        full_name: form.full_name,
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        city: form.city || null,
        postal_code: form.postal_code || null,
        emergency_contact: form.emergency_contact || null,
        emergency_phone: form.emergency_phone || null,
        payment_method: form.payment_method || null,
        notes: form.notes || null,
      })
      setOwner(updated)
      setSaved(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (loading)
    return <p className="text-sm text-slate-500">{t('myProfile.loading')}</p>

  return (
    <div className="page-shell">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">
          {t('myProfile.title')}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {t('myProfile.subtitle')}
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      {!owner || !form ? (
        <div className="panel p-6 text-sm text-slate-500">
          {t('myProfile.noRecord')}
        </div>
      ) : (
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
          <label>
            <span className="field-label">{t('ownerForm.billing')}</span>
            <input
              className="field"
              value={form.payment_method}
              onChange={(e) => updateField('payment_method', e.target.value)}
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
            <span className="field-label">
              {t('ownerForm.emergencyContact')}
            </span>
            <input
              className="field"
              value={form.emergency_contact}
              onChange={(e) =>
                updateField('emergency_contact', e.target.value)
              }
            />
          </label>
          <label>
            <span className="field-label">
              {t('ownerForm.emergencyPhone')}
            </span>
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

          <div className="sm:col-span-2 flex items-center gap-3">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? t('common.saving') : t('common.save')}
            </button>
            {saved && (
              <span className="text-sm text-emerald-700">
                {t('common.saved')}
              </span>
            )}
          </div>
        </form>
      )}
    </div>
  )
}
