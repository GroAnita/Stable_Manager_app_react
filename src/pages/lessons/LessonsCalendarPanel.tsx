import { useEffect, useState } from 'react'
import { Icon } from '../../components/Icon'
import { Modal } from '../../components/Modal'
import {
  listSessionsInRange,
  type LessonSessionWithBookings,
} from '../../features/lessons/api'
import { usePreferences } from '../../lib/PreferencesContext'

const STANDALONE_COLOR = '#3A6B52'
const COURSE_COLOR = '#B45309'

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}
function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}
function toIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function LessonsCalendarPanel() {
  const { t, formatDate, formatTime } = usePreferences()
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()))
  const [sessions, setSessions] = useState<LessonSessionWithBookings[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dayModalDate, setDayModalDate] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    const rangeStart = startOfMonth(currentMonth)
    const rangeEnd = endOfMonth(currentMonth)
    rangeEnd.setHours(23, 59, 59, 999)
    listSessionsInRange(rangeStart.toISOString(), rangeEnd.toISOString())
      .then(setSessions)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [currentMonth])

  function shiftMonth(amount: number) {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + amount, 1))
  }

  const monthLabel = currentMonth.toLocaleString(undefined, {
    month: 'long',
    year: 'numeric',
  })

  const start = startOfMonth(currentMonth)
  const end = endOfMonth(currentMonth)
  const leading = (start.getDay() + 6) % 7
  const days: (Date | null)[] = []
  for (let i = 0; i < leading; i += 1) days.push(null)
  for (let day = 1; day <= end.getDate(); day += 1) {
    days.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day))
  }
  while (days.length % 7 !== 0) days.push(null)

  const weekdayLabels = [
    t('calendarView.mon'),
    t('calendarView.tue'),
    t('calendarView.wed'),
    t('calendarView.thu'),
    t('calendarView.fri'),
    t('calendarView.sat'),
    t('calendarView.sun'),
  ]

  function sessionsOn(iso: string): LessonSessionWithBookings[] {
    return sessions
      .filter((session) => toIsoDate(new Date(session.starts_at)) === iso)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  }

  const dayModalSessions = dayModalDate ? sessionsOn(dayModalDate) : []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={t('common.previous')}
            onClick={() => shiftMonth(-1)}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <Icon name="chevronLeft" className="h-4 w-4" />
          </button>
          <p className="text-sm font-medium text-slate-900 capitalize">{monthLabel}</p>
          <button
            type="button"
            aria-label={t('common.next')}
            onClick={() => shiftMonth(1)}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <Icon name="chevronRight" className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: STANDALONE_COLOR }} />
            {t('lessons.navSchedule')}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: COURSE_COLOR }} />
            {t('lessons.navCourses')}
          </span>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <div className={`grid grid-cols-7 gap-2 ${loading ? 'opacity-50' : ''}`}>
        {weekdayLabels.map((label) => (
          <p
            key={label}
            className="px-1 text-xs font-semibold text-slate-400 uppercase tracking-wide"
          >
            {label}
          </p>
        ))}
        {days.map((day, index) => {
          if (!day) {
            return <div key={index} className="min-h-24 rounded-2xl bg-white/50" />
          }
          const iso = toIsoDate(day)
          const dayEvents = sessionsOn(iso)
          return (
            <button
              key={iso}
              type="button"
              onClick={() => setDayModalDate(iso)}
              className="min-h-24 rounded-2xl border border-slate-200 bg-card p-2 text-left hover:border-forest/30"
            >
              <p className="text-sm font-medium text-slate-900">{day.getDate()}</p>
              <div className="mt-1 space-y-1">
                {dayEvents.slice(0, 3).map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center gap-1 truncate text-xs text-slate-600"
                  >
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: session.course ? COURSE_COLOR : STANDALONE_COLOR }}
                    />
                    <span className="truncate">{session.title}</span>
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <p className="text-xs text-slate-400">
                    {t('lessons.moreSessions', { count: dayEvents.length - 3 })}
                  </p>
                )}
              </div>
            </button>
          )
        })}
      </div>

      <Modal
        open={dayModalDate !== null}
        onClose={() => setDayModalDate(null)}
        title={dayModalDate ? formatDate(dayModalDate) : ''}
      >
        {dayModalSessions.length === 0 ? (
          <p className="text-sm text-slate-500">{t('lessons.noSessionsThisDay')}</p>
        ) : (
          <div className="space-y-3">
            {dayModalSessions.map((session) => (
              <div
                key={session.id}
                className="flex items-start gap-3 rounded-2xl border border-slate-100 p-3"
              >
                <span
                  className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: session.course ? COURSE_COLOR : STANDALONE_COLOR }}
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-900">{session.title}</p>
                    {session.course && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        {session.course.title}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatTime(session.starts_at)}–{formatTime(session.ends_at)}
                    {session.instructor_name ? ` · ${session.instructor_name}` : ''}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {t('lessons.spotsBooked', {
                      booked: session.bookings.filter((b) => b.status === 'confirmed').length,
                      capacity: session.capacity,
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}
