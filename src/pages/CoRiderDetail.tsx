import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/Icon'
import {
  createCoRiderAgreement,
  deleteCoRider,
  deleteCoRiderAgreement,
  getCoRider,
  listCoRiderAgreements,
  listHorsesForPicker,
  type CoRider,
  type CoRiderAgreementWithHorse,
  type HorsePickerOption,
} from '../features/co-riders/api'
import { usePreferences } from '../lib/PreferencesContext'
import { getCurrentStableId } from '../lib/stableContext'

type AgreementFormState = {
  horse_id: string
  fee_amount: string
  billing_frequency: '' | 'per_session' | 'monthly'
  start_date: string
  end_date: string
  stable_duties: string
}

const emptyAgreementForm: AgreementFormState = {
  horse_id: '',
  fee_amount: '',
  billing_frequency: '',
  start_date: '',
  end_date: '',
  stable_duties: '',
}

export default function CoRiderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = usePreferences()

  const [coRider, setCoRider] = useState<CoRider | null>(null)
  const [agreements, setAgreements] = useState<CoRiderAgreementWithHorse[]>([])
  const [horses, setHorses] = useState<HorsePickerOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showAddForm, setShowAddForm] = useState(false)
  const [agreementForm, setAgreementForm] = useState<AgreementFormState>(
    emptyAgreementForm,
  )
  const [agreementSaving, setAgreementSaving] = useState(false)
  const [agreementError, setAgreementError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    Promise.all([getCoRider(id), listCoRiderAgreements(id), listHorsesForPicker()])
      .then(([coRiderData, agreementsData, horsesData]) => {
        if (cancelled) return
        setCoRider(coRiderData)
        setAgreements(agreementsData)
        setHorses(horsesData)
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
  }, [id])

  async function handleDelete() {
    if (
      !id ||
      !coRider ||
      !window.confirm(
        t('coRiderDetail.confirmDelete', { name: coRider.full_name }),
      )
    )
      return
    await deleteCoRider(id)
    navigate('/co-riders')
  }

  function updateAgreementField<K extends keyof AgreementFormState>(
    key: K,
    value: AgreementFormState[K],
  ) {
    setAgreementForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleAddAgreement(event: FormEvent) {
    event.preventDefault()
    if (!id) return
    setAgreementSaving(true)
    setAgreementError(null)
    try {
      const stableId = await getCurrentStableId()
      if (!stableId) throw new Error(t('coRiderForm.noStableFound'))
      await createCoRiderAgreement({
        stable_id: stableId,
        co_rider_id: id,
        horse_id: agreementForm.horse_id,
        fee_amount: agreementForm.fee_amount
          ? Number(agreementForm.fee_amount)
          : null,
        billing_frequency: agreementForm.billing_frequency || null,
        start_date: agreementForm.start_date || null,
        end_date: agreementForm.end_date || null,
        stable_duties: agreementForm.stable_duties || null,
      })
      const refreshed = await listCoRiderAgreements(id)
      setAgreements(refreshed)
      setAgreementForm(emptyAgreementForm)
      setShowAddForm(false)
    } catch (err) {
      setAgreementError((err as Error).message)
    } finally {
      setAgreementSaving(false)
    }
  }

  async function handleRemoveAgreement(agreementId: string) {
    if (!id || !window.confirm(t('coRiderDetail.confirmRemoveLink'))) return
    await deleteCoRiderAgreement(agreementId)
    const refreshed = await listCoRiderAgreements(id)
    setAgreements(refreshed)
  }

  if (loading)
    return (
      <p className="text-sm text-slate-500">{t('coRiderDetail.loading')}</p>
    )
  if (error)
    return (
      <p role="alert" className="text-sm text-red-600">
        {t('coRiderDetail.failedToLoad', { error })}
      </p>
    )
  if (!coRider)
    return (
      <p className="text-sm text-slate-500">{t('coRiderDetail.notFound')}</p>
    )

  const contactFields: [string, string][] = [
    [t('coRiderDetail.phone'), coRider.phone ?? '—'],
    [t('coRiderDetail.email'), coRider.email ?? '—'],
  ]

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="text-sm tracking-[0.25em] text-slate-400 uppercase">
            {t('coRiderDetail.profile')}
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">
            {coRider.full_name}
          </h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to={`/co-riders/${coRider.id}/edit`} className="btn-ghost">
            <Icon name="edit" className="h-4 w-4" />
            {t('coRiderDetail.edit')}
          </Link>
          <button type="button" onClick={handleDelete} className="btn-secondary">
            <Icon name="trash" className="h-4 w-4" />
            {t('coRiderDetail.deleteCoRider')}
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1.4fr]">
        <div className="space-y-6">
          <div className="panel p-5">
            <h2 className="section-title">{t('coRiderDetail.contactInfo')}</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              {contactFields.map(([label, value]) => (
                <p key={label}>
                  <span className="font-medium text-slate-800">{label}:</span>{' '}
                  {value}
                </p>
              ))}
            </div>
          </div>
          {coRider.notes && (
            <div className="panel p-5">
              <h2 className="section-title">{t('coRiderDetail.notes')}</h2>
              <p className="mt-3 text-sm text-slate-600">{coRider.notes}</p>
            </div>
          )}
        </div>

        <div className="panel p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="section-title">{t('coRiderDetail.horseLinks')}</h2>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setShowAddForm((prev) => !prev)}
            >
              <Icon name="plus" className="h-4 w-4" />
              {t('coRiderDetail.addHorseLink')}
            </button>
          </div>

          {showAddForm && (
            <form
              onSubmit={handleAddAgreement}
              className="mb-5 grid gap-3 rounded-2xl border border-slate-100 p-4 sm:grid-cols-2"
            >
              {agreementError && (
                <p role="alert" className="text-sm text-red-600 sm:col-span-2">
                  {agreementError}
                </p>
              )}
              <label className="sm:col-span-2">
                <span className="field-label">
                  {t('coRiderDetail.horse')}
                </span>
                <select
                  required
                  className="field"
                  value={agreementForm.horse_id}
                  onChange={(e) =>
                    updateAgreementField('horse_id', e.target.value)
                  }
                >
                  <option value="" disabled>
                    {t('coRiderDetail.selectHorse')}
                  </option>
                  {horses.map((horse) => (
                    <option key={horse.id} value={horse.id}>
                      {horse.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="field-label">
                  {t('coRiderDetail.feeAmount')}
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="field"
                  value={agreementForm.fee_amount}
                  onChange={(e) =>
                    updateAgreementField('fee_amount', e.target.value)
                  }
                />
              </label>
              <label>
                <span className="field-label">
                  {t('coRiderDetail.billingFrequency')}
                </span>
                <select
                  className="field"
                  value={agreementForm.billing_frequency}
                  onChange={(e) =>
                    updateAgreementField(
                      'billing_frequency',
                      e.target.value as AgreementFormState['billing_frequency'],
                    )
                  }
                >
                  <option value="">{t('coRiderDetail.frequencyNone')}</option>
                  <option value="per_session">
                    {t('coRiderDetail.frequencyPerSession')}
                  </option>
                  <option value="monthly">
                    {t('coRiderDetail.frequencyMonthly')}
                  </option>
                </select>
              </label>
              <label>
                <span className="field-label">
                  {t('coRiderDetail.startDate')}
                </span>
                <input
                  type="date"
                  className="field"
                  value={agreementForm.start_date}
                  onChange={(e) =>
                    updateAgreementField('start_date', e.target.value)
                  }
                />
              </label>
              <label>
                <span className="field-label">
                  {t('coRiderDetail.endDate')}
                </span>
                <input
                  type="date"
                  className="field"
                  value={agreementForm.end_date}
                  onChange={(e) =>
                    updateAgreementField('end_date', e.target.value)
                  }
                />
              </label>
              <label className="sm:col-span-2">
                <span className="field-label">
                  {t('coRiderDetail.stableDuties')}
                </span>
                <textarea
                  className="field"
                  value={agreementForm.stable_duties}
                  onChange={(e) =>
                    updateAgreementField('stable_duties', e.target.value)
                  }
                />
              </label>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={agreementSaving}
                  className="btn-primary"
                >
                  {agreementSaving ? t('common.saving') : t('common.save')}
                </button>
              </div>
            </form>
          )}

          {agreements.length === 0 ? (
            <EmptyState
              title={t('coRiderDetail.noLinksTitle')}
              message={t('coRiderDetail.noLinksMessage')}
            />
          ) : (
            <div className="grid gap-3">
              {agreements.map((agreement) => (
                <div
                  key={agreement.id}
                  className="rounded-2xl border border-slate-100 p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-slate-900">
                      {agreement.horse?.name ?? '—'}
                    </p>
                    <button
                      type="button"
                      className="text-sm text-red-600 hover:underline"
                      onClick={() => handleRemoveAgreement(agreement.id)}
                    >
                      {t('coRiderDetail.removeLink')}
                    </button>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {agreement.fee_amount != null
                      ? t('coRiderDetail.feeSummary', {
                          amount: String(agreement.fee_amount),
                          frequency:
                            agreement.billing_frequency === 'monthly'
                              ? t('coRiderDetail.frequencyMonthly')
                              : agreement.billing_frequency === 'per_session'
                                ? t('coRiderDetail.frequencyPerSession')
                                : t('coRiderDetail.frequencyNone'),
                        })
                      : t('coRiderDetail.noFeeSet')}
                  </p>
                  {agreement.stable_duties && (
                    <p className="mt-2 text-sm text-slate-500">
                      {t('coRiderDetail.stableDuties')}:{' '}
                      {agreement.stable_duties}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
