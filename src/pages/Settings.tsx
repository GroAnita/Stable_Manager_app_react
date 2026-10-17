import { useEffect, useState, type FormEvent } from 'react'
import { Icon, type IconName } from '../components/Icon'
import {
  getMyProfile,
  getStable,
  updateStable,
  uploadStableLogo,
  type Profile,
  type Stable,
} from '../features/settings/api'
import { useAuth } from '../lib/AuthContext'
import {
  usePreferences,
  type Currency,
  type Language,
  type Theme,
} from '../lib/PreferencesContext'
import { StaffAccessPanel } from './settings/StaffAccessPanel'

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

type SettingsSection =
  | 'stableInfo'
  | 'subscription'
  | 'feedingRounds'
  | 'staffAccess'
  | 'billing'
  | 'integrations'
  | 'account'
  | 'languageAppearance'

type SettingsNavItem = {
  key: SettingsSection
  labelKey: string
  icon: IconName
  badgeKey?: string
}

const SETTINGS_NAV: { groupKey: string; items: SettingsNavItem[] }[] = [
  {
    groupKey: 'settings.navGroupStable',
    items: [
      { key: 'stableInfo', labelKey: 'settings.navStableInfo', icon: 'home' },
      {
        key: 'subscription',
        labelKey: 'settings.navSubscription',
        icon: 'creditCard',
        badgeKey: 'settings.navSubscriptionBadge',
      },
    ],
  },
  {
    groupKey: 'settings.navGroupOperations',
    items: [
      {
        key: 'feedingRounds',
        labelKey: 'settings.navFeedingRounds',
        icon: 'clock',
      },
    ],
  },
  {
    groupKey: 'settings.navGroupPeople',
    items: [
      {
        key: 'staffAccess',
        labelKey: 'settings.navStaffAccess',
        icon: 'users',
      },
    ],
  },
  {
    groupKey: 'settings.navGroupFinance',
    items: [
      { key: 'billing', labelKey: 'settings.navBilling', icon: 'fileText' },
      {
        key: 'integrations',
        labelKey: 'settings.navIntegrations',
        icon: 'key',
      },
    ],
  },
  {
    groupKey: 'settings.navGroupMe',
    items: [
      { key: 'account', labelKey: 'settings.navAccount', icon: 'user' },
      {
        key: 'languageAppearance',
        labelKey: 'settings.navLanguageAppearance',
        icon: 'sun',
      },
    ],
  },
]

function ComingSoonPanel({ labelKey }: { labelKey: string }) {
  const { t } = usePreferences()
  return (
    <div className="panel p-6">
      <h2 className="section-title">{t(labelKey)}</h2>
      <p className="mt-3 text-sm text-slate-500">{t('settings.comingSoon')}</p>
      <p className="mt-1 text-sm text-slate-400">
        {t('settings.comingSoonHint')}
      </p>
    </div>
  )
}

