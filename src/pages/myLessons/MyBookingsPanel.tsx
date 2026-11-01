import { useEffect, useState } from 'react'
import { EmptyState } from '../../components/EmptyState'
import { cancelBooking, listMyBookings, type MyBooking } from '../../features/lessons/api'
import { usePreferences } from '../../lib/PreferencesContext'

export function MyBookingsPanel() {
  const { t, formatDate, formatTime } = usePreferences()
  const [bookings, setBookings] = useState<MyBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  function load() {
    setLoading(true)
    listMyBookings()
      .then(setBookings)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  async function handleCancel(bookingId: string) {
    setCancellingId(bookingId)
    try {
      await cancelBooking(bookingId)
      load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setCancellingId(null)
    }
  }

  const now = Date.now()
  const upcoming = bookings
    .filter(
      (b) =>
        b.status === 'confirmed' &&
        b.session &&
        new Date(b.session.starts_at).getTime() > now,
    )
    .sort((a, b) => (a.session!.starts_at < b.session!.starts_at ? -1 : 1))

  return (
    <div className="space-y-4">
      {loading && <p className="text-sm text-slate-500">{t('lessons.loading')}</p>}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {!loading && !error && upcoming.length === 0 && (
        <EmptyState
          title={t('myBookings.noBookingsTitle')}
          message={t('myBookings.noBookingsMessage')}
        />
      )}

      {!loading && !error && upcoming.length > 0 && (
        <div className="panel space-y-3 p-5">
          {upcoming.map((booking) => (
            <div
              key={booking.id}
              className="flex flex-col gap-2 rounded-2xl border border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-slate-900">{booking.session?.title}</p>
                  {booking.session?.course && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      {booking.session.course.title}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {booking.session && (
                    <>
                      {formatDate(booking.session.starts_at)} ·{' '}
                      {formatTime(booking.session.starts_at)}–
                      {formatTime(booking.session.ends_at)}
                    </>
                  )}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {[booking.rider?.full_name ?? t('myBookings.myself'), booking.horse?.name]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <button
                type="button"
                className="btn-ghost"
                disabled={cancellingId === booking.id}
                onClick={() => handleCancel(booking.id)}
              >
                {t('myBookings.cancel')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
