import { useCallback, useEffect, useState } from 'react'
import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'
import {
  acceptCardAgreement,
  changeSavedCard,
  getCardAgreementStatus,
  withdrawCardAgreement,
  type CardAgreementStatus,
} from '../../features/payments/cardAgreement'
import { useConfirm } from '../../lib/ConfirmContext'
import { usePreferences } from '../../lib/PreferencesContext'

export function CardAgreementPanel({ contractId }: { contractId: string }) {
  const { t, formatDate } = usePreferences()
  const confirm = useConfirm()
  const [status, setStatus] = useState<CardAgreementStatus | null>(null)
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [showText, setShowText] = useState(false)
  const [withdrawn, setWithdrawn] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    return getCardAgreementStatus(contractId)
      .then(setStatus)
      .catch((err: Error) => setError(err.message))
  }, [contractId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // In the iOS app Stripe's page opens in an in-app browser, so re-check when
  // the user closes it instead of relying on a redirect back to this page.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const listener = Browser.addListener('browserFinished', () => {
      void refresh()
    })
    return () => {
      void listener.then((handle) => handle.remove())
    }
  }, [refresh])

  async function handleAccept(version: string) {
    setBusy(true)
    setError(null)
    try {
      const url = await acceptCardAgreement(contractId, version)
      if (Capacitor.isNativePlatform()) {
        await Browser.open({ url })
        setBusy(false)
      } else {
        window.location.assign(url)
      }
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
      void refresh()
    }
  }

  async function handleChangeCard() {
    setBusy(true)
    setError(null)
    try {
      const url = await changeSavedCard(contractId)
      if (Capacitor.isNativePlatform()) {
        await Browser.open({ url })
        setBusy(false)
      } else {
        window.location.assign(url)
      }
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  async function handleWithdraw() {
    const confirmed = await confirm(t('myContract.cardWithdrawConfirm'), {
      confirmLabel: t('myContract.cardWithdraw'),
    })
    if (!confirmed) return
    setBusy(true)
    setError(null)
    try {
      await withdrawCardAgreement(contractId)
      setWithdrawn(true)
      setAccepted(false)
      await refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  // Nothing to show also covers co-owners, who can see the horse but can't sign,
  // and stables that haven't switched signing on.
  if (!status) return null
  if (!('active' in status) && !withdrawn) return null

  return (
    <div className="mt-6 space-y-4 border-t border-slate-100 pt-6">
      <h3 className="font-semibold text-slate-900">
        {t('myContract.cardTitle')}
      </h3>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {withdrawn && (
        <p className="text-sm text-forest">{t('myContract.cardWithdrawn')}</p>
      )}

      {'active' in status && status.active && (
        <>
          <p className="text-sm font-medium text-forest">
            {t('myContract.cardActive', { day: status.chargeDay })}
          </p>
          {status.pausedAt && (
            <p className="text-sm font-medium text-amber-700">
              {t('myContract.cardPaused')}
            </p>
          )}
          <p className="text-sm text-slate-600">
            {status.cardLast4
              ? t('myContract.cardDetails', {
                  brand: status.cardBrand ?? '',
                  last4: status.cardLast4,
                  date: formatDate(status.acceptedAt.slice(0, 10)),
                })
              : t('myContract.cardAcceptedOn', {
                  date: formatDate(status.acceptedAt.slice(0, 10)),
                })}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setShowText((prev) => !prev)}
            >
              {showText
                ? t('myContract.cardHideAgreement')
                : t('myContract.cardShowAgreement')}
            </button>
            <button
              type="button"
              className="btn-ghost"
              disabled={busy}
              onClick={handleChangeCard}
            >
              {t('myContract.cardChange')}
            </button>
            <button
              type="button"
              className="btn-ghost"
              disabled={busy}
              onClick={handleWithdraw}
            >
              {t('myContract.cardWithdraw')}
            </button>
          </div>
          {showText && (
            <div className="max-h-96 overflow-y-auto whitespace-pre-line rounded-2xl border border-slate-100 p-4 text-sm text-slate-600">
              {status.agreementText}
            </div>
          )}
        </>
      )}

      {'active' in status && !status.active && (
        <>
          <p className="text-sm text-slate-600">{t('myContract.cardIntro')}</p>
          <div className="max-h-96 space-y-4 overflow-y-auto rounded-2xl border border-slate-100 p-4 text-sm text-slate-600">
            <h4 className="font-semibold text-slate-900">
              {status.agreement.title}
            </h4>
            <p>{status.agreement.intro}</p>
            <div>
              {status.agreement.details.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
            {status.agreement.sections.map((section) => (
              <div key={section.heading} className="space-y-1">
                <h5 className="font-medium text-slate-800">
                  {section.heading}
                </h5>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            ))}
          </div>

          {status.missingEmail ? (
            <p role="alert" className="text-sm text-red-600">
              {t('myContract.cardMissingEmail')}
            </p>
          ) : (
            <>
              <label className="flex items-start gap-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                />
                <span>{status.agreement.acceptance}</span>
              </label>
              <button
                type="button"
                className="btn-primary"
                disabled={!accepted || busy}
                onClick={() => handleAccept(status.agreement.version)}
              >
                {busy
                  ? t('myContract.cardOpening')
                  : t('myContract.cardAccept')}
              </button>
            </>
          )}
        </>
      )}
    </div>
  )
}
