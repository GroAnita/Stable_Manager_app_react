import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ForageResult } from '../../components/forage/ForageResult'
import {
  useForageNumber,
  workloadLabelKey,
} from '../../components/forage/format'
import { Icon } from '../../components/Icon'
import { Modal } from '../../components/Modal'
import {
  getHorseForageSettings,
  listForageAnalyses,
  updateHorseForageSettings,
  type ForageAnalysis,
  type HorseForageSettings,
} from '../../features/forage/api'
import {
  calculate,
  fehPerKgFeed,
  isWorkload,
  sumPlanHay,
  WORKLOADS,
  type Workload,
} from '../../features/forage/calc'
import type { FeedingTime } from '../../features/horses/api'
import { usePreferences } from '../../lib/PreferencesContext'

type FormState = {
  ideal_weight_kg: string
  workload: Workload | ''
  forage_analysis_id: string
  concentrate_kg_per_day: string
  concentrate_feh_per_kg: string
}

function toForm(settings: HorseForageSettings | null): FormState {
  return {
    ideal_weight_kg: settings?.ideal_weight_kg?.toString() ?? '',
    workload: isWorkload(settings?.workload) ? settings.workload : '',
    forage_analysis_id: settings?.forage_analysis_id ?? '',
    concentrate_kg_per_day: settings?.concentrate_kg_per_day?.toString() ?? '',
    concentrate_feh_per_kg: settings?.concentrate_feh_per_kg?.toString() ?? '',
  }
}

// "2,5" and "2.5" both count; an empty field is null.
function toNumber(value: string): number | null {
  const trimmed = value.trim().replace(',', '.')
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

export function ForageCard({
  horseId,
  feedingTimes,
  includedHayKg,
}: {
  horseId: string
  feedingTimes: FeedingTime[]
  includedHayKg: number | null
}) {
  const { t } = usePreferences()
  const num = useForageNumber()
  const [settings, setSettings] = useState<HorseForageSettings | null>(null)
  const [analyses, setAnalyses] = useState<ForageAnalysis[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<FormState>(() => toForm(null))
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([getHorseForageSettings(horseId), listForageAnalyses()])
      .then(([horseSettings, list]) => {
        setSettings(horseSettings)
        setAnalyses(list)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [horseId])

  if (loading) return null
  if (error) {
    return (
      <p role="alert" className="mb-4 text-sm text-red-600">
        {error}
      </p>
    )
  }

  const inUse = analyses.find((analysis) => analysis.in_use) ?? null
  const analysis =
    analyses.find((item) => item.id === settings?.forage_analysis_id) ?? inUse
  const weight = settings?.ideal_weight_kg ?? null
  const workload = isWorkload(settings?.workload) ? settings.workload : null
  const isSetUp = weight !== null && workload !== null

  function openEdit() {
    setForm(toForm(settings))
    setFormError(null)
    setEditing(true)
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      const saved = await updateHorseForageSettings(horseId, {
        ideal_weight_kg: toNumber(form.ideal_weight_kg),
        workload: form.workload || null,
        forage_analysis_id: form.forage_analysis_id || null,
        concentrate_kg_per_day: toNumber(form.concentrate_kg_per_day),
        concentrate_feh_per_kg: toNumber(form.concentrate_feh_per_kg),
      })
      setSettings(saved)
      setEditing(false)
    } catch (err) {
      setFormError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const hayAmounts = feedingTimes.map((entry) => entry.hay)
  const feedingsWithHay = hayAmounts.filter((text) => text && text.trim())

  return (
    <div className="mb-6 rounded-2xl border border-slate-200 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold text-slate-900">
          <Icon name="feedBag" className="h-5 w-5 text-forest" />
          {t('forage.cardTitle')}
        </h3>
        {isSetUp && (
          <button type="button" className="btn-ghost" onClick={openEdit}>
            <Icon name="edit" className="h-4 w-4" />
            {t('common.edit')}
          </button>
        )}
      </div>

      <div className="mt-3">
        {!isSetUp ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">{t('forage.setUpIntro')}</p>
            <button type="button" className="btn-primary" onClick={openEdit}>
              {t('forage.setUp')}
            </button>
          </div>
        ) : !analysis ? (
          <div className="space-y-2">
            <p className="text-sm text-slate-600">{t('forage.noHay')}</p>
            <Link
              to="/feed-calculator"
              className="text-sm font-medium text-forest hover:underline"
            >
              {t('forage.openCalculator')}
            </Link>
          </div>
        ) : (
          <ForageResult
            result={calculate({
              idealWeightKg: weight,
              workload,
              dryMatterPercent: analysis.dry_matter_percent,
              fehPerKgDm: analysis.feh_per_kg_dm,
              concentrateKgPerDay: settings?.concentrate_kg_per_day,
              concentrateFehPerKg: settings?.concentrate_feh_per_kg,
            })}
            idealWeightKg={weight}
            workload={workload}
            hayName={analysis.name}
            plan={sumPlanHay(hayAmounts)}
            feedingCount={feedingsWithHay.length || feedingTimes.length}
            includedHayKg={includedHayKg}
          />
        )}
      </div>

      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title={t('forage.cardTitle')}
      >
        <form onSubmit={handleSubmit} className="grid gap-4">
          {formError && (
            <p role="alert" className="text-sm text-red-600">
              {formError}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="field-label">{t('forage.idealWeight')}</span>
              <input
                required
                type="number"
                inputMode="decimal"
                min="50"
                max="1500"
                step="1"
                className="field"
                value={form.ideal_weight_kg}
                onChange={(e) => update('ideal_weight_kg', e.target.value)}
              />
            </label>
            <label>
              <span className="field-label">{t('forage.workload')}</span>
              <select
                required
                className="field"
                value={form.workload}
                onChange={(e) => update('workload', e.target.value as Workload)}
              >
                <option value="" disabled>
                  {t('common.select')}
                </option>
                {WORKLOADS.map((key) => (
                  <option key={key} value={key}>
                    {t(workloadLabelKey(key))}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            <span className="field-label">{t('forage.hay')}</span>
            <select
              className="field"
              value={form.forage_analysis_id}
              onChange={(e) => update('forage_analysis_id', e.target.value)}
            >
              <option value="">
                {inUse
                  ? t('forage.stableHayInUse', { name: inUse.name })
                  : t('forage.stableHayInUseNone')}
              </option>
              {analyses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ·{' '}
                  {num(
                    fehPerKgFeed(item.dry_matter_percent, item.feh_per_kg_dm),
                    2,
                    2,
                  )}{' '}
                  FEh/kg
                </option>
              ))}
            </select>
          </label>
          <div role="group" aria-label={t('forage.concentrate')}>
            <p className="field-label">{t('forage.concentrate')}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="text-xs text-slate-500">
                  {t('forage.concentrateKg')}
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="20"
                  step="0.01"
                  className="field"
                  value={form.concentrate_kg_per_day}
                  onChange={(e) =>
                    update('concentrate_kg_per_day', e.target.value)
                  }
                />
              </label>
              <label>
                <span className="text-xs text-slate-500">
                  {t('forage.concentrateFeh')}
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="2"
                  step="0.01"
                  className="field"
                  value={form.concentrate_feh_per_kg}
                  onChange={(e) =>
                    update('concentrate_feh_per_kg', e.target.value)
                  }
                />
              </label>
              <p className="text-xs text-slate-400 sm:col-span-2">
                {t('forage.concentrateHint')}
              </p>
            </div>
          </div>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </form>
      </Modal>
    </div>
  )
}
