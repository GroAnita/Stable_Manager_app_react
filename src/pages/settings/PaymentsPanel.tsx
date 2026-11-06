import { useCallback, useEffect, useState } from 'react'
import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'
import {
  getBillingRules,
  getCardSigningEnabled,
  setCardSigningEnabled,
  getStripeConnectStatus,
  setChargeDay,
  startStripeOnboarding,
  type StripeConnectStatus,
} from '../../features/payments/connect'
import { useConfirm } from '../../lib/ConfirmContext'
import { usePreferences } from '../../lib/PreferencesContext'
import { getCurrentStableId } from '../../lib/stableContext'
import { CardAgreementOverview } from './CardAgreementOverview'

const STRIPE_DASHBOARD_URL = 'https://dashboard.stripe.com'
const CHARGE_DAYS = Array.from({ length: 28 }, (_, index) => index + 1)

function ChargeDaySetting() {
  const { t } = usePreferences()
  const [chargeDay, setChargeDayValue] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getBillingRules()
      .then((rules) => setChargeDayValue(rules.chargeDay))
      .catch((err: Error) => setError(err.message))
  }, [])

  async function handleSave() {
    if (chargeDay === null) return
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      await setChargeDay(chargeDay)
      setSaved(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3 border-t border-slate-100 pt-4">
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {chargeDay !== null && (
        <>
          <label className="block">
            <span className="field-label">
              {t('settings.paymentsChargeDayTitle')}
            </span>
            <select
              className="field"
              value={chargeDay}
              onChange={(e) => {
                setChargeDayValue(Number(e.target.value))
                setSaved(false)
              }}
            >
              {CHARGE_DAYS.map((day) => (
                <option key={day} value={day}>
                  {t('settings.paymentsChargeDayOption', { day })}
                </option>
              ))}
            </select>
          </label>
          <p className="text-sm text-slate-500">
            {t('settings.paymentsChargeDayHelp')}
          </p>
          <button
            type="button"
            className="btn-ghost"
            disabled={saving}
            onClick={handleSave}
          >
            {t('settings.paymentsChargeDaySave')}
          </button>
          {saved && (
            <p className="text-sm text-forest">
              {t('settings.paymentsChargeDaySaved')}
            </p>
          )}
        </>
      )}
    </div>
  )
}

function CardSigningSetting() {
  const { t } = usePreferences()
  const confirm = useConfirm()
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getCurrentStableId()
      .then((stableId) => (stableId ? getCardSigningEnabled(stableId) : false))
      .then(setEnabled)
      .catch((err: Error) => setError(err.message))
  }, [])

  async function handleToggle() {
    if (enabled === null) return
    const next = !enabled
    if (
      !(await confirm(
        t(next ? 'settings.signingConfirmOn' : 'settings.signingConfirmOff'),
        {
          confirmLabel: t(next ? 'settings.signingOn' : 'settings.signingOff'),
        },
      ))
    )
      return
    setSaving(true)
    setError(null)
    try {
      await setCardSigningEnabled(next)
      setEnabled(next)
    } catch (err) {
      const text = (err as Error).message
      setError(
        text.includes('card_signing_not_ready')
          ? t('settings.signingNotReady')
          : text,
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3 border-t border-slate-100 pt-4">
      <h3 className="text-sm font-semibold text-slate-900">
        {t('settings.signingTitle')}
      </h3>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {enabled !== null && (
        <>
          <p className="text-sm text-slate-600">
            {t(
              enabled ? 'settings.signingStateOn' : 'settings.signingStateOff',
            )}
          </p>
          <p className="text-sm text-slate-500">{t('settings.signingHint')}</p>
          <button
            type="button"
            className={enabled ? 'btn-ghost' : 'btn-primary'}
            disabled={saving}
            onClick={handleToggle}
          >
            {t(enabled ? 'settings.signingOff' : 'settings.signingOn')}
          </button>
        </>
      )}
    </div>
  )
}

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

      {status && <ChargeDaySetting />}
      {status?.chargesEnabled && <CardSigningSetting />}
      {status?.chargesEnabled && <CardAgreementOverview />}
    </div>
  )
}
