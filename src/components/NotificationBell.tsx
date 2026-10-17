import { useEffect, useState } from 'react'
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type RotaNotification,
} from '../features/feedingRota/api'
import { usePreferences } from '../lib/PreferencesContext'
import { Icon } from './Icon'

export function NotificationBell() {
  const { t, formatDate } = usePreferences()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<RotaNotification[]>([])

  function load() {
    listNotifications()
      .then(setNotifications)
      .catch(() => setNotifications([]))
  }

  useEffect(load, [])

  const unread = notifications.filter((n) => !n.is_read)

  async function handleOpen() {
    setOpen((prev) => !prev)
  }

  async function handleMarkRead(id: string) {
    await markNotificationRead(id)
    load()
  }

  async function handleMarkAllRead() {
    await markAllNotificationsRead(unread.map((n) => n.id))
    load()
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={t('feedingRota.notificationsTitle')}
        onClick={handleOpen}
        className="relative rounded-full p-2 text-ink/60 hover:bg-card hover:text-forest"
      >
        <Icon name="bell" className="h-5 w-5" />
        {unread.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-semibold text-white">
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-80 max-w-[90vw] rounded-2xl border border-slate-200 bg-card p-3 shadow-card">
            <div className="flex items-center justify-between gap-2 px-1">
              <p className="text-sm font-semibold text-slate-800">
                {t('feedingRota.notificationsTitle')}
              </p>
              {unread.length > 0 && (
                <button
                  type="button"
                  className="text-xs font-medium text-forest hover:underline"
                  onClick={handleMarkAllRead}
                >
                  {t('feedingRota.markAllRead')}
                </button>
              )}
            </div>
            <div className="mt-2 max-h-80 space-y-1 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="px-1 py-3 text-sm text-slate-500">
                  {t('feedingRota.noNotifications')}
                </p>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleMarkRead(n.id)}
                    className={`w-full rounded-xl px-3 py-2 text-left text-sm ${
                      n.is_read
                        ? 'text-slate-500'
                        : 'bg-forest/5 text-slate-800'
                    }`}
                  >
                    <p className="font-medium">{n.title}</p>
                    {n.message && (
                      <p className="mt-0.5 text-xs text-slate-500">
                        {n.message}
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-slate-400">
                      {formatDate(n.created_at)}
                    </p>
                  </button>
                ))
              )}
            </div>
            <p className="mt-2 border-t border-slate-100 px-1 pt-2 text-xs text-slate-400">
              {t('feedingRota.pushComingSoon')}
            </p>
          </div>
        </>
      )}
    </div>
  )
}
