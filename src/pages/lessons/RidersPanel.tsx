import { useEffect, useState } from 'react'
import { EmptyState } from '../../components/EmptyState'
import { listSessionsInRange, type LessonBooking } from '../../features/lessons/api'
import { listAllRiders, type RiderWithOwner } from '../../features/riders/api'
import { usePreferences } from '../../lib/PreferencesContext'

function startOfToday(): Date {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}
function endOfToday(): Date {
  const date = new Date()
  date.setHours(23, 59, 59, 999)
  return date
}

type TodayBooking = LessonBooking & { sessionStartsAt: string }

export function RidersPanel() {
  const { t, formatTime } = usePreferences()
  const [riders, setRiders] = useState<RiderWithOwner[]>([])
  const [todaysBookings, setTodaysBookings] = useState<TodayBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      listAllRiders(),
      listSessionsInRange(startOfToday().toISOString(), endOfToday().toISOString()),
    ])
      .then(([allRiders, sessions]) => {
        setRiders(allRiders)
        setTodaysBookings(
          sessions.flatMap((session): TodayBooking[] =>
            session.bookings
              .filter((b) => b.status === 'confirmed')
              .map((b) => ({ ...b, sessionStartsAt: session.starts_at })),
          ),
        )
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  function bookingsForRider(riderId: string): TodayBooking[] {
    return todaysBookings.filter((b) => b.rider_id === riderId)
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">{t('ridersPanel.subtitle')}</p>

      {loading && <p className="text-sm text-slate-500">{t('lessons.loading')}</p>}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {!loading && !error && riders.length === 0 && (
        <EmptyState
          title={t('ridersPanel.noRidersTitle')}
          message={t('ridersPanel.noRidersMessage')}
        />
      )}

      {!loading && !error && riders.length > 0 && (
        <div className="panel space-y-3 p-5">
          {riders.map((rider) => {
            const bookings = bookingsForRider(rider.id)
            return (
              <div
                key={rider.id}
                className="flex flex-col gap-2 rounded-2xl border border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-slate-900">{rider.full_name}</p>
                  <p className="text-sm text-slate-500">{rider.owner?.full_name ?? '—'}</p>
                </div>
                {bookings.length > 0 ? (
                  <div className="flex flex-col gap-1 sm:items-end">
                    {bookings.map((booking) => (
                      <span
                        key={booking.id}
                        className="rounded-full bg-forest/10 px-3 py-1 text-xs font-medium text-forest"
                      >
                        {booking.horse?.name ?? t('lessons.noHorseAssigned')} ·{' '}
                        {formatTime(booking.sessionStartsAt)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                    {t('ridersPanel.noLessonToday')}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
