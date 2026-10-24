import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getOnboardingStatus,
  type OnboardingStatus,
  type OnboardingStepKey,
} from '../features/onboarding/api'
import { usePreferences } from '../lib/PreferencesContext'
import { Icon } from './Icon'

const COLLAPSE_KEY = 'stable-manager:onboarding-collapsed'

type Step = {
  key: OnboardingStepKey
  titleKey: string
  bodyKey: string
  to: string
  optional?: boolean
}

const STEPS: Step[] = [
  {
    key: 'invoiceDetails',
    titleKey: 'onboardingChecklist.stepInvoiceDetailsTitle',
    bodyKey: 'onboardingChecklist.stepInvoiceDetailsBody',
    to: '/settings',
  },
  {
    key: 'stalls',
    titleKey: 'onboardingChecklist.stepStallsTitle',
    bodyKey: 'onboardingChecklist.stepStallsBody',
    to: '/stalls',
  },
  {
    key: 'horsesAndOwners',
    titleKey: 'onboardingChecklist.stepHorsesOwnersTitle',
    bodyKey: 'onboardingChecklist.stepHorsesOwnersBody',
    to: '/horses',
  },
  {
    key: 'priceList',
    titleKey: 'onboardingChecklist.stepPriceListTitle',
    bodyKey: 'onboardingChecklist.stepPriceListBody',
    to: '/price-list',
  },
  {
    key: 'contracts',
    titleKey: 'onboardingChecklist.stepContractsTitle',
    bodyKey: 'onboardingChecklist.stepContractsBody',
    to: '/contracts',
  },
  {
    key: 'feedingRounds',
    titleKey: 'onboardingChecklist.stepFeedingRoundsTitle',
    bodyKey: 'onboardingChecklist.stepFeedingRoundsBody',
    to: '/feeding-rota',
  },
  {
    key: 'staff',
    titleKey: 'onboardingChecklist.stepStaffTitle',
    bodyKey: 'onboardingChecklist.stepStaffBody',
    to: '/settings?section=staffAccess',
    optional: true,
  },
]

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === 'true'
  } catch {
    return false
  }
}

function writeCollapsed(value: boolean) {
  try {
    localStorage.setItem(COLLAPSE_KEY, String(value))
  } catch {
    // ignore — per-viewer convenience only
  }
}

export function OnboardingChecklist({
  stableId,
  previewStatus,
}: {
  stableId: string
  previewStatus?: OnboardingStatus
}) {
  const { t } = usePreferences()
  const [status, setStatus] = useState<OnboardingStatus | null>(
    previewStatus ?? null,
  )
  const [collapsed, setCollapsed] = useState(readCollapsed)

  useEffect(() => {
    if (previewStatus) return
    getOnboardingStatus(stableId)
      .then(setStatus)
      .catch(() => setStatus(null))
  }, [stableId, previewStatus])

  function collapse() {
    setCollapsed(true)
    writeCollapsed(true)
  }

  function expand() {
    setCollapsed(false)
    writeCollapsed(false)
  }

  if (!status) return null

  const requiredSteps = STEPS.filter((step) => !step.optional)
  const doneCount = requiredSteps.filter((step) => status[step.key]).length
  const totalCount = requiredSteps.length

  if (doneCount === totalCount) return null

  const nextStepKey = STEPS.find((step) => !status[step.key])?.key
  const circumference = 2 * Math.PI * 24
  const progressOffset = circumference * (1 - doneCount / totalCount)

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={expand}
        aria-label={t('onboardingChecklist.expandLabel')}
        className="fixed right-4 bottom-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-forest text-white shadow-soft hover:bg-forest/90"
      >
        <svg
          aria-hidden="true"
          className="absolute inset-0 h-14 w-14 -rotate-90"
          viewBox="0 0 56 56"
        >
          <circle
            cx="28"
            cy="28"
            r="24"
            fill="none"
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="4"
          />
          <circle
            cx="28"
            cy="28"
            r="24"
            fill="none"
            stroke="white"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={progressOffset}
          />
        </svg>
        <span className="text-xs font-semibold">
          {doneCount}/{totalCount}
        </span>
      </button>
    )
  }

  return (
    <div className="fixed right-4 bottom-4 z-40 w-[calc(100vw-2rem)] max-w-sm">
      <div className="panel max-h-[75vh] overflow-y-auto p-5">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">
            {t('onboardingChecklist.title')}
          </h2>
          <button
            type="button"
            onClick={collapse}
            aria-label={t('onboardingChecklist.collapse')}
            className="shrink-0 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-sm font-medium text-slate-600">
          {t('onboardingChecklist.progress', {
            done: doneCount,
            total: totalCount,
          })}
        </p>
        <div className="mt-2 h-2 rounded-full bg-slate-100">
          <div
            className="h-2 rounded-full bg-forest transition-all"
            style={{ width: `${(doneCount / totalCount) * 100}%` }}
          />
        </div>
        <p className="mt-3 text-sm text-slate-500">
          {t('onboardingChecklist.subtitle')}
        </p>
        <div className="mt-4 space-y-2">
          {STEPS.map((step) => {
            const done = status[step.key]
            const isNext = step.key === nextStepKey
            return (
              <Link
                key={step.key}
                to={step.to}
                onClick={collapse}
                className={`flex items-center gap-3 rounded-2xl p-3 ${
                  isNext
                    ? 'border border-forest/30 bg-forest/5'
                    : 'hover:bg-slate-50'
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                    done
                      ? 'border-forest bg-forest text-white'
                      : 'border-slate-300'
                  }`}
                >
                  {done && (
                    <svg
                      className="h-3.5 w-3.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="4,12 9,17 20,6" />
                    </svg>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">
                    {t(step.titleKey)}
                  </p>
                  <p className="text-xs text-slate-500">{t(step.bodyKey)}</p>
                </div>
                {(done || step.optional) && (
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                      done
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {done
                      ? t('onboardingChecklist.done')
                      : t('onboardingChecklist.optional')}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
