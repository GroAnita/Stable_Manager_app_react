import { useState } from 'react'
import {
  getAnalyticsConsent,
  isClarityConfigured,
  setAnalyticsConsent,
  type AnalyticsConsent,
} from '../lib/clarity'
import { usePreferences } from '../lib/PreferencesContext'

export function ConsentBanner() {
  const { t } = usePreferences()
  const [visible, setVisible] = useState(
    () => isClarityConfigured() && getAnalyticsConsent() === null,
  )

  if (!visible) return null

  function choose(consent: AnalyticsConsent) {
    setAnalyticsConsent(consent)
    setVisible(false)
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 p-4 shadow-soft backdrop-blur">
      <div className="mx-auto flex max-w-4xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">{t('consent.message')}</p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => choose('declined')}
          >
            {t('consent.decline')}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => choose('accepted')}
          >
            {t('consent.accept')}
          </button>
        </div>
      </div>
    </div>
  )
}
