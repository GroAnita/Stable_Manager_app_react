import { useEffect, useState, type FormEvent } from 'react'
import { createStaffInvite, inviteUrl } from '../features/invites/api'
import {
  getMyProfile,
  getStable,
  updateStable,
  type Profile,
  type Stable,
} from '../features/settings/api'
import { useAuth } from '../lib/AuthContext'
import {
  usePreferences,
  type Currency,
  type Language,
} from '../lib/PreferencesContext'

type FormState = {
  name: string
  phone: string
  email: string
  address: string
  city: string
  postal_code: string
}

function toFormState(stable: Stable): FormState {
  return {
    name: stable.name,
    phone: stable.phone ?? '',
    email: stable.email ?? '',
    address: stable.address ?? '',
    city: stable.city ?? '',
    postal_code: stable.postal_code ?? '',
  }
}

const CURRENCY_OPTIONS: Currency[] = ['EUR', 'NOK', 'SEK', 'GBP']

export default function Settings() {
  const { session } = useAuth()
  const { t, language, setLanguage, currency, setCurrency } = usePreferences()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [stable, setStable] = useState<Stable | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [staffInvite, setStaffInvite] = useState<string | null>(null)
  const [staffInviteSaving, setStaffInviteSaving] = useState(false)
  const [staffInviteError, setStaffInviteError] = useState<string | null>(
    null,
  )

  useEffect(() => {
    let cancelled = false
    getMyProfile()
      .then((profileData) => {
        if (cancelled) return
        setProfile(profileData)
        if (!profileData.stable_id) return null
        return getStable(profileData.stable_id)
      })
      .then((stableData) => {
        if (cancelled || !stableData) return
        setStable(stableData)
        setForm(toFormState(stableData))
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const canEdit = profile?.role === 'stable_owner'

  async function handleGenerateStaffInvite() {
    if (!profile?.stable_id || !session) return
    setStaffInviteSaving(true)
    setStaffInviteError(null)
    try {
      const created = await createStaffInvite({
        stableId: profile.stable_id,
        createdBy: session.user.id,
      })
      setStaffInvite(inviteUrl(created.token))
    } catch (err) {
      setStaffInviteError((err as Error).message)
    } finally {
      setStaffInviteSaving(false)
    }
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
    setSaved(false)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!stable || !form) return
    setSaving(true)
    setError(null)
    try {
      const updated = await updateStable(stable.id, {
        name: form.name,
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        city: form.city || null,
        postal_code: form.postal_code || null,
      })
      setStable(updated)
      setSaved(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (loading)
    return <p className="text-sm text-slate-500">{t('settings.loading')}</p>

  return (
    <div className="page-shell">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">
          {t('settings.title')}
        </h1>
        <p className="mt-2 text-sm text-slate-500">{t('settings.subtitle')}</p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        {stable && form ? (
          <form onSubmit={handleSubmit} className="panel p-6">
            <h2 className="section-title">{t('settings.stableInformation')}</h2>
            {!canEdit && (
              <p className="mt-2 text-sm text-slate-500">
                {t('settings.onlyOwnerCanEdit')}
              </p>
            )}
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <label>
                <span className="field-label">{t('settings.stableName')}</span>
                <input
                  required
                  disabled={!canEdit}
                  className="field"
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                />
              </label>
              <label>
                <span className="field-label">{t('settings.phone')}</span>
                <input
                  type="tel"
                  disabled={!canEdit}
                  className="field"
                  value={form.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                />
              </label>
              <label>
                <span className="field-label">{t('settings.email')}</span>
                <input
                  type="email"
                  disabled={!canEdit}
                  className="field"
                  value={form.email}
                  onChange={(e) => updateField('email', e.target.value)}
                />
              </label>
              <label>
                <span className="field-label">{t('settings.city')}</span>
                <input
                  disabled={!canEdit}
                  className="field"
                  value={form.city}
                  onChange={(e) => updateField('city', e.target.value)}
                />
              </label>
              <label className="md:col-span-2">
                <span className="field-label">{t('settings.address')}</span>
                <input
                  disabled={!canEdit}
                  className="field"
                  value={form.address}
                  onChange={(e) => updateField('address', e.target.value)}
                />
              </label>
              <label>
                <span className="field-label">{t('settings.postalCode')}</span>
                <input
                  disabled={!canEdit}
                  className="field"
                  value={form.postal_code}
                  onChange={(e) => updateField('postal_code', e.target.value)}
                />
              </label>
            </div>
            {canEdit && (
              <div className="mt-6 flex items-center justify-end gap-3">
                {saved && (
                  <span className="text-sm text-emerald-700">
                    {t('common.saved')}
                  </span>
                )}
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? t('common.saving') : t('settings.saveSettings')}
                </button>
              </div>
            )}
          </form>
        ) : (
          <div className="panel p-6 text-sm text-slate-500">
            {t('settings.noStableFound')}
          </div>
        )}

        <div className="space-y-6">
          <div className="panel p-6">
            <h2 className="section-title">{t('settings.preferences')}</h2>
            <div className="mt-5 grid gap-5">
              <label>
                <span className="field-label">{t('settings.language')}</span>
                <select
                  className="field"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as Language)}
                >
                  <option value="en">English</option>
                  <option value="no">Norsk</option>
                </select>
              </label>
              <label>
                <span className="field-label">{t('settings.currency')}</span>
                <select
                  className="field"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as Currency)}
                >
                  {CURRENCY_OPTIONS.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="panel p-6">
            <h2 className="section-title">{t('settings.account')}</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <p>
                <span className="font-medium text-slate-800">
                  {t('settings.accountEmail')}
                </span>{' '}
                {session?.user.email}
              </p>
              <p>
                <span className="font-medium text-slate-800">
                  {t('settings.accountRole')}
                </span>{' '}
                {profile?.role.replace('_', ' ') ?? '—'}
              </p>
            </div>
          </div>

          {canEdit && (
            <div className="panel p-6">
              <h2 className="section-title">{t('settings.staffInvite')}</h2>
              <p className="mt-2 text-sm text-slate-500">
                {t('settings.staffInviteHint')}
              </p>
              {staffInviteError && (
                <p role="alert" className="mt-2 text-sm text-red-600">
                  {staffInviteError}
                </p>
              )}
              {staffInvite ? (
                <input
                  readOnly
                  className="field mt-3 text-xs"
                  value={staffInvite}
                  onFocus={(e) => e.target.select()}
                />
              ) : (
                <button
                  type="button"
                  disabled={staffInviteSaving}
                  onClick={handleGenerateStaffInvite}
                  className="btn-ghost mt-3"
                >
                  {staffInviteSaving
                    ? t('common.saving')
                    : t('settings.generateStaffInvite')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
