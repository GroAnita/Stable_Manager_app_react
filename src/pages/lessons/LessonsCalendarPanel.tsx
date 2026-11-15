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
import { sessionColor } from '../../features/lessons/colors'
import { getCurrentStableId } from '../../lib/stableContext'
import { usePreferences } from '../../lib/PreferencesContext'

const BLOCKED_COLOR = '#B91C1C'

type CalendarView = 'month' | 'week'
const VIEW_KEY = 'stallorg.lessonsCalendarView'

function savedView(): CalendarView {
  try {
    return localStorage.getItem(VIEW_KEY) === 'week' ? 'week' : 'month'
  } catch {
    return 'month'
  }
}

function startOfWeek(date: Date): Date {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  return monday
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}
function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

export function LessonsCalendarPanel() {
  const { t, formatDate, formatTime, language } = usePreferences()
  const locale = language === 'no' ? 'nb-NO' : 'en-GB'
  const [view, setView] = useState<CalendarView>(savedView)
  const [currentMonth, setCurrentMonth] = useState(() =>
    startOfMonth(new Date()),
  )
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
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
    const rangeStart =
      view === 'week' ? new Date(weekStart) : startOfMonth(currentMonth)
    const rangeEnd =
      view === 'week'
        ? new Date(
            weekStart.getFullYear(),
            weekStart.getMonth(),
            weekStart.getDate() + 6,
          )
        : endOfMonth(currentMonth)
    rangeEnd.setHours(23, 59, 59, 999)
    Promise.all([
      listSessionsInRange(rangeStart.toISOString(), rangeEnd.toISOString()),
      loadBlockedDates(),
    ])
      .then(([upcoming]) => setSessions(upcoming))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [view, currentMonth, weekStart])

  function chooseView(next: CalendarView) {
    setView(next)
    try {
      localStorage.setItem(VIEW_KEY, next)
    } catch {
      // The choice just isn't remembered.
    }
    // Keep looking at the same stretch of time when switching.
    if (next === 'week') {
      const today = new Date()
      setWeekStart(
        startOfWeek(
          today.getFullYear() === currentMonth.getFullYear() &&
            today.getMonth() === currentMonth.getMonth()
            ? today
            : currentMonth,
        ),
      )
    } else {
      setCurrentMonth(startOfMonth(weekStart))
    }
  }

  function shift(amount: number) {
    if (view === 'week') {
      setWeekStart(
        (prev) =>
          new Date(
            prev.getFullYear(),
            prev.getMonth(),
            prev.getDate() + 7 * amount,
          ),
      )
    } else {
      shiftMonth(amount)
    }
  }

  function shiftMonth(amount: number) {
    setCurrentMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + amount, 1),
    )
  }

  async function handleAddNorwegianHolidays() {
    setAddingHolidays(true)
    setHolidaysMessage(null)
    try {
      const stableId = await getCurrentStableId()
      if (!stableId) throw new Error(t('lessons.noStableFound'))
      const year = shownYear
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

  const monthLabel = currentMonth.toLocaleString(locale, {
    month: 'long',
    year: 'numeric',
  })
  const weekDays = Array.from(
    { length: 7 },
    (_, index) =>
      new Date(
        weekStart.getFullYear(),
        weekStart.getMonth(),
        weekStart.getDate() + index,
      ),
  )
  const weekLabel = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).formatRange(weekDays[0], weekDays[6])
  const shownYear =
    view === 'week' ? weekDays[3].getFullYear() : currentMonth.getFullYear()

  const start = startOfMonth(currentMonth)
  const end = endOfMonth(currentMonth)
  const leading = (start.getDay() + 6) % 7
  const days: (Date | null)[] = []
  for (let i = 0; i < leading; i += 1) days.push(null)
  for (let day = 1; day <= end.getDate(); day += 1) {
    days.push(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day),
    )
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

  // One entry per course, and per single lesson with its own colour; single
  // lessons in the standard colour share one entry.
  const legend: { label: string; color: string }[] = []
  for (const session of sessions) {
    const label = session.course
      ? session.course.title
      : session.color
        ? session.title
        : t('lessons.navSchedule')
    const color = sessionColor(session)
    if (!legend.some((item) => item.label === label && item.color === color)) {
      legend.push({ label, color })
    }
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
            onClick={() => shift(-1)}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <Icon name="chevronLeft" className="h-4 w-4" />
          </button>
          <p className="text-sm font-medium text-slate-900 first-letter:uppercase">
            {view === 'week' ? weekLabel : monthLabel}
          </p>
          <button
            type="button"
            aria-label={t('common.next')}
            onClick={() => shift(1)}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <Icon name="chevronRight" className="h-4 w-4" />
          </button>
        </div>
        <div
          role="tablist"
          aria-label={t('lessonsCalendar.viewLabel')}
          className="flex gap-1 rounded-xl bg-slate-100 p-1 text-sm"
        >
          {(['month', 'week'] as CalendarView[]).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={view === key}
              onClick={() => chooseView(key)}
              className={`rounded-lg px-3 py-1 font-medium ${
                view === key
                  ? 'bg-card text-forest shadow-soft'
                  : 'text-slate-600'
              }`}
            >
              {key === 'month'
                ? t('lessonsCalendar.month')
                : t('lessonsCalendar.week')}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
          {legend.map((item) => (
            <span
              key={item.label + item.color}
              className="flex items-center gap-1.5"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: item.color }}
              />
              {item.label}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: BLOCKED_COLOR }}
            />
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
            : t('lessonsCalendar.addNorwegianHolidays', { year: shownYear })}
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

      {view === 'week' && (
        <WeekGrid
          days={weekDays}
          loading={loading}
          sessionsOn={sessionsOn}
          blockedDateOn={blockedDateOn}
          onOpenDay={(iso) => {
            setBlockLabel('')
            setDayModalDate(iso)
          }}
        />
      )}

      {view === 'month' && (
        <div
          className={`grid grid-cols-7 gap-2 ${loading ? 'opacity-50' : ''}`}
        >
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
              return (
                <div key={index} className="min-h-24 rounded-2xl bg-white/50" />
              )
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
                <p className="text-sm font-medium text-slate-900">
                  {day.getDate()}
                </p>
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
                          style={{
                            background: sessionColor(session),
                          }}
                        />
                        <span className="truncate">{session.title}</span>
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <p className="text-xs text-slate-400">
                        {t('lessons.moreSessions', {
                          count: dayEvents.length - 3,
                        })}
                      </p>
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}

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
                <span className="field-label">
                  {t('lessonsCalendar.blockLabel')}
                </span>
                <input
                  className="field"
                  placeholder={t('lessonsCalendar.blockLabelPlaceholder')}
                  value={blockLabel}
                  onChange={(e) => setBlockLabel(e.target.value)}
                />
              </label>
              <button
                type="submit"
                disabled={blockSaving}
                className="btn-ghost"
              >
                {t('lessonsCalendar.blockDate')}
              </button>
            </form>
          )}

          {dayModalSessions.length === 0 ? (
            <p className="text-sm text-slate-500">
              {t('lessons.noSessionsThisDay')}
            </p>
          ) : (
            <div className="space-y-3">
              {dayModalSessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-start gap-3 rounded-2xl border border-slate-100 p-3"
                >
                  <span
                    className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      background: sessionColor(session),
                    }}
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-900">
                        {session.title}
                      </p>
                      {session.course && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                          {session.course.title}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatTime(session.starts_at)}–
                      {formatTime(session.ends_at)}
                      {session.instructor_name
                        ? ` · ${session.instructor_name}`
                        : ''}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {t('lessons.spotsBooked', {
                        booked: session.bookings.filter(
                          (b) => b.status === 'confirmed',
                        ).length,
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

const HOUR_HEIGHT = 56
const DEFAULT_FIRST_HOUR = 7
const DEFAULT_LAST_HOUR = 21

function minutesOfDay(iso: string): number {
  const date = new Date(iso)
  return date.getHours() * 60 + date.getMinutes()
}

// Side-by-side columns for sessions that overlap: each gets a column, and every
// session in an overlapping group shares the group's column count.
function layoutDay(
  sessions: LessonSessionWithBookings[],
): { session: LessonSessionWithBookings; column: number; columns: number }[] {
  const placed: {
    session: LessonSessionWithBookings
    column: number
    columns: number
  }[] = []
  let group: typeof placed = []
  let groupEnd = -1
  const columnEnds: number[] = []
  const closeGroup = () => {
    const count = Math.max(1, ...group.map((item) => item.column + 1))
    for (const item of group) item.columns = count
    placed.push(...group)
    group = []
    columnEnds.length = 0
  }
  for (const session of sessions) {
    const start = minutesOfDay(session.starts_at)
    const end = Math.max(start + 15, minutesOfDay(session.ends_at))
    if (group.length > 0 && start >= groupEnd) closeGroup()
    let column = columnEnds.findIndex((columnEnd) => columnEnd <= start)
    if (column === -1) column = columnEnds.length
    columnEnds[column] = end
    group.push({ session, column, columns: 1 })
    groupEnd = Math.max(groupEnd, end)
  }
  if (group.length > 0) closeGroup()
  return placed
}

// A week with a timeline for the whole day, so the length of each lesson shows.
function WeekGrid({
  days,
  loading,
  sessionsOn,
  blockedDateOn,
  onOpenDay,
}: {
  days: Date[]
  loading: boolean
  sessionsOn: (iso: string) => LessonSessionWithBookings[]
  blockedDateOn: (iso: string) => BlockedDate | null
  onOpenDay: (iso: string) => void
}) {
  const { t, formatTime, language } = usePreferences()
  const locale = language === 'no' ? 'nb-NO' : 'en-GB'
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const isoDays = days.map((day) => toLocalIsoDate(day))
  const all = isoDays.flatMap((iso) => sessionsOn(iso))
  // Widen the day when a lesson starts earlier or ends later than usual.
  const firstHour = Math.min(
    DEFAULT_FIRST_HOUR,
    ...all.map((session) => Math.floor(minutesOfDay(session.starts_at) / 60)),
  )
  const lastHour = Math.max(
    DEFAULT_LAST_HOUR,
    ...all.map((session) => Math.ceil(minutesOfDay(session.ends_at) / 60)),
  )
  const hours = Array.from(
    { length: lastHour - firstHour },
    (_, i) => firstHour + i,
  )
  const top = (minutes: number) =>
    ((minutes - firstHour * 60) / 60) * HOUR_HEIGHT
  const todayIso = toLocalIsoDate(now)
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  return (
    <div
      className={`-mx-1 overflow-x-auto px-1 ${loading ? 'opacity-50' : ''}`}
    >
      <div className="min-w-[720px]">
        <div className="grid grid-cols-[3rem_repeat(7,1fr)] gap-1">
          <div />
          {days.map((day, index) => {
            const iso = isoDays[index]
            const blocked = blockedDateOn(iso)
            return (
              <button
                key={iso}
                type="button"
                onClick={() => onOpenDay(iso)}
                className={`rounded-xl px-1 py-2 text-center ${
                  iso === todayIso
                    ? 'bg-forest text-white'
                    : blocked
                      ? 'bg-red-50 text-red-700'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="block text-xs font-semibold uppercase">
                  {day
                    .toLocaleDateString(locale, { weekday: 'short' })
                    .replace('.', '')}
                </span>
                <span className="block text-lg leading-tight font-semibold">
                  {day.getDate()}
                </span>
                {blocked && (
                  <span className="block truncate text-[11px] font-medium">
                    {blocked.label || t('lessonsCalendar.blocked')}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div className="mt-1 grid grid-cols-[3rem_repeat(7,1fr)] gap-1">
          <div
            className="relative"
            style={{ height: hours.length * HOUR_HEIGHT }}
          >
            {hours.map((hour) => (
              <span
                key={hour}
                className="absolute right-1 -translate-y-1/2 text-[11px] text-slate-400"
                style={{ top: top(hour * 60) }}
              >
                {String(hour).padStart(2, '0')}:00
              </span>
            ))}
          </div>
          {days.map((_, index) => {
            const iso = isoDays[index]
            const blocked = blockedDateOn(iso)
            return (
              <div
                key={iso}
                className={`relative rounded-xl border ${
                  blocked
                    ? 'border-red-200 bg-red-50/60'
                    : 'border-slate-100 bg-card'
                }`}
                style={{ height: hours.length * HOUR_HEIGHT }}
              >
                {hours.slice(1).map((hour) => (
                  <div
                    key={hour}
                    className="absolute inset-x-0 border-t border-slate-100"
                    style={{ top: top(hour * 60) }}
                  />
                ))}
                {layoutDay(sessionsOn(iso)).map(
                  ({ session, column, columns }) => {
                    const start = minutesOfDay(session.starts_at)
                    const end = Math.max(
                      start + 20,
                      minutesOfDay(session.ends_at),
                    )
                    const color = sessionColor(session)
                    const booked = session.bookings.filter(
                      (b) => b.status === 'confirmed',
                    ).length
                    return (
                      <button
                        key={session.id}
                        type="button"
                        onClick={() => onOpenDay(iso)}
                        title={`${session.title} · ${formatTime(session.starts_at)}–${formatTime(session.ends_at)}`}
                        className="absolute overflow-hidden rounded-lg border-l-4 px-1.5 py-1 text-left text-xs shadow-sm hover:brightness-95"
                        style={{
                          top: top(start) + 1,
                          height: Math.max(22, top(end) - top(start) - 2),
                          left: `calc(${(column / columns) * 100}% + 2px)`,
                          width: `calc(${100 / columns}% - 4px)`,
                          borderColor: color,
                          background: `color-mix(in srgb, ${color} 14%, var(--color-card))`,
                        }}
                      >
                        <span className="block truncate font-semibold text-ink">
                          {session.title}
                        </span>
                        <span className="block truncate text-slate-600">
                          {formatTime(session.starts_at)}–
                          {formatTime(session.ends_at)}
                        </span>
                        <span className="block truncate text-slate-500">
                          {t('lessons.spotsBooked', {
                            booked,
                            capacity: session.capacity,
                          })}
                        </span>
                      </button>
                    )
                  },
                )}
                {iso === todayIso &&
                  nowMinutes >= firstHour * 60 &&
                  nowMinutes <= lastHour * 60 && (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-accent"
                      style={{ top: top(nowMinutes) }}
                    >
                      <span className="absolute -top-[5px] -left-1 h-2 w-2 rounded-full bg-accent" />
                    </div>
                  )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
