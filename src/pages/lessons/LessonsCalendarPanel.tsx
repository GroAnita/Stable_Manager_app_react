import { useEffect, useState, type FormEvent } from 'react'
import { Icon } from '../../components/Icon'
import { Modal } from '../../components/Modal'
import {
  addBlockedDate,
  addBlockedDates,
  computeNorwegianPublicHolidays,
  deleteBlockedDate,
  listBlockedDates,
  listSessionsInRange,
  toLocalIsoDate,
  type BlockedDate,
  type LessonSessionWithBookings,
} from '../../features/lessons/api'
import { getCurrentStableId } from '../../lib/stableContext'
import { usePreferences } from '../../lib/PreferencesContext'

const STANDALONE_COLOR = '#3A6B52'
const COURSE_COLOR = '#B45309'
const BLOCKED_COLOR = '#B91C1C'

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}
function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

export function LessonsCalendarPanel() {
  const { t, formatDate, formatTime } = usePreferences()
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()))
  const [sessions, setSessions] = useState<LessonSessionWithBookings[]>([])
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dayModalDate, setDayModalDate] = useState<string | null>(null)
  const [blockLabel, setBlockLabel] = useState('')
  const [blockSaving, setBlockSaving] = useState(false)
  const [holidaysMessage, setHolidaysMessage] = useState<string | null>(null)
  const [addingHolidays, setAddingHolidays] = useState(false)

  function loadBlockedDates() {
    return listBlockedDates().then(setBlockedDates)
  }

  useEffect(() => {
    setLoading(true)
    const rangeStart = startOfMonth(currentMonth)
    const rangeEnd = endOfMonth(currentMonth)
    rangeEnd.setHours(23, 59, 59, 999)
    Promise.all([
      listSessionsInRange(rangeStart.toISOString(), rangeEnd.toISOString()),
      loadBlockedDates(),
    ])
      .then(([upcoming]) => setSessions(upcoming))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [currentMonth])

  function shiftMonth(amount: number) {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + amount, 1))
  }

  async function handleAddNorwegianHolidays() {
    setAddingHolidays(true)
    setHolidaysMessage(null)
    try {
      const stableId = await getCurrentStableId()
      if (!stableId) throw new Error(t('lessons.noStableFound'))
      const year = currentMonth.getFullYear()
      const holidays = computeNorwegianPublicHolidays(year)
      await addBlockedDates(stableId, holidays)
      await loadBlockedDates()
      setHolidaysMessage(t('lessonsCalendar.holidaysAdded', { year }))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setAddingHolidays(false)
    }
  }

  async function handleBlockDate(iso: string) {
    setBlockSaving(true)
    try {
      const stableId = await getCurrentStableId()
      if (!stableId) throw new Error(t('lessons.noStableFound'))
      const created = await addBlockedDate({
        stable_id: stableId,
        date: iso,
        label: blockLabel || null,
      })
      setBlockedDates((prev) => [...prev, created])
      setBlockLabel('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBlockSaving(false)
    }
  }

  async function handleUnblockDate(id: string) {
    setBlockSaving(true)
    try {
      await deleteBlockedDate(id)
      setBlockedDates((prev) => prev.filter((b) => b.id !== id))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBlockSaving(false)
    }
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
      .filter((session) => toLocalIsoDate(new Date(session.starts_at)) === iso)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  }

  function blockedDateOn(iso: string): BlockedDate | null {
    return blockedDates.find((b) => b.date === iso) ?? null
  }

  const dayModalSessions = dayModalDate ? sessionsOn(dayModalDate) : []
  const dayModalBlocked = dayModalDate ? blockedDateOn(dayModalDate) : null

  function handleBlockSubmit(event: FormEvent) {
    event.preventDefault()
    if (dayModalDate) handleBlockDate(dayModalDate)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
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
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: BLOCKED_COLOR }} />
            {t('lessonsCalendar.blocked')}
          </span>
        </div>
        <button
          type="button"
          className="btn-ghost"
          disabled={addingHolidays}
          onClick={handleAddNorwegianHolidays}
        >
          {addingHolidays
            ? t('common.saving')
            : t('lessonsCalendar.addNorwegianHolidays', { year: currentMonth.getFullYear() })}
        </button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {holidaysMessage && (
        <p role="status" className="text-sm text-emerald-700">
          {holidaysMessage}
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
          const iso = toLocalIsoDate(day)
          const dayEvents = sessionsOn(iso)
          const blocked = blockedDateOn(iso)
          return (
            <button
              key={iso}
              type="button"
              onClick={() => {
                setBlockLabel('')
                setDayModalDate(iso)
              }}
              className={`min-h-24 rounded-2xl border p-2 text-left ${
                blocked
                  ? 'border-red-200 bg-red-50 hover:border-red-300'
                  : 'border-slate-200 bg-card hover:border-forest/30'
              }`}
            >
              <p className="text-sm font-medium text-slate-900">{day.getDate()}</p>
              {blocked ? (
                <p className="mt-1 truncate text-xs font-medium text-red-700">
                  {blocked.label || t('lessonsCalendar.blocked')}
                </p>
              ) : (
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
              )}
            </button>
          )
        })}
      </div>

      <Modal
        open={dayModalDate !== null}
        onClose={() => setDayModalDate(null)}
        title={dayModalDate ? formatDate(dayModalDate) : ''}
      >
        <div className="space-y-4">
          {dayModalBlocked ? (
            <div className="flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 p-3">
              <span className="text-sm font-medium text-red-700">
                {dayModalBlocked.label || t('lessonsCalendar.blocked')}
              </span>
              <button
                type="button"
                className="btn-ghost"
                disabled={blockSaving}
                onClick={() => handleUnblockDate(dayModalBlocked.id)}
              >
                {t('lessonsCalendar.unblock')}
              </button>
            </div>
          ) : (
            <form onSubmit={handleBlockSubmit} className="flex items-end gap-2">
              <label className="flex-1">
                <span className="field-label">{t('lessonsCalendar.blockLabel')}</span>
                <input
                  className="field"
                  placeholder={t('lessonsCalendar.blockLabelPlaceholder')}
                  value={blockLabel}
                  onChange={(e) => setBlockLabel(e.target.value)}
                />
              </label>
              <button type="submit" disabled={blockSaving} className="btn-ghost">
                {t('lessonsCalendar.blockDate')}
              </button>
            </form>
          )}

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
        </div>
      </Modal>
    </div>
  )
}
