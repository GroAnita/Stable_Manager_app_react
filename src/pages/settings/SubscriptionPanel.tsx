import { useEffect, useState } from 'react'
import { Icon } from '../../components/Icon'
import {
  listSubscriptionPlans,
  updateStable,
  type Stable,
  type SubscriptionPlan,
} from '../../features/settings/api'
import {
  cancelPlanChange,
  getPlanChange,
  notifyPlanChange,
  schedulePlanChange,
  type PlanChange,
} from '../../features/payments/connect'
import { planChangeDates } from '../../lib/billing'
import { useConfirm } from '../../lib/ConfirmContext'
import { usePreferences } from '../../lib/PreferencesContext'
import { supabase } from '../../lib/supabaseClient'

const TRIAL_DAYS = 30

function getTrialStatus(
  createdAt: string,
  now: Date = new Date(),
): { trialEnd: Date; trialActive: boolean } {
  const trialEnd = new Date(createdAt)
  trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS)
  return { trialEnd, trialActive: trialEnd.getTime() > now.getTime() }
}

function formatPlanRange(
  plan: SubscriptionPlan,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  if (plan.horse_max == null) {
    return t('settings.planRangeOver', { min: plan.horse_min - 1 })
  }
  if (plan.horse_min <= 1) {
    return t('settings.planRangeUpTo', { max: plan.horse_max })
  }
  return t('settings.planRangeBetween', {
    min: plan.horse_min,
    max: plan.horse_max,
  })
}