export default function Settings() {
  const { session } = useAuth()
  const { t, language, setLanguage, currency, setCurrency, theme, setTheme } =
    usePreferences()
  const [section, setSection] = useState<SettingsSection>('stableInfo')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [stable, setStable] = useState<Stable | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoError, setLogoError] = useState<string | null>(null)

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

  async function handleLogoChange(file: File | undefined) {
    if (!file || !stable) return
    setLogoUploading(true)
    setLogoError(null)
    try {
      const logoUrl = await uploadStableLogo({ stableId: stable.id, file })
      const updated = await updateStable(stable.id, { logo_url: logoUrl })
      setStable(updated)
    } catch (err) {
      setLogoError((err as Error).message)
    } finally {
      setLogoUploading(false)
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

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <nav className="flex shrink-0 flex-col gap-4 lg:w-64">
          {SETTINGS_NAV.map((group) => (
            <div key={group.groupKey}>
              <p className="px-3 text-xs font-semibold tracking-wide text-slate-400 uppercase">
                {t(group.groupKey)}
              </p>
              <div className="mt-1 flex flex-col gap-1">
                {group.items.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setSection(item.key)}
                    className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-medium ${
                      section === item.key
                        ? 'bg-forest/10 text-forest'
                        : 'text-ink/70 hover:bg-card'
                    }`}
                  >
                    <Icon name={item.icon} className="h-5 w-5 shrink-0" />
                    <span className="flex-1">{t(item.labelKey)}</span>
                    {item.badgeKey && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        {t(item.badgeKey)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="min-w-0 flex-1 space-y-6">
          {section === 'stableInfo' &&
            (stable && form ? (
              <form onSubmit={handleSubmit} className="panel p-6">
                <h2 className="section-title">
                  {t('settings.stableInformation')}
                </h2>
                {!canEdit && (
                  <p className="mt-2 text-sm text-slate-500">
                    {t('settings.onlyOwnerCanEdit')}
                  </p>
                )}

                <div className="mt-5 flex items-center gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-forest/10 text-xl font-semibold text-forest">
                    {stable.logo_url ? (
                      <img
                        src={stable.logo_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      stable.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  {canEdit && (
                    <label>
                      <span className="field-label">
                        {t('settings.stableLogo')}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={logoUploading}
                        className="field"
                        onChange={(e) => handleLogoChange(e.target.files?.[0])}
                      />
                      {logoUploading && (
                        <span className="mt-1 block text-xs text-slate-400">
                          {t('settings.uploadingLogo')}
                        </span>
                      )}
                      {logoError && (
                        <span className="mt-1 block text-xs text-red-600">
                          {logoError}
                        </span>
                      )}
                    </label>
                  )}
                </div>

                <div className="mt-5 grid gap-5 md:grid-cols-2">
                  <label>
                    <span className="field-label">
                      {t('settings.stableName')}
                    </span>
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
                    <span className="field-label">
                      {t('settings.address')}
                    </span>
                    <input
                      disabled={!canEdit}
                      className="field"
                      value={form.address}
                      onChange={(e) => updateField('address', e.target.value)}
                    />
                  </label>
                  <label>
                    <span className="field-label">
                      {t('settings.postalCode')}
                    </span>
                    <input
                      disabled={!canEdit}
                      className="field"
                      value={form.postal_code}
                      onChange={(e) =>
                        updateField('postal_code', e.target.value)
                      }
                    />
                  </label>
                </div>
                {canEdit && (
                  <div className="mt-6 flex items-center justify-end gap-3">
                    {saved && (
                      <span role="status" className="text-sm text-emerald-700">
                        {t('common.saved')}
                      </span>
                    )}
                    <button
                      type="submit"
                      disabled={saving}
                      className="btn-primary"
                    >
                      {saving ? t('common.saving') : t('settings.saveSettings')}
                    </button>
                  </div>
                )}
              </form>
            ) : (
              <div className="panel p-6 text-sm text-slate-500">
                {t('settings.noStableFound')}
              </div>
            ))}

          {section === 'subscription' && (
            <ComingSoonPanel labelKey="settings.navSubscription" />
          )}
          {section === 'feedingRounds' && (
            <ComingSoonPanel labelKey="settings.navFeedingRounds" />
          )}
          {section === 'billing' && (
            <ComingSoonPanel labelKey="settings.navBilling" />
          )}
          {section === 'integrations' && (
            <ComingSoonPanel labelKey="settings.navIntegrations" />
          )}

          {section === 'staffAccess' && canEdit && profile?.stable_id && session && (
            <StaffAccessPanel
              stableId={profile.stable_id}
              createdBy={session.user.id}
            />
          )}
          {section === 'staffAccess' && !canEdit && (
            <div className="panel p-6 text-sm text-slate-500">
              {t('settings.onlyOwnerCanEdit')}
            </div>
          )}

          {section === 'account' && (
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
          )}

          {section === 'languageAppearance' && (
            <div className="panel p-6">
              <h2 className="section-title">{t('settings.preferences')}</h2>
              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <label>
                  <span className="field-label">
                    {t('settings.language')}
                  </span>
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
                  <span className="field-label">
                    {t('settings.currency')}
                  </span>
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
                <label>
                  <span className="field-label">{t('settings.theme')}</span>
                  <select
                    className="field"
                    value={theme}
                    onChange={(e) => setTheme(e.target.value as Theme)}
                  >
                    <option value="system">{t('settings.themeSystem')}</option>
                    <option value="light">{t('settings.themeLight')}</option>
                    <option value="dark">{t('settings.themeDark')}</option>
                  </select>
                </label>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
