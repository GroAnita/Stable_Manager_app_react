import { useCallback, useEffect, useState } from 'react'
import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'
import {
  getStripeConnectStatus,
  startStripeOnboarding,
  type StripeConnectStatus,
} from '../../features/payments/connect'
import { usePreferences } from '../../lib/PreferencesContext'

const STRIPE_DASHBOARD_URL = 'https://dashboard.stripe.com'

export function PaymentsPanel() {
  const { t } = usePreferences()
  const [status, setStatus] = useState<StripeConnectStatus | null>(null)
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshStatus = useCallback(() => {
    setError(null)
    return getStripeConnectStatus()
      .then(setStatus)
      .catch((err: Error) => setError(err.message))
  }, [])

  useEffect(() => {
    void refreshStatus()
  }, [refreshStatus])

  // In the iOS app onboarding opens in an in-app browser, so re-check when
  // the user closes it instead of relying on a redirect back to this page.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const listener = Browser.addListener('browserFinished', () => {
      void refreshStatus()
    })
    return () => {
      void listener.then((handle) => handle.remove())
    }
  }, [refreshStatus])

  async function handleOpenOnboarding() {
    setOpening(true)
    setError(null)
    try {
      const url = await startStripeOnboarding()
      if (Capacitor.isNativePlatform()) {
        await Browser.open({ url })
        setOpening(false)
      } else {
        window.location.assign(url)
      }
    } catch (err) {
      setError((err as Error).message)
      setOpening(false)
    }
  }

  return (
    <div className="panel space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="section-title">{t('settings.paymentsTitle')}</h2>
        {status && !status.livemode && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
            {t('settings.paymentsTestMode')}
          </span>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      {!status && !error && (
        <p className="text-sm text-slate-500">
          {t('settings.paymentsLoading')}
        </p>
      )}

      {status && !status.chargesEnabled && (
        <>
          <p className="text-sm text-slate-600">
            {status.connected
              ? t('settings.paymentsIncomplete')
              : t('settings.paymentsIntro')}
          </p>
          {!status.connected && (
            <p className="text-sm text-slate-500">
              {t('settings.paymentsFeeNote')}
            </p>
          )}
          <button
            type="button"
            className="btn-primary"
            disabled={opening}
            onClick={handleOpenOnboarding}
          >
            {opening
              ? t('settings.paymentsOpening')
              : status.connected
                ? t('settings.paymentsContinue')
                : t('settings.paymentsActivate')}
          </button>
        </>
      )}

      {status?.chargesEnabled && (
        <>
          <p className="text-sm font-medium text-forest">
            {t('settings.paymentsActive')}
          </p>
          {!status.payoutsEnabled && (
            <p className="text-sm text-slate-600">
              {t('settings.paymentsPayoutsPending')}
            </p>
          )}
          <a
            className="btn-ghost inline-flex"
            href={STRIPE_DASHBOARD_URL}
            target="_blank"
            rel="noreferrer"
          >
            {t('settings.paymentsOpenDashboard')}
          </a>
        </>
      )}
    </div>
  )
}