export function SubscriptionPanel({
  stable,
  canEdit,
  onChange,
}: {
  stable: Stable
  canEdit: boolean
  onChange: (stable: Stable) => void
}) {
  const { t, formatDate } = usePreferences()
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [horseCount, setHorseCount] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const confirm = useConfirm()
  const [planChange, setPlanChange] = useState<PlanChange | null>(null)
  const [planning, setPlanning] = useState<{
    plan: Stable['plan']
    signed: number
  } | null>(null)
  const switchDates = planChangeDates(
    new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Oslo' }),
  )
  const [switchDate, setSwitchDate] = useState(switchDates[0])
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    listSubscriptionPlans()
      .then(setPlans)
      .catch((err: Error) => setError(err.message))
    supabase
      .from('horses')
      .select('*', { count: 'exact', head: true })
      .eq('active', true)
      .then(({ count }) => setHorseCount(count ?? 0))
    if (canEdit) {
      getPlanChange(stable.id)
        .then(setPlanChange)
        .catch((err: Error) => setError(err.message))
    }
  }, [canEdit, stable.id])

  const { trialEnd, trialActive } = getTrialStatus(stable.created_at)

  async function handleSchedule() {
    if (!planning) return
    if (
      !(await confirm(
        t('settings.planChangeConfirm', {
          count: planning.signed,
          date: formatDate(switchDate),
        }),
        { confirmLabel: t('settings.planChangeSchedule') },
      ))
    )
      return
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      await schedulePlanChange(planning.plan, switchDate)
      setPlanning(null)
      setPlanChange(await getPlanChange(stable.id))
      await notifyPlanChange()
      setMessage(t('settings.planChangeScheduled'))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleCancelSchedule() {
    if (
      !(await confirm(t('settings.planChangeCancelConfirm'), {
        confirmLabel: t('settings.planChangeCancel'),
      }))
    )
      return
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      await cancelPlanChange()
      setPlanChange(await getPlanChange(stable.id))
      await notifyPlanChange()
      setMessage(t('settings.planChangeCancelled'))
    } catch (err) {
      const text = (err as Error).message
      setError(
        text.includes('plan_change_too_late')
          ? t('settings.planChangeTooLate')
          : text,
      )
    } finally {
      setSaving(false)
    }
  }

  // A stable already on a hidden plan still sees the plan it's on.
  const shownPlans = plans.filter(
    (plan) => plan.visible !== false || plan.key === stable.plan,
  )

  async function handleSelect(plan: Stable['plan']) {
    if (!canEdit || plan === stable.plan || saving) return
    setSaving(true)
    setError(null)
    try {
      const updated = await updateStable(stable.id, { plan })
      onChange(updated)
    } catch (err) {
      const { message, details } = err as { message: string; details?: string }
      if (message.includes('plan_change_needs_schedule')) {
        setPlanning({ plan, signed: Number(details ?? 0) })
      } else if (message.includes('plan_change_scheduled')) {
        setError(t('settings.planChangeAlreadyPlanned'))
      } else if (message.includes('plan_not_available')) {
        setError(t('settings.planNotAvailable'))
      } else {
        setError(message)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="panel p-6">
      <div className="flex items-start gap-4 border-b border-slate-100 pb-5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-forest/10 text-forest">
          <Icon name="creditCard" className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            {t('settings.navSubscription')}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {t('settings.subscriptionSubtitle')}
          </p>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-600">
          {error}
        </p>
      )}

      {message && <p className="mt-4 text-sm text-forest">{message}</p>}

      {planChange?.plan_change_status === 'scheduled' &&
        planChange.scheduled_plan_on && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <p className="font-medium">
              {t('settings.planChangePlanned', {
                date: formatDate(planChange.scheduled_plan_on),
              })}
            </p>
            <p className="mt-1">{t('settings.planChangePlannedHint')}</p>
            <button
              type="button"
              className="btn-ghost mt-3"
              disabled={saving}
              onClick={handleCancelSchedule}
            >
              {t('settings.planChangeCancel')}
            </button>
          </div>
        )}

      {planChange?.plan_change_status === 'failed' && (
        <p
          role="alert"
          className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600"
        >
          {t('settings.planChangeFailed')}
        </p>
      )}

      {planning && (
        <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 p-4 text-sm">
          <p className="font-medium text-slate-900">
            {t('settings.planChangeTitle')}
          </p>
          <p className="text-slate-600">
            {t('settings.planChangeHint', { count: planning.signed })}
          </p>
          <label className="block max-w-xs">
            <span className="field-label">{t('settings.planChangeDate')}</span>
            <select
              className="field"
              value={switchDate}
              onChange={(e) => setSwitchDate(e.target.value)}
            >
              {switchDates.map((date) => (
                <option key={date} value={date}>
                  {formatDate(date)}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary"
              disabled={saving}
              onClick={handleSchedule}
            >
              {t('settings.planChangeSchedule')}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setPlanning(null)}
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 rounded-2xl bg-forest/10 p-6">
        <p className="text-sm text-slate-700">
          {trialActive
            ? t('settings.trialLastsUntil')
            : t('settings.trialEnded')}
        </p>
        <p className="mt-1 text-3xl font-bold text-forest">
          {formatDate(trialEnd.toISOString())}
        </p>
        <p className="mt-2 text-sm text-slate-600">
          {trialActive ? t('settings.trialHint') : t('settings.trialEndedHint')}
        </p>
      </div>

      <div className="mt-6">
        <p className="field-label">{t('settings.planLabel')}</p>
        <div className="mt-2 space-y-3">
          {shownPlans.map((plan) => {
            const selected = stable.plan === plan.key
            return (
              <label
                key={plan.key}
                className={`flex items-center justify-between gap-4 rounded-2xl border p-5 ${
                  selected ? 'border-forest bg-forest/10' : 'border-slate-200'
                } ${canEdit ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <div className="flex items-center gap-4">
                  <input
                    type="radio"
                    name="stable-plan"
                    checked={selected}
                    disabled={!canEdit || saving}
                    onChange={() => handleSelect(plan.key)}
                    className="h-5 w-5"
                  />
                  <div>
                    <p className="font-semibold text-slate-900">
                      {formatPlanRange(plan, t)}
                    </p>
                    <p className="text-sm text-slate-500">{plan.name}</p>
                    {selected && horseCount !== null && (
                      <p className="text-sm text-slate-500">
                        {t('settings.stableHorseCount', { count: horseCount })}
                      </p>
                    )}
                  </div>
                </div>
                <p className="shrink-0 font-semibold text-slate-900">
                  {t('settings.planPriceSuffix', { price: plan.price_nok })}
                </p>
              </label>
            )
          })}
        </div>
      </div>
    </div>
  )
}
