import { useEffect, useState } from 'react'
import { EmptyState } from '../components/EmptyState'
import {
  bookLesson,
  cancelLessonBooking,
  listUpcomingLessons,
  type LessonWithBookings,
} from '../features/lessons/api'
import { listMyHorses } from '../features/horses/api'
import { getMyOwnerRecord } from '../features/owners/api'
import { usePreferences } from '../lib/PreferencesContext'

export default function MyLessons() {
  const { t, formatDate, formatTime } = usePreferences()
  const [myOwnerId, setMyOwnerId] = useState<string | null>(null)
  const [horses, setHorses] = useState<{ id: string; name: string }[]>([])
  const [lessons, setLessons] = useState<LessonWithBookings[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [selectedHorseByLesson, setSelectedHorseByLesson] = useState<
    Record<string, string>
  >({})
  const [bookingLessonId, setBookingLessonId] = useState<string | null>(null)

  function load() {
    Promise.all([getMyOwnerRecord(), listMyHorses(), listUpcomingLessons()])
      .then(([owner, myHorses, upcoming]) => {
        setMyOwnerId(owner?.id ?? null)
        setHorses(myHorses.map((h) => ({ id: h.id, name: h.name })))
        setLessons(upcoming)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  async function handleBook(lessonId: string) {
    const horseId = selectedHorseByLesson[lessonId] ?? horses[0]?.id
    if (!myOwnerId || !horseId) return
    setActionError(null)
    setBookingLessonId(lessonId)
    try {
      await bookLesson(lessonId, myOwnerId, horseId)
      load()
    } catch (err) {
      setActionError((err as Error).message)
    } finally {
      setBookingLessonId(null)
    }
  }

  async function handleCancel(bookingId: string) {
    setActionError(null)
    try {
      await cancelLessonBooking(bookingId)
      load()
    } catch (err) {
      setActionError((err as Error).message)
    }
  }

  return (
    <div className="page-shell">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">
          {t('myLessons.title')}
        </h1>
        <p className="mt-2 text-sm text-slate-500">{t('myLessons.subtitle')}</p>
      </div>

      {loading && (
        <p className="text-sm text-slate-500">{t('lessons.loading')}</p>
      )}
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
      {!loading && !error && lessons.length === 0 && (
        <EmptyState
          title={t('lessons.noLessonsTitle')}
          message={t('myLessons.noLessonsMessage')}
        />
      )}

      {!loading && !error && lessons.length > 0 && (
        <div className="space-y-3">
          {lessons.map((lesson) => {
            const myBooking = lesson.bookings.find(
              (b) => b.owner_id === myOwnerId,
            )
            const spotsLeft = lesson.capacity - lesson.bookings.length
            return (
              <div key={lesson.id} className="panel p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="font-medium text-slate-900">{lesson.title}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {[
                        formatDate(lesson.starts_at),
                        `${formatTime(lesson.starts_at)}–${formatTime(lesson.ends_at)}`,
                        lesson.instructor_name,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>

                  {myBooking ? (
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-slate-700">
                        {t('myLessons.bookedWith', {
                          horse: myBooking.horse?.name ?? '',
                        })}
                      </span>
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => handleCancel(myBooking.id)}
                      >
                        {t('myLessons.cancelBooking')}
                      </button>
                    </div>
                  ) : spotsLeft > 0 ? (
                    <div className="flex items-center gap-2">
                      <select
                        className="field"
                        value={selectedHorseByLesson[lesson.id] ?? horses[0]?.id ?? ''}
                        onChange={(e) =>
                          setSelectedHorseByLesson((prev) => ({
                            ...prev,
                            [lesson.id]: e.target.value,
                          }))
                        }
                      >
                        {horses.map((horse) => (
                          <option key={horse.id} value={horse.id}>
                            {horse.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={bookingLessonId === lesson.id || horses.length === 0}
                        onClick={() => handleBook(lesson.id)}
                      >
                        {t('myLessons.book')}
                      </button>
                    </div>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                      {t('myLessons.full')}
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
