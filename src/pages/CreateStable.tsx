import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { createStable } from '../features/settings/api'
import { useAuth } from '../lib/AuthContext'
import { usePreferences } from '../lib/PreferencesContext'

type FormState = {
  name: string
  address: string
  city: string
  postal_code: string
  phone: string
  email: string
}

const emptyForm: FormState = {
  name: '',
  address: '',
  city: '',
  postal_code: '',
  phone: '',
  email: '',
}

export default function CreateStable() {
  const { t } = usePreferences()
  const { refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await createStable({
        name: form.name,
        address: form.address || null,
        city: form.city || null,
        postal_code: form.postal_code || null,
        phone: form.phone || null,
        email: form.email || null,
      })
      await refreshProfile()
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4 py-10">
      <div className="panel w-full max-w-lg p-6">
        <h1 className="text-2xl font-semibold text-slate-900">
          {t('onboarding.title')}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {t('onboarding.subtitle')}
        </p>
        <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          <label>
            <span className="field-label">{t('settings.stableName')}</span>
            <input
              required
              className="field"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
            />
          </label>
          <label>
            <span className="field-label">{t('settings.phone')}</span>
            <input
              type="tel"
              className="field"
              value={form.phone}
              onChange={(e) => updateField('phone', e.target.value)}
            />
          </label>
          <label>
            <span className="field-label">{t('settings.email')}</span>
            <input
              type="email"
              className="field"
              value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
            />
          </label>
          <label>
            <span className="field-label">{t('settings.city')}</span>
            <input
              className="field"
              value={form.city}
              onChange={(e) => updateField('city', e.target.value)}
            />
          </label>
          <label>
            <span className="field-label">{t('settings.address')}</span>
            <input
              className="field"
              value={form.address}
              onChange={(e) => updateField('address', e.target.value)}
            />
          </label>
          <label>
            <span className="field-label">{t('settings.postalCode')}</span>
            <input
              className="field"
              value={form.postal_code}
              onChange={(e) => updateField('postal_code', e.target.value)}
            />
          </label>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? t('common.saving') : t('onboarding.createStable')}
          </button>
        </form>
      </div>
    </div>
  )
}
