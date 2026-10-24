import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Icon } from '../../components/Icon'
import { searchBrregCompanies, type BrregCompany } from '../../features/billing/brreg'
import { updateStable, type Stable } from '../../features/settings/api'
import { usePreferences } from '../../lib/PreferencesContext'

type FormState = {
  name: string
  org_number: string
  vat_registered: boolean
  business_register_registered: boolean
  address: string
  postal_code: string
  city: string
  email: string
  phone: string
  bank_account_number: string
  payment_terms_days: string
  invoice_footer_text: string
}

function toFormState(stable: Stable): FormState {
  return {
    name: stable.name,
    org_number: stable.org_number ?? '',
    vat_registered: stable.vat_registered,
    business_register_registered: stable.business_register_registered,
    address: stable.address ?? '',
    postal_code: stable.postal_code ?? '',
    city: stable.city ?? '',
    email: stable.email ?? '',
    phone: stable.phone ?? '',
    bank_account_number: stable.bank_account_number ?? '',
    payment_terms_days: String(stable.payment_terms_days),
    invoice_footer_text: stable.invoice_footer_text ?? '',
  }
}

export function BillingPanel({
  stable,
  canEdit,
  onChange,
}: {
  stable: Stable
  canEdit: boolean
  onChange: (stable: Stable) => void
}) {
  const { t } = usePreferences()
  const [form, setForm] = useState<FormState>(() => toFormState(stable))
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<BrregCompany[]>([])
  const [searching, setSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const trimmed = query.trim()
    debounceRef.current = setTimeout(() => {
      if (trimmed.length < 3) {
        setResults([])
        return
      }
      setSearching(true)
      searchBrregCompanies(trimmed)
        .then((hits) => {
          setResults(hits)
          setShowResults(true)
        })
        .catch(() => setResults([]))
        .finally(() => setSearching(false))
    }, 350)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  function applyResult(hit: BrregCompany) {
    setForm((prev) => ({
      ...prev,
      name: hit.name,
      org_number: hit.orgNumber,
      vat_registered: hit.vatRegistered,
      business_register_registered: hit.businessRegisterRegistered,
      address: hit.address || prev.address,
      postal_code: hit.postalCode || prev.postal_code,
      city: hit.city || prev.city,
    }))
    setQuery('')
    setResults([])
    setShowResults(false)
    setSaved(false)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const paymentTermsDays = Number(form.payment_terms_days)
      const updated = await updateStable(stable.id, {
        name: form.name,
        org_number: form.org_number.replace(/\s/g, '') || null,
        vat_registered: form.vat_registered,
        business_register_registered: form.business_register_registered,
        address: form.address || null,
        postal_code: form.postal_code || null,
        city: form.city || null,
        email: form.email || null,
        phone: form.phone || null,
        bank_account_number: form.bank_account_number.replace(/\s/g, '') || null,
        payment_terms_days: Number.isFinite(paymentTermsDays)
          ? paymentTermsDays
          : 14,
        invoice_footer_text: form.invoice_footer_text || null,
      })
      onChange(updated)
      setForm(toFormState(updated))
      setSaved(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="panel p-6">
      <div className="flex items-start gap-4 border-b border-slate-100 pb-5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-forest/10 text-forest">
          <Icon name="fileText" className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            {t('settings.billingSenderTitle')}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {t('settings.billingSenderSubtitle')}
          </p>
        </div>
      </div>

      {!canEdit && (
        <p className="mt-4 text-sm text-slate-500">
          {t('settings.onlyOwnerCanEdit')}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="relative mt-6">
        <label>
          <span className="field-label">{t('settings.billingSearch')}</span>
          <input
            disabled={!canEdit}
            className="field"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setShowResults(true)}
            onBlur={() => setTimeout(() => setShowResults(false), 150)}
            placeholder={t('settings.billingSearchPlaceholder')}
          />
        </label>
        <p className="mt-1 text-xs text-slate-400">
          {t('settings.billingSearchHint')}
        </p>
        {showResults && (searching || results.length > 0) && (
          <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
            {searching && (
              <p className="px-4 py-3 text-sm text-slate-400">
                {t('common.loading')}
              </p>
            )}
            {!searching &&
              results.map((hit) => (
                <button
                  key={hit.orgNumber}
                  type="button"
                  onMouseDown={() => applyResult(hit)}
                  className="block w-full px-4 py-3 text-left text-sm hover:bg-forest/5"
                >
                  <span className="font-medium text-slate-900">
                    {hit.name}
                  </span>
                  <span className="ml-2 text-slate-400">{hit.orgNumber}</span>
                </button>
              ))}
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <label>
          <span className="field-label">{t('settings.billingCompanyName')}</span>
          <input
            required
            disabled={!canEdit}
            className="field"
            value={form.name}
            onChange={(e) => updateField('name', e.target.value)}
          />
        </label>
        <label>
          <span className="field-label">{t('settings.billingOrgNumber')}</span>
          <input
            disabled={!canEdit}
            className="field"
            inputMode="numeric"
            maxLength={9}
            value={form.org_number}
            onChange={(e) => updateField('org_number', e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-400">
            {t('settings.billingDigitsHint', { count: 9 })}
          </p>
        </label>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-8">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            disabled={!canEdit}
            className="h-4 w-4"
            checked={form.vat_registered}
            onChange={(e) => updateField('vat_registered', e.target.checked)}
          />
          <span className="text-sm text-slate-700">
            {t('settings.billingVatRegistered')}
          </span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            disabled={!canEdit}
            className="h-4 w-4"
            checked={form.business_register_registered}
            onChange={(e) =>
              updateField('business_register_registered', e.target.checked)
            }
          />
          <span className="text-sm text-slate-700">
            {t('settings.billingBusinessRegisterRegistered')}
          </span>
        </label>
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
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
        <label>
          <span className="field-label">{t('settings.city')}</span>
          <input
            disabled={!canEdit}
            className="field"
            value={form.city}
            onChange={(e) => updateField('city', e.target.value)}
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
          <span className="field-label">{t('settings.phone')}</span>
          <input
            type="tel"
            disabled={!canEdit}
            className="field"
            value={form.phone}
            onChange={(e) => updateField('phone', e.target.value)}
          />
        </label>
      </div>

      <h3 className="section-title mt-8">{t('settings.billingPaymentTitle')}</h3>
      <div className="mt-4 grid gap-5 md:grid-cols-2">
        <label>
          <span className="field-label">
            {t('settings.billingBankAccountNumber')}
          </span>
          <input
            disabled={!canEdit}
            className="field"
            inputMode="numeric"
            value={form.bank_account_number}
            onChange={(e) =>
              updateField('bank_account_number', e.target.value)
            }
          />
          <p className="mt-1 text-xs text-slate-400">
            {t('settings.billingBankAccountHint')}
          </p>
        </label>
        <label>
          <span className="field-label">
            {t('settings.billingPaymentTermsDays')}
          </span>
          <input
            type="number"
            min={1}
            disabled={!canEdit}
            className="field"
            value={form.payment_terms_days}
            onChange={(e) =>
              updateField('payment_terms_days', e.target.value)
            }
          />
        </label>
      </div>

      <label className="mt-5 block">
        <span className="field-label">{t('settings.billingFooterText')}</span>
        <textarea
          disabled={!canEdit}
          className="field min-h-24"
          value={form.invoice_footer_text}
          onChange={(e) => updateField('invoice_footer_text', e.target.value)}
        />
      </label>

      {canEdit && (
        <div className="mt-6 flex items-center justify-end gap-3">
          {saved && (
            <span role="status" className="text-sm text-emerald-700">
              {t('common.saved')}
            </span>
          )}
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? t('common.saving') : t('settings.billingSave')}
          </button>
        </div>
      )}
    </form>
  )
}
