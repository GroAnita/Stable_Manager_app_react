import { useEffect, useState } from 'react'
import { Icon } from '../../components/Icon'
import {
  countActiveHorses,
  listFireSafetyChecks,
  markFireSafetyChecked,
  type FireSafetyCheck,
  type FireSafetyCheckType,
} from '../../features/fireSafety/api'
import type { Stable } from '../../features/settings/api'
import {
  FIRE_SAFETY_CHECK_TYPES,
  fireSafetyStatus,
  nextDueDate,
  type FireSafetyStatus,
} from '../../lib/fireSafety'
import { usePreferences } from '../../lib/PreferencesContext'

const HORSE_COUNT_THRESHOLD = 10

const STATUS_STYLES: Record<FireSafetyStatus, string> = {
  ok: 'bg-emerald-100 text-emerald-700',
  dueSoon: 'bg-amber-100 text-amber-700',
  overdue: 'bg-red-100 text-red-700',
  never: 'bg-slate-100 text-slate-500',
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function FireSafetyPanel({
  stable,
  canEdit,
}: {
  stable: Stable
  canEdit: boolean
}) {
  const { t, formatDate } = usePreferences()
  const [checks, setChecks] = useState<FireSafetyCheck[]>([])
  const [horseCount, setHorseCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<FireSafetyCheckType | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([listFireSafetyChecks(), countActiveHorses()])
      .then(([checksData, count]) => {
        if (cancelled) return
        setChecks(checksData)
        setHorseCount(count)
        setError(null)
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
  }, [])

  async function handleMarkChecked(checkType: FireSafetyCheckType) {
    setSaving(checkType)
    setError(null)
    try {
      const updated = await markFireSafetyChecked(
        stable.id,
        checkType,
        todayIso(),
      )
      setChecks((prev) => [
        ...prev.filter((c) => c.check_type !== checkType),
        updated,
      ])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(null)
    }
  }

  const alarmRequired = horseCount !== null && horseCount > HORSE_COUNT_THRESHOLD

  return (
    <div className="space-y-6">
      <a
        href="tel:110"
        className="flex items-center justify-between gap-4 rounded-2xl bg-red-600 px-6 py-5 text-white shadow-soft hover:bg-red-700"
      >
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15">
            <Icon name="flame" className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm font-medium text-white/85 uppercase tracking-wide">
              {t('fireSafety.emergencyLabel')}
            </p>
            <p className="text-lg font-semibold">
              {t('fireSafety.emergencyCallout')}
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-xl bg-white px-5 py-2.5 text-2xl font-bold text-red-600">
          110
        </span>
      </a>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="panel p-6">
        <div className="flex items-start gap-4 border-b border-slate-100 pb-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-forest/10 text-forest">
            <Icon name="flame" className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {t('fireSafety.requirementsTitle')}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {t('fireSafety.requirementsSubtitle')}
            </p>
          </div>
        </div>

        {horseCount !== null && (
          <div
            className={`mt-5 rounded-2xl p-4 text-sm ${
              alarmRequired
                ? 'bg-amber-50 text-amber-800'
                : 'bg-slate-50 text-slate-600'
            }`}
          >
            {alarmRequired
              ? t('fireSafety.horseCountAbove', { count: horseCount })
              : t('fireSafety.horseCountBelow', { count: horseCount })}
          </div>
        )}

        <ul className="mt-5 space-y-3 text-sm text-slate-700">
          <li className="flex gap-3">
            <Icon
              name="checkSquare"
              className="mt-0.5 h-4 w-4 shrink-0 text-forest"
            />
            <span>{t('fireSafety.requirementPrevention')}</span>
          </li>
          <li className="flex gap-3">
            <Icon
              name="checkSquare"
              className="mt-0.5 h-4 w-4 shrink-0 text-forest"
            />
            <span>{t('fireSafety.requirementEvacuation')}</span>
          </li>
          <li className="flex gap-3">
            <Icon
              name="checkSquare"
              className="mt-0.5 h-4 w-4 shrink-0 text-forest"
            />
            <span>{t('fireSafety.requirementVentilation')}</span>
          </li>
          <li className="flex gap-3">
            <Icon
              name="checkSquare"
              className="mt-0.5 h-4 w-4 shrink-0 text-forest"
            />
            <span>{t('fireSafety.requirementExtinguisher')}</span>
          </li>
          <li className="flex gap-3">
            <Icon
              name="checkSquare"
              className="mt-0.5 h-4 w-4 shrink-0 text-forest"
            />
            <span>{t('fireSafety.requirementAlarm')}</span>
          </li>
          <li className="flex gap-3">
            <Icon
              name="checkSquare"
              className="mt-0.5 h-4 w-4 shrink-0 text-forest"
            />
            <span>{t('fireSafety.requirementExits')}</span>
          </li>
          <li className="flex gap-3">
            <Icon
              name="checkSquare"
              className="mt-0.5 h-4 w-4 shrink-0 text-forest"
            />
            <span>{t('fireSafety.requirementElectrical')}</span>
          </li>
          <li className="flex gap-3">
            <Icon
              name="checkSquare"
              className="mt-0.5 h-4 w-4 shrink-0 text-forest"
            />
            <span>{t('fireSafety.requirementDrill')}</span>
          </li>
        </ul>

        <p className="mt-5 text-xs text-slate-400">
          {t('fireSafety.sourceNote')}
        </p>
      </div>

      <div className="panel p-6">
        <h2 className="section-title">{t('fireSafety.checklistTitle')}</h2>
        <p className="mt-1 text-sm text-slate-500">
          {t('fireSafety.checklistSubtitle')}
        </p>

        {loading ? (
          <p className="mt-4 text-sm text-slate-500">{t('common.loading')}</p>
        ) : (
          <div className="mt-5 space-y-3">
            {FIRE_SAFETY_CHECK_TYPES.map((checkType) => {
              const record = checks.find((c) => c.check_type === checkType)
              const status = fireSafetyStatus(
                record?.last_checked_date ?? null,
                checkType,
              )
              return (
                <div
                  key={checkType}
                  className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {t(`fireSafety.check.${checkType}`)}
                    </p>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {record
                        ? t('fireSafety.lastChecked', {
                            date: formatDate(record.last_checked_date),
                            next: formatDate(
                              nextDueDate(record.last_checked_date, checkType),
                            ),
                          })
                        : t('fireSafety.neverChecked')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLES[status]}`}
                    >
                      {t(`fireSafety.status.${status}`)}
                    </span>
                    {canEdit && (
                      <button
                        type="button"
                        disabled={saving === checkType}
                        onClick={() => handleMarkChecked(checkType)}
                        className="btn-ghost px-3 py-2 text-sm"
                      >
                        {saving === checkType
                          ? t('common.saving')
                          : t('fireSafety.markChecked')}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="panel p-6">
        <h2 className="section-title">{t('fireSafety.tipsTitle')}</h2>
        <ul className="mt-4 space-y-3 text-sm text-slate-700">
          {[
            'tipElectrical',
            'tipEquipment',
            'tipHousekeeping',
            'tipHalters',
            'tipInform',
            'tipPlan',
            'tipEvacuation',
            'tipTestAlarm',
            'tipCallEarly',
          ].map((key) => (
            <li key={key} className="flex gap-3">
              <Icon
                name="flame"
                className="mt-0.5 h-4 w-4 shrink-0 text-warmbrown"
              />
              <span>{t(`fireSafety.${key}`)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
