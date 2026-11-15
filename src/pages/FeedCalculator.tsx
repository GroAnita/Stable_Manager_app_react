import { useEffect, useState, type FormEvent } from 'react'
import { ForageResult } from '../components/forage/ForageResult'
import { useForageNumber, workloadLabelKey } from '../components/forage/format'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import {
  createForageAnalysis,
  deleteForageAnalysis,
  listForageAnalyses,
  updateForageAnalysis,
  type ForageAnalysis,
} from '../features/forage/api'
import {
  calculate,
  fehPerKgDmFromFeed,
  fehPerKgFeed,
  hayClass,
  WORKLOADS,
  type Workload,
} from '../features/forage/calc'
import { useAuth } from '../lib/AuthContext'
import { useConfirm } from '../lib/ConfirmContext'
import { usePreferences } from '../lib/PreferencesContext'

type EnergyMode = 'dm' | 'feed'

// "0,53" and "0.53" both count; anything else is null.
function toNumber(value: string): number | null {
  const trimmed = value.trim().replace(',', '.')
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

// FEh per kg dry matter from what was typed, whichever of the two it was.
function fehDmFrom(
  mode: EnergyMode,
  dryMatter: number | null,
  energy: number | null,
): number | null {
  if (dryMatter === null || energy === null || dryMatter <= 0 || energy <= 0) {
    return null
  }
  return mode === 'dm' ? energy : fehPerKgDmFromFeed(dryMatter, energy)
}

type AnalysisForm = {
  name: string
  analysed_on: string
  dry_matter_percent: string
  energyMode: EnergyMode
  energy: string
  notes: string
  in_use: boolean
}

function emptyAnalysisForm(firstOne: boolean): AnalysisForm {
  return {
    name: '',
    analysed_on: '',
    dry_matter_percent: '',
    energyMode: 'feed',
    energy: '',
    notes: '',
    in_use: firstOne,
  }
}

export default function FeedCalculator() {
  const { t, formatDate } = usePreferences()
  const { profile } = useAuth()
  const confirm = useConfirm()
  const num = useForageNumber()
  const canEdit =
    profile?.role === 'stable_owner' || profile?.role === 'stable_employee'

  const [analyses, setAnalyses] = useState<ForageAnalysis[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editing, setEditing] = useState<ForageAnalysis | 'new' | null>(null)
  const [form, setForm] = useState<AnalysisForm>(() => emptyAnalysisForm(false))
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function load() {
    listForageAnalyses()
      .then(setAnalyses)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  function openNew() {
    setForm(emptyAnalysisForm(analyses.length === 0))
    setFormError(null)
    setEditing('new')
  }

  function openEdit(analysis: ForageAnalysis) {
    setForm({
      name: analysis.name,
      analysed_on: analysis.analysed_on ?? '',
      dry_matter_percent: String(analysis.dry_matter_percent),
      energyMode: 'dm',
      energy: String(analysis.feh_per_kg_dm),
      notes: analysis.notes ?? '',
      in_use: analysis.in_use,
    })
    setFormError(null)
    setEditing(analysis)
  }

  function update<K extends keyof AnalysisForm>(
    key: K,
    value: AnalysisForm[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const formDryMatter = toNumber(form.dry_matter_percent)
  const formFehDm = fehDmFrom(
    form.energyMode,
    formDryMatter,
    toNumber(form.energy),
  )

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!profile?.stable_id || formDryMatter === null || formFehDm === null) {
      return
    }
    setSaving(true)
    setFormError(null)
    const input = {
      name: form.name.trim(),
      analysed_on: form.analysed_on || null,
      dry_matter_percent: formDryMatter,
      feh_per_kg_dm: Math.round(formFehDm * 1000) / 1000,
      notes: form.notes.trim() || null,
      in_use: form.in_use,
    }
    try {
      if (editing === 'new') {
        await createForageAnalysis(profile.stable_id, input)
      } else if (editing) {
        await updateForageAnalysis(editing.id, input)
      }
      setEditing(null)
      load()
    } catch (err) {
      setFormError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!editing || editing === 'new') return
    if (!(await confirm(t('forage.deleteAnalysisConfirm')))) return
    try {
      await deleteForageAnalysis(editing.id)
      setEditing(null)
      load()
    } catch (err) {
      setFormError((err as Error).message)
    }
  }

  async function markInUse(analysis: ForageAnalysis) {
    setError(null)
    try {
      await updateForageAnalysis(analysis.id, { in_use: true })
      load()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="page-shell">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">
          {t('forage.title')}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          {t('forage.intro')}
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="panel p-6">
          <h2 className="section-title">{t('forage.calculatorTitle')}</h2>
          <div className="mt-4">
            {!loading && <FreeCalculator analyses={analyses} />}
          </div>
        </div>

        <div className="panel p-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="section-title">{t('forage.analysesTitle')}</h2>
            {canEdit && (
              <button type="button" className="btn-primary" onClick={openNew}>
                <Icon name="plus" className="h-4 w-4" />
                {t('forage.addAnalysis')}
              </button>
            )}
          </div>
          <p className="mt-2 text-sm text-slate-500">
            {canEdit
              ? t('forage.analysesIntro')
              : t('forage.analysesIntroOwner')}
          </p>
          {!loading && analyses.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              {t('forage.noAnalyses')}
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {analyses.map((analysis) => (
                <li
                  key={analysis.id}
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
                        {analysis.name}
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                          {hayClass(analysis.feh_per_kg_dm)}
                        </span>
                        {analysis.in_use && (
                          <span className="rounded-full bg-forest/10 px-2 py-0.5 text-xs font-medium text-forest">
                            {t('forage.inUse')}
                          </span>
                        )}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {t('forage.analysisSummary', {
                          dm: num(analysis.dry_matter_percent),
                          fehDm: num(analysis.feh_per_kg_dm, 2, 2),
                          fehFeed: num(
                            fehPerKgFeed(
                              analysis.dry_matter_percent,
                              analysis.feh_per_kg_dm,
                            ),
                            2,
                            2,
                          ),
                        })}
                      </p>
                      {analysis.analysed_on && (
                        <p className="text-xs text-slate-400">
                          {t('forage.analysedOn')}:{' '}
                          {formatDate(analysis.analysed_on)}
                        </p>
                      )}
                      {analysis.notes && (
                        <p className="mt-1 text-sm text-slate-500">
                          {analysis.notes}
                        </p>
                      )}
                    </div>
                    {canEdit && (
                      <div className="flex gap-2">
                        {!analysis.in_use && (
                          <button
                            type="button"
                            className="btn-ghost"
                            onClick={() => markInUse(analysis)}
                          >
                            {t('forage.markInUse')}
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-ghost"
                          aria-label={t('forage.editAnalysis')}
                          onClick={() => openEdit(analysis)}
                        >
                          <Icon name="edit" className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <details className="panel p-6">
        <summary className="cursor-pointer font-semibold text-slate-800">
          {t('forage.howTitle')}
        </summary>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li>{t('forage.howMaintenance')}</li>
          <li>{t('forage.howWorkload')}</li>
          <li>{t('forage.howFeed')}</li>
          <li>{t('forage.howHay')}</li>
          <li>{t('forage.howMinimum')}</li>
          <li>{t('forage.howClasses')}</li>
        </ul>
      </details>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={
          editing === 'new' ? t('forage.addAnalysis') : t('forage.editAnalysis')
        }
      >
        <form onSubmit={handleSubmit} className="grid gap-4">
          {formError && (
            <p role="alert" className="text-sm text-red-600">
              {formError}
            </p>
          )}
          <label>
            <span className="field-label">{t('forage.analysisName')}</span>
            <input
              required
              maxLength={100}
              className="field"
              placeholder={t('forage.analysisNamePlaceholder')}
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="field-label">{t('forage.analysedOn')}</span>
              <input
                type="date"
                className="field"
                value={form.analysed_on}
                onChange={(e) => update('analysed_on', e.target.value)}
              />
            </label>
            <label>
              <span className="field-label">
                {t('forage.dryMatterPercent')}
              </span>
              <input
                required
                type="number"
                inputMode="decimal"
                min="1"
                max="100"
                step="0.1"
                className="field"
                value={form.dry_matter_percent}
                onChange={(e) => update('dry_matter_percent', e.target.value)}
              />
            </label>
          </div>
          <EnergyFields
            mode={form.energyMode}
            value={form.energy}
            onModeChange={(mode) => update('energyMode', mode)}
            onValueChange={(value) => update('energy', value)}
          />
          {formDryMatter !== null && formFehDm !== null && (
            <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {hayClass(formFehDm)} ·{' '}
              {t('forage.analysisSummary', {
                dm: num(formDryMatter),
                fehDm: num(formFehDm, 2, 2),
                fehFeed: num(fehPerKgFeed(formDryMatter, formFehDm), 2, 2),
              })}
            </p>
          )}
          <label>
            <span className="field-label">{t('forage.notes')}</span>
            <textarea
              maxLength={1000}
              className="field min-h-20"
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
            />
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={form.in_use}
              onChange={(e) => update('in_use', e.target.checked)}
            />
            <span>
              {t('forage.inUse')}
              <span className="block text-xs text-slate-400">
                {t('forage.inUseHint')}
              </span>
            </span>
          </label>
          <button
            type="submit"
            disabled={saving || formFehDm === null}
            className="btn-primary"
          >
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </form>
        {editing && editing !== 'new' && (
          <button
            type="button"
            className="btn-ghost mt-4"
            onClick={handleDelete}
          >
            {t('common.delete')}
          </button>
        )}
      </Modal>
    </div>
  )
}

function EnergyFields({
  mode,
  value,
  onModeChange,
  onValueChange,
}: {
  mode: EnergyMode
  value: string
  onModeChange: (mode: EnergyMode) => void
  onValueChange: (value: string) => void
}) {
  const { t } = usePreferences()
  return (
    <fieldset>
      <legend className="field-label">{t('forage.energyFrom')}</legend>
      <div className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1 text-sm">
          {(['feed', 'dm'] as EnergyMode[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={mode === key}
              onClick={() => onModeChange(key)}
              className={`rounded-lg px-3 py-1.5 font-medium ${
                mode === key
                  ? 'bg-card text-forest shadow-soft'
                  : 'text-slate-600'
              }`}
            >
              {key === 'feed'
                ? t('forage.fehPerKgFeed')
                : t('forage.fehPerKgDm')}
            </button>
          ))}
        </div>
        <input
          required
          type="number"
          inputMode="decimal"
          min="0.01"
          max="2"
          step="0.001"
          aria-label={
            mode === 'feed' ? t('forage.fehPerKgFeed') : t('forage.fehPerKgDm')
          }
          className="field"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
        />
      </div>
      <p className="mt-1 text-xs text-slate-400">{t('forage.energyHint')}</p>
    </fieldset>
  )
}

const MANUAL = 'manual'

// Nothing here is saved: a place to try numbers, for any horse.
function FreeCalculator({ analyses }: { analyses: ForageAnalysis[] }) {
  const { t } = usePreferences()
  const inUse = analyses.find((analysis) => analysis.in_use) ?? analyses[0]
  const [weight, setWeight] = useState('500')
  const [workload, setWorkload] = useState<Workload>('light')
  const [hayChoice, setHayChoice] = useState<string>(inUse?.id ?? MANUAL)
  const [dryMatter, setDryMatter] = useState('')
  const [energyMode, setEnergyMode] = useState<EnergyMode>('feed')
  const [energy, setEnergy] = useState('')
  const [concentrateKg, setConcentrateKg] = useState('')
  const [concentrateFeh, setConcentrateFeh] = useState('')

  const chosen = analyses.find((analysis) => analysis.id === hayChoice) ?? null
  const weightValue = toNumber(weight)
  const manualDryMatter = toNumber(dryMatter)
  const dmValue = chosen ? chosen.dry_matter_percent : manualDryMatter
  const fehDmValue = chosen
    ? chosen.feh_per_kg_dm
    : fehDmFrom(energyMode, manualDryMatter, toNumber(energy))
  const ready =
    weightValue !== null &&
    weightValue >= 50 &&
    dmValue !== null &&
    dmValue > 0 &&
    dmValue <= 100 &&
    fehDmValue !== null

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className="field-label">{t('forage.idealWeight')}</span>
          <input
            type="number"
            inputMode="decimal"
            min="50"
            max="1500"
            className="field"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </label>
        <label>
          <span className="field-label">{t('forage.workload')}</span>
          <select
            className="field"
            value={workload}
            onChange={(e) => setWorkload(e.target.value as Workload)}
          >
            {WORKLOADS.map((key) => (
              <option key={key} value={key}>
                {t(workloadLabelKey(key))}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="field-label">{t('forage.hay')}</span>
        <select
          className="field"
          value={hayChoice}
          onChange={(e) => setHayChoice(e.target.value)}
        >
          {analyses.map((analysis) => (
            <option key={analysis.id} value={analysis.id}>
              {analysis.name}
              {analysis.in_use
                ? ` (${t('forage.inUse').toLocaleLowerCase()})`
                : ''}
            </option>
          ))}
          <option value={MANUAL}>{t('forage.enterManually')}</option>
        </select>
      </label>
      {!chosen && (
        <div className="grid gap-4">
          <label>
            <span className="field-label">{t('forage.dryMatterPercent')}</span>
            <input
              type="number"
              inputMode="decimal"
              min="1"
              max="100"
              step="0.1"
              className="field"
              value={dryMatter}
              onChange={(e) => setDryMatter(e.target.value)}
            />
          </label>
          <EnergyFields
            mode={energyMode}
            value={energy}
            onModeChange={setEnergyMode}
            onValueChange={setEnergy}
          />
        </div>
      )}
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
              value={concentrateKg}
              onChange={(e) => setConcentrateKg(e.target.value)}
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
              value={concentrateFeh}
              onChange={(e) => setConcentrateFeh(e.target.value)}
            />
          </label>
          <p className="text-xs text-slate-400 sm:col-span-2">
            {t('forage.concentrateHint')}
          </p>
        </div>
      </div>

      {ready ? (
        <ForageResult
          result={calculate({
            idealWeightKg: weightValue,
            workload,
            dryMatterPercent: dmValue,
            fehPerKgDm: fehDmValue,
            concentrateKgPerDay: toNumber(concentrateKg),
            concentrateFehPerKg: toNumber(concentrateFeh),
          })}
          idealWeightKg={weightValue}
          workload={workload}
          hayName={chosen ? chosen.name : t('forage.hay')}
        />
      ) : (
        <p className="text-sm text-slate-500">{t('forage.fillIn')}</p>
      )}
    </div>
  )
}
