import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getStableBilling, type StableBilling } from '../features/settings/api'
import { usePreferences } from '../lib/PreferencesContext'

const WARN_DAYS = 7
const GRACE_DAYS = 14

// Says what's happening when a stable's subscription needs attention, and what that
// means. Testers and stables with a working subscription never see it.
export function BillingBanner({ canManage }: { canManage: boolean }) {
  const { t, formatDate } = usePreferences()
  const [billing, setBilling] = useState<StableBilling | null>(null)

  useEffect(() => {
    getStableBilling()
      .then(setBilling)
      .catch(() => setBilling(null))
  }, [])

  if (!billing || billing.status === 'tester') return null

  const addDays = (iso: string, days: number) => {
    const date = new Date(iso)
    date.setDate(date.getDate() + days)
    return date.toISOString().slice(0, 10)
  }

  let text: string | null = null
  if (billing.read_only) {
    text = t('billingBanner.readOnly')
  } else if (billing.status === 'past_due' && billing.past_due_since) {
    text = t('billingBanner.pastDue', {
      date: formatDate(addDays(billing.past_due_since, GRACE_DAYS)),
    })
  } else if (billing.status === 'canceled' && billing.current_period_end) {
    text = t('billingBanner.canceled', {
      date: formatDate(addDays(billing.current_period_end, GRACE_DAYS)),
    })
  } else if (billing.status === 'trial' && billing.trial_ends_at) {
    const left =
      (new Date(billing.trial_ends_at).getTime() - Date.now()) / 86400000
    if (left <= 0) {
      text = t('billingBanner.trialEnded', {
        date: formatDate(addDays(billing.trial_ends_at, GRACE_DAYS)),
      })
    } else if (left <= WARN_DAYS) {
      text = t('billingBanner.trialEnding', {
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
      {canManage && (
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
