import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  markWhatsNewSeen,
  unseenWhatsNewCount,
  WHATS_NEW_ENTRIES,
} from '../lib/whatsNew'
import { usePreferences } from '../lib/PreferencesContext'
import { Icon } from './Icon'

export function WhatsNewBell() {
  const { t, formatDate } = usePreferences()
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    setUnread(unseenWhatsNewCount())
  }, [])

  useEffect(() => {
    if (!open) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open])

  function handleOpen() {
    setOpen((prev) => !prev)
    if (unread > 0) {
      markWhatsNewSeen()
      setUnread(0)
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={
          unread > 0
            ? t('whatsNew.titleWithCount', { count: unread })
            : t('whatsNew.title')
        }
        aria-haspopup="true"
        aria-expanded={open}
        onClick={handleOpen}
        className="relative rounded-full p-2 text-ink/60 hover:bg-card hover:text-forest"
      >
        <Icon name="sparkles" className="h-5 w-5" />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-semibold text-white"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-80 max-w-[90vw] rounded-2xl border border-slate-200 bg-card p-3 shadow-card">
            <p className="px-1 text-sm font-semibold text-slate-800">
              {t('whatsNew.title')}
            </p>
            <div className="mt-2 max-h-96 space-y-2 overflow-y-auto">
              {WHATS_NEW_ENTRIES.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-xl bg-forest/5 px-3 py-2 text-sm"
                >
                  <p className="font-medium text-slate-800">
                    {t(entry.titleKey)}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-600">
                    {t(entry.bodyKey)}
                  </p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <p className="text-xs text-slate-400">
                      {formatDate(entry.date)}
                    </p>
                    {entry.linkTo && (
                      <Link
                        to={entry.linkTo}
                        onClick={() => setOpen(false)}
                        className="text-xs font-medium text-forest hover:underline"
                      >
                        {t('whatsNew.goThere')}
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
