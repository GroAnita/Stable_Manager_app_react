import { useEffect, useState } from 'react'
import { EmptyState } from '../../components/EmptyState'
import {
  listMyHorses,
  listSchoolHorses,
  type SchoolHorseOption,
} from '../../features/horses/api'
import {
  bookDropinSession,
  listUpcomingSessions,
  type LessonSessionWithBookings,
} from '../../features/lessons/api'
import { getMyOwnerRecord } from '../../features/owners/api'
import { listRiders, type Rider } from '../../features/riders/api'
import { usePreferences } from '../../lib/PreferencesContext'

const SELF = '__self__'

type Eligibility =
  | { bookable: true }
  | { bookable: false; reasonKey: string; reasonVars?: Record<string, string> }

function eligibility(
  session: LessonSessionWithBookings,
  formatDate: (d: string | null) => string,
): Eligibility {
  const confirmedCount = session.bookings.filter((b) => b.status === 'confirmed').length
  const full = confirmedCount >= session.capacity

  if (!session.course) {
    return full ? { bookable: false, reasonKey: 'bookLesson.full' } : { bookable: true }
  }
  if (session.course.booking_mode === 'term_only') {
    return { bookable: false, reasonKey: 'bookLesson.termOnly' }
  }
  if (full) return { bookable: false, reasonKey: 'bookLesson.full' }
  if (session.course.booking_mode === 'dropin_only') return { bookable: true }

  const releaseAt =
    new Date(session.starts_at).getTime() -
    session.course.spare_release_days_before * 24 * 60 * 60 * 1000
  if (Date.now() < releaseAt) {
    return {
      bookable: false,
      reasonKey: 'bookLesson.opensOn',
      reasonVars: { date: formatDate(new Date(releaseAt).toISOString()) },
    }
  }
  return { bookable: true }
}

export function BookLessonPanel() {
  const { t, formatDate, formatTime } = usePreferences()
  const [ownerId, setOwnerId] = useState<string | null>(null)
  const [riders, setRiders] = useState<Rider[]>([])
  const [horses, setHorses] = useState<{ id: string; name: string }[]>([])
  const [schoolHorses, setSchoolHorses] = useState<SchoolHorseOption[]>([])
  const [sessions, setSessions] = useState<LessonSessionWithBookings[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [riderBySession, setRiderBySession] = useState<Record<string, string>>({})
  const [horseBySession, setHorseBySession] = useState<Record<string, string>>({})
  const [bookingSessionId, setBookingSessionId] = useState<string | null>(null)

  function load() {
    setLoading(true)
    Promise.all([
      getMyOwnerRecord(),
      listMyHorses(),
      listSchoolHorses(),
      listUpcomingSessions(),
    ])
      .then(([owner, myHorses, mySchoolHorses, upcoming]) => {
        setOwnerId(owner?.id ?? null)
        setHorses(myHorses.map((h) => ({ id: h.id, name: h.name })))
        setSchoolHorses(mySchoolHorses)
        setSessions(upcoming)
        return owner ? listRiders(owner.id) : []
      })
      .then(setRiders)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  async function handleBook(sessionId: string) {
    if (!ownerId) return
    const riderChoice = riderBySession[sessionId] ?? SELF
    const horseChoice = horseBySession[sessionId]
    setActionError(null)
    setBookingSessionId(sessionId)
    try {
      await bookDropinSession({
        sessionId,
        ownerId,
        riderId: riderChoice === SELF ? null : riderChoice,
        horseId: horseChoice || null,
      })
      load()
    } catch (err) {
      setActionError((err as Error).message)
    } finally {
      setBookingSessionId(null)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">{t('bookLesson.subtitle')}</p>

      {loading && <p className="text-sm text-slate-500">{t('lessons.loading')}</p>}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {actionError && (
        <p role="alert" className="text-sm text-red-600">
          {actionError}
        </p>
      )}
      {!loading && !error && sessions.length === 0 && (
        <EmptyState
          title={t('lessons.noLessonsTitle')}
          message={t('bookLesson.noSessionsMessage')}
        />
      )}

      {!loading && !error && sessions.length > 0 && (
        <div className="space-y-3">
          {sessions.map((session) => {
            const result = eligibility(session, formatDate)
            return (
              <div key={session.id} className="panel p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-900">{session.title}</p>
                      {session.course && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                          {session.course.title}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {formatDate(session.starts_at)} ·{' '}
                      {formatTime(session.starts_at)}–{formatTime(session.ends_at)}
                    </p>
                  </div>

                  {result.bookable ? (
                    <div className="flex flex-wrap items-center gap-2">
                      {riders.length > 0 && (
                        <select
                          className="field"
                          value={riderBySession[session.id] ?? SELF}
                          onChange={(e) =>
                            setRiderBySession((prev) => ({
                              ...prev,
                              [session.id]: e.target.value,
                            }))
                          }
                        >
                          <option value={SELF}>{t('bookLesson.myself')}</option>
                          {riders.map((rider) => (
                            <option key={rider.id} value={rider.id}>
                              {rider.full_name}
                            </option>
                          ))}
                        </select>
                      )}
                      <select
                        className="field"
                        value={horseBySession[session.id] ?? ''}
                        onChange={(e) =>
                          setHorseBySession((prev) => ({
                            ...prev,
                            [session.id]: e.target.value,
                          }))
                        }
                      >
                        <option value="">{t('bookLesson.noHorsePreference')}</option>
                        {horses.map((horse) => (
                          <option key={horse.id} value={horse.id}>
                            {horse.name}
                          </option>
                        ))}
                        {schoolHorses.map((horse) => (
                          <option key={horse.id} value={horse.id}>
                            {horse.name} ({t('bookLesson.schoolHorseTag')})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={bookingSessionId === session.id}
                        onClick={() => handleBook(session.id)}
                      >
                        {t('bookLesson.book')}
                      </button>
                    </div>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                      {t(result.reasonKey, result.reasonVars)}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
