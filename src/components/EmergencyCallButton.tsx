import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'
import { usePreferences } from '../lib/PreferencesContext'

const ARM_TIMEOUT_MS = 4000

// Requires a second tap to actually place the call, so a pocket dial or
// stray tap can't call the fire department. The first tap only "arms"
// the button; it resets on its own after a few seconds if not confirmed.
export function EmergencyCallButton() {
  const { t } = usePreferences()
  const [armed, setArmed] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  function handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
    if (!armed) {
      event.preventDefault()
      setArmed(true)
      timeoutRef.current = setTimeout(() => setArmed(false), ARM_TIMEOUT_MS)
      return
    }
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setArmed(false)
  }

  return (
    <a
      href="tel:110"
      onClick={handleClick}
      aria-label={
        armed ? t('emergencyCall.confirmLabel') : t('emergencyCall.label')
      }
      className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-white shadow-soft transition ${
        armed
          ? 'bg-red-700 ring-2 ring-red-300'
          : 'bg-red-600 hover:bg-red-700'
      }`}
    >
      <Icon name="flame" className="h-4 w-4" />
      {armed ? t('emergencyCall.confirm') : '110'}
    </a>
  )
}
