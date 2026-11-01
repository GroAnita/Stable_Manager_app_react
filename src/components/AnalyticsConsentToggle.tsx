import { useState } from 'react'
import {
  getAnalyticsConsent,
  isClarityConfigured,
  setAnalyticsConsent,
} from '../lib/clarity'
import { usePreferences } from '../lib/PreferencesContext'
import { Toggle } from './Toggle'

export function AnalyticsConsentToggle() {
  const { t } = usePreferences()
  const [checked, setChecked] = useState(
    () => getAnalyticsConsent() === 'accepted',
  )

  if (!isClarityConfigured()) return null

  function handleChange(next: boolean) {
    setChecked(next)
    setAnalyticsConsent(next ? 'accepted' : 'declined')
  }

  return (
    <div className="space-y-2">
      <Toggle
        checked={checked}
        onChange={handleChange}
        label={t('settings.privacyAnalyticsLabel')}
      />
      <p className="text-xs text-slate-400">
        {t('settings.privacyAnalyticsHint')}
      </p>
    </div>
  )
}
