import { Capacitor } from '@capacitor/core'
import { useState } from 'react'
import { usePreferences } from '../lib/PreferencesContext'
import { Modal } from './Modal'

// Temporary: invites stable owners to try the iPhone and iPad app in TestFlight.
// Delete this component and its i18n keys once the app is in the App Store.
const SEEN_KEY = 'stable-manager:testflight-invite-seen'
const SUPPORT_EMAIL = 'support@nestundigital.no'

export function TestFlightInvite() {
  const { t } = usePreferences()
  const [open, setOpen] = useState(
    () =>
      !Capacitor.isNativePlatform() && localStorage.getItem(SEEN_KEY) === null,
  )

  function close() {
    localStorage.setItem(SEEN_KEY, 'true')
    setOpen(false)
  }

  return (
    <Modal open={open} onClose={close} title={t('testFlightInvite.title')}>
      <div className="space-y-3 text-sm text-slate-600">
        <p>{t('testFlightInvite.body')}</p>
        <p>{t('testFlightInvite.howTo')}</p>
        <a
          className="block font-medium text-forest underline"
          href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(t('testFlightInvite.subject'))}`}
        >
          {SUPPORT_EMAIL}
        </a>
      </div>
      <button type="button" className="btn-primary mt-5" onClick={close}>
        {t('testFlightInvite.close')}
      </button>
    </Modal>
  )
}
