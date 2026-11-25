import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Link } from 'react-router-dom'
import { getStableBilling, type StableBilling } from '../features/settings/api'
import { usePreferences } from '../lib/PreferencesContext'

const WARN_DAYS = 7
const GRACE_DAYS = 14

// Says what's happening when a stable's subscription needs attention, and what that
// means. Testers and stables with a working subscription never see it.
export function BillingBanner({ canManage }: { canManage: boolean }) {
  const { t, formatDate } = usePreferences()
  // The iPhone app states the facts only, without asking anyone to choose a
  // subscription or linking to it (App Store guideline 3.1.1 / 3.1.3(f)).
  const inApp = Capacitor.isNativePlatform()
  const key = (name: string) => `billingBanner.${inApp ? 'app_' : ''}${name}`
  const [billing, setBilling] = useState<StableBilling | null>(null)

  useEffect(() => {
    getStableBilling()
      .then(setBilling)
      .catch(() => setBilling(null))
  }, [])

  if (!billing) return null
  if (billing.status === 'tester') {
    // Only the stable owner is told that the test period is ending.
    if (
      !canManage ||
      !billing.tester_until ||
      new Date(billing.tester_until).getTime() <= Date.now()
    )
      return null
  }

  const addDays = (iso: string, days: number) => {
    const date = new Date(iso)
    date.setDate(date.getDate() + days)
    return date.toISOString().slice(0, 10)
  }

  let text: string | null = null
  if (billing.status === 'tester' && billing.tester_until) {
    const trialEnd = new Date(billing.tester_until)
    trialEnd.setMonth(trialEnd.getMonth() + 1)
    text = t(key('testerEnding'), {
      date: formatDate(billing.tester_until),
      trialEnd: formatDate(trialEnd.toISOString()),
    })
  } else if (billing.read_only) {
    text = t(key('readOnly'))
  } else if (billing.status === 'past_due' && billing.past_due_since) {
    text = t(key('pastDue'), {
      date: formatDate(addDays(billing.past_due_since, GRACE_DAYS)),
    })
  } else if (billing.status === 'canceled' && billing.current_period_end) {
    text = t(key('canceled'), {
      date: formatDate(addDays(billing.current_period_end, GRACE_DAYS)),
    })
  } else if (billing.status === 'trial' && billing.trial_ends_at) {
    const left =
      (new Date(billing.trial_ends_at).getTime() - Date.now()) / 86400000
    if (left <= 0) {
      text = t(key('trialEnded'), {
        date: formatDate(addDays(billing.trial_ends_at, GRACE_DAYS)),
      })
    } else if (left <= WARN_DAYS) {
      text = t(key('trialEnding'), {
        date: formatDate(billing.trial_ends_at.slice(0, 10)),
      })
    }
  }
  if (!text) return null

  return (
    <div
      role="status"
      className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm print:hidden ${
        billing.read_only
          ? 'bg-red-50 text-red-600'
          : 'bg-amber-50 text-amber-800'
      }`}
    >
      <span>{text}</span>
      {canManage && !inApp && (
        <Link
          to="/settings?section=subscription"
          className="font-medium underline"
        >
          {t('billingBanner.manage')}
        </Link>
      )}
    </div>
  )
}
