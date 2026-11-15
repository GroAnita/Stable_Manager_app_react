import { Icon } from '../Icon'
import {
  roundFeh,
  roundKg,
  type CalculationResult,
  type PlanHay,
  type Workload,
} from '../../features/forage/calc'
import { usePreferences } from '../../lib/PreferencesContext'
import { useForageNumber, workloadLabelKey, workloadPhraseKey } from './format'

export function ForageResult({
  result,
  idealWeightKg,
  workload,
  hayName,
  plan,
  feedingCount,
  includedHayKg,
}: {
  result: CalculationResult
  idealWeightKg: number
  workload: Workload
  hayName: string
  // Only on a horse: what its feeding plan gives today, and what the contract includes.
  plan?: PlanHay | null
  feedingCount?: number
  includedHayKg?: number | null
}) {
  const { t } = usePreferences()
  const num = useForageNumber()
  const workloadText = t(workloadLabelKey(workload)).toLocaleLowerCase()

  const planFeh = plan ? plan.totalKg * result.fehPerKgFeed : 0
  const planDiffFeh = plan ? planFeh - result.hayFehNeeded : 0
  const planDiffKg = Math.abs(planDiffFeh) / result.fehPerKgFeed
  const planMatches = Math.abs(roundKg(planDiffKg)) < 0.3
  const extraOverContract =
    includedHayKg != null ? roundKg(result.hayKg - includedHayKg) : 0

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-forest/10 p-4">
        <p className="text-3xl font-semibold text-forest">
          {num(roundKg(result.hayKg))}{' '}
          <span className="text-base font-medium">{t('forage.perDay')}</span>
        </p>
        <p className="mt-1 text-sm text-slate-600">
          {t('forage.needLine', {
            need: num(roundFeh(result.needFeh), 2),
            weight: num(idealWeightKg, 0),
            workload: workloadText,
          })}
        </p>
        {result.concentrateFeh > 0 && (
          <p className="text-sm text-slate-600">
            {t('forage.concentrateLine', {
              feh: num(roundFeh(result.concentrateFeh), 2),
              hay: num(roundFeh(result.hayFehNeeded), 2),
            })}
          </p>
        )}
        <p className="text-sm text-slate-600">
          {t('forage.hayLine', {
            name: hayName,
            cls: result.hayClass,
            feh: num(result.fehPerKgFeed, 2, 2),
          })}
        </p>
        {feedingCount != null && feedingCount > 1 && result.hayKg > 0 && (
          <p className="text-sm text-slate-600">
            {t('forage.perFeeding', {
              kg: num(roundKg(result.hayKg / feedingCount)),
              count: feedingCount,
            })}
          </p>
        )}
      </div>

      {result.belowMinimum && (
        <Warning
          text={t('forage.belowMinimum', {
            kg: num(roundKg(result.hayKg)),
            min: num(roundKg(result.minHayKg)),
            minDm: num(roundKg(result.minDryMatterKg)),
          })}
        />
      )}
      {result.classFit !== 'good' && (
        <Warning
          text={t(
            result.classFit === 'energyRich'
              ? 'forage.classEnergyRich'
              : 'forage.classEnergyPoor',
            { cls: result.hayClass, workload: t(workloadPhraseKey(workload)) },
          )}
        />
      )}

      {plan && (
        <div className="rounded-2xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-800">
            {t('forage.planTitle')}
          </h3>
          {plan.readable === 0 ? (
            <p className="mt-1 text-sm text-slate-500">
              {t('forage.planEmpty')}
            </p>
          ) : (
            <>
              <p className="mt-1 text-sm text-slate-600">
                {t('forage.planCovers', {
                  kg: num(roundKg(plan.totalKg)),
                  feh: num(roundFeh(planFeh), 2),
                  need: num(roundFeh(result.hayFehNeeded), 2),
                })}
              </p>
              <p
                className={`text-sm font-medium ${
                  planMatches
                    ? 'text-emerald-700'
                    : planDiffFeh < 0
                      ? 'text-red-700'
                      : 'text-amber-700'
                }`}
              >
                {planMatches
                  ? t('forage.planMatches')
                  : t(
                      planDiffFeh < 0
                        ? 'forage.planMissing'
                        : 'forage.planSurplus',
                      {
                        feh: num(roundFeh(Math.abs(planDiffFeh)), 2),
                        kg: num(roundKg(planDiffKg)),
                      },
                    )}
              </p>
            </>
          )}
          {plan.unreadable.length > 0 && (
            <p className="mt-1 text-xs text-slate-400">
              {t('forage.planUnreadable', {
                items: plan.unreadable
                  .map((item) => t('forage.quoted', { text: item }))
                  .join(', '),
              })}
            </p>
          )}
        </div>
      )}

      {extraOverContract > 0 && includedHayKg != null && (
        <p className="text-sm text-slate-600">
          {t('forage.contractNote', {
            included: num(includedHayKg),
            extra: num(extraOverContract),
          })}
        </p>
      )}

      <p className="text-xs text-slate-400">{t('forage.guidance')}</p>
    </div>
  )
}

function Warning({ text }: { text: string }) {
  return (
    <p className="flex gap-2 rounded-2xl bg-amber-50 p-3 text-sm text-amber-800">
      <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{text}</span>
    </p>
  )
}
