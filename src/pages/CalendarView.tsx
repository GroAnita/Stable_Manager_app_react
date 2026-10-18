import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Badge } from '../components/Badge'
import { Icon } from '../components/Icon'
import { ShiftFeedingInfo } from '../components/ShiftFeedingInfo'
import { Modal } from '../components/Modal'
import {
  listAllPublishedShifts,
  reassignShift,
  type FeedingShift,
} from '../features/feedingRota/api'
import {
  createHorseEvent,
  deleteHorseEvent,
  listAllEvents,
  updateHorseEvent,
  type CalendarEvent,
} from '../features/horses/api'
import { getMyOwnerRecord } from '../features/owners/api'
import { useAuth } from '../lib/AuthContext'
import {
  listHorseOptions,
  listOwnerOptions,
  type HorseOption,
  type OwnerOption,
} from '../lib/options'
import { usePreferences } from '../lib/PreferencesContext'
import { getCurrentStableId } from '../lib/stableContext'
import type { Database } from '../types/supabase'

const FEEDING_SHIFT_COLOR = '#0284C7'

function feedingShiftMoment(shift: FeedingShift): Date {
  const time = shift.shift_type?.time_of_day?.slice(0, 5) ?? '00:00'
  return new Date(`${shift.date}T${time}:00`)
}

type EventType = Database['public']['Enums']['calendar_event_type']
type ViewMode = 'month' | 'week' | 'day'

const EVENT_TYPES: EventType[] = [
  'vet',
  'farrier',
  'vaccination',
  'worming',
  'training',
  'stable_event',
  'arena_booking',
]

const EVENT_COLORS: Record<EventType, string> = {
  vet: '#3A6B52',
  farrier: '#8B6B4A',
  vaccination: '#DC2626',
  worming: '#D8B25A',
  training: '#5B8A72',
  stable_event: '#688F91',
  arena_booking: '#7C8A7D',
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}
function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}
function startOfWeek(date: Date): Date {
  const start = new Date(date)
  const day = (start.getDay() + 6) % 7
  start.setDate(start.getDate() - day)
  return start
}
function endOfWeek(date: Date): Date {
  const start = startOfWeek(date)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return end
}
function toIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
function toDatetimeLocal(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
function fromDatetimeLocal(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

type EventFormState = {
  title: string
  event_type: EventType
  horse_id: string
  start_time: string
  end_time: string
  description: string
}

function emptyForm(defaultStart: string): EventFormState {
  return {
    title: '',
    event_type: 'vet',
    horse_id: '',
    start_time: defaultStart,
    end_time: '',
    description: '',
  }
}

function toForm(event: CalendarEvent): EventFormState {
  return {
    title: event.title,
    event_type: event.event_type,
    horse_id: event.horse?.id ?? '',
    start_time: toDatetimeLocal(event.start_time),
    end_time: toDatetimeLocal(event.end_time),
    description: event.description ?? '',
  }
}

function EventFields({
  form,
  horses,
  onChange,
}: {
  form: EventFormState
  horses: HorseOption[]
  onChange: <K extends keyof EventFormState>(
    key: K,
    value: EventFormState[K],
  ) => void
}) {
  const { t } = usePreferences()
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="sm:col-span-2">
        <span className="field-label">{t('calendarView.eventTitle')}</span>
        <input
          required
          className="field"
          value={form.title}
          onChange={(e) => onChange('title', e.target.value)}
        />
      </label>
      <label>
        <span className="field-label">{t('calendarView.eventType')}</span>
        <select
          className="field"
          value={form.event_type}
          onChange={(e) => onChange('event_type', e.target.value as EventType)}
        >
          {EVENT_TYPES.map((value) => (
            <option key={value} value={value}>
              {t(`status.${value}`)}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="field-label">{t('calendarView.horse')}</span>
        <select
          className="field"
          value={form.horse_id}
          onChange={(e) => onChange('horse_id', e.target.value)}
        >
          <option value="">{t('calendarView.noHorse')}</option>
          {horses.map((horse) => (
            <option key={horse.id} value={horse.id}>
              {horse.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="field-label">{t('horseDetail.startTime')}</span>
        <input
          required
          type="datetime-local"
          className="field"
          value={form.start_time}
          onChange={(e) => onChange('start_time', e.target.value)}
        />
      </label>
      <label>
        <span className="field-label">{t('horseDetail.endTime')}</span>
        <input
          type="datetime-local"
          className="field"
          value={form.end_time}
          onChange={(e) => onChange('end_time', e.target.value)}
        />
      </label>
      <label className="sm:col-span-2">
        <span className="field-label">{t('horseDetail.description')}</span>
        <textarea
          className="field"
          value={form.description}
          onChange={(e) => onChange('description', e.target.value)}
        />
      </label>
    </div>
  )
}

export default function CalendarView() {
  const { t, formatDate, formatTime } = usePreferences()
  const { profile } = useAuth()
  const canManage = profile?.role !== 'horse_owner'
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [horses, setHorses] = useState<HorseOption[]>([])
  const [owners, setOwners] = useState<OwnerOption[]>([])
  const [feedingShifts, setFeedingShifts] = useState<FeedingShift[]>([])
  const [myOwnerId, setMyOwnerId] = useState<string | null>(null)
  const [myDutiesOnly, setMyDutiesOnly] = useState(false)
  const [feedingDetail, setFeedingDetail] = useState<FeedingShift | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [currentDate, setCurrentDate] = useState(new Date())
  const [mode, setMode] = useState<ViewMode>('month')

  const [dayModalDate, setDayModalDate] = useState<string | null>(null)

  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState<EventFormState>(() =>
    emptyForm(toDatetimeLocal(new Date().toISOString())),
  )
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const [editing, setEditing] = useState<CalendarEvent | null>(null)
  const [editForm, setEditForm] = useState<EventFormState>(() => emptyForm(''))
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      listAllEvents(),
      listHorseOptions(),
      listAllPublishedShifts(),
      canManage ? listOwnerOptions() : Promise.resolve([]),
      canManage ? Promise.resolve(null) : getMyOwnerRecord(),
    ])
      .then(([eventsData, horsesData, shiftsData, ownerOpts, myOwner]) => {
        if (!cancelled) {
          setEvents(eventsData)
          setHorses(horsesData)
          setFeedingShifts(shiftsData)
          setOwners(ownerOpts)
          setMyOwnerId(myOwner?.id ?? null)
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const range = useMemo(() => {
    if (mode === 'month')
      return { start: startOfMonth(currentDate), end: endOfMonth(currentDate) }
    if (mode === 'week')
      return { start: startOfWeek(currentDate), end: endOfWeek(currentDate) }
    return { start: new Date(currentDate), end: new Date(currentDate) }
  }, [currentDate, mode])

  const visibleEvents = useMemo(
    () =>
      myDutiesOnly
        ? []
        : events
            .filter((event) => {
              const date = new Date(event.start_time)
              return date >= range.start && date <= range.end
            })
            .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [events, range, myDutiesOnly],
  )

  const visibleFeedingShifts = useMemo(
    () =>
      feedingShifts
        .filter((shift) => {
          const moment = feedingShiftMoment(shift)
          if (moment < range.start || moment > range.end) return false
          if (myDutiesOnly && shift.assigned_owner_id !== myOwnerId)
            return false
          return true
        })
        .sort(
          (a, b) =>
            feedingShiftMoment(a).getTime() - feedingShiftMoment(b).getTime(),
        ),
    [feedingShifts, range, myDutiesOnly, myOwnerId],
  )

  function feedingShiftsOn(iso: string): FeedingShift[] {
    return feedingShifts.filter((shift) => {
      if (shift.date !== iso) return false
      if (myDutiesOnly && shift.assigned_owner_id !== myOwnerId) return false
      return true
    })
  }

  function findHorseFor(form: EventFormState): HorseOption | null {
    return horses.find((h) => h.id === form.horse_id) ?? null
  }

  function openAdd(defaultDate?: Date) {
    if (!canManage) return
    setAddForm(
      emptyForm(toDatetimeLocal((defaultDate ?? new Date()).toISOString())),
    )
    setAddError(null)
    setAddOpen(true)
  }

  function updateAddField<K extends keyof EventFormState>(
    key: K,
    value: EventFormState[K],
  ) {
    setAddForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleAddSubmit(event: FormEvent) {
    event.preventDefault()
    const startTime = fromDatetimeLocal(addForm.start_time)
    if (!startTime) return
    setAddSaving(true)
    setAddError(null)
    try {
      const stableId = await getCurrentStableId()
      if (!stableId) throw new Error(t('calendarView.noStableFound'))
      const created = await createHorseEvent({
        stable_id: stableId,
        horse_id: addForm.horse_id || null,
        title: addForm.title,
        event_type: addForm.event_type,
        start_time: startTime,
        end_time: fromDatetimeLocal(addForm.end_time),
        description: addForm.description || null,
      })
      const horse = findHorseFor(addForm)
      setEvents((prev) =>
        [...prev, { ...created, horse }].sort((a, b) =>
          a.start_time.localeCompare(b.start_time),
        ),
      )
      setAddOpen(false)
    } catch (err) {
      setAddError((err as Error).message)
    } finally {
      setAddSaving(false)
    }
  }

  function openEdit(event: CalendarEvent) {
    if (!canManage) return
    setEditing(event)
    setEditForm(toForm(event))
    setEditError(null)
  }

  function updateEditField<K extends keyof EventFormState>(
    key: K,
    value: EventFormState[K],
  ) {
    setEditForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleEditSubmit(event: FormEvent) {
    event.preventDefault()
    if (!editing) return
    const startTime = fromDatetimeLocal(editForm.start_time)
    if (!startTime) return
    setEditSaving(true)
    setEditError(null)
    try {
      const updated = await updateHorseEvent(editing.id, {
        horse_id: editForm.horse_id || null,
        title: editForm.title,
        event_type: editForm.event_type,
        start_time: startTime,
        end_time: fromDatetimeLocal(editForm.end_time),
        description: editForm.description || null,
      })
      const horse = findHorseFor(editForm)
      setEvents((prev) =>
        prev.map((e) => (e.id === updated.id ? { ...updated, horse } : e)),
      )
      setEditing(null)
    } catch (err) {
      setEditError((err as Error).message)
    } finally {
      setEditSaving(false)
    }
  }

  async function handleDelete() {
    if (!editing) return
    if (!window.confirm(t('calendarView.deleteConfirm'))) return
    await deleteHorseEvent(editing.id)
    setEvents((prev) => prev.filter((e) => e.id !== editing.id))
    setEditing(null)
  }

  function shiftDate(amount: number) {
    const next = new Date(currentDate)
    if (mode === 'month') next.setMonth(next.getMonth() + amount)
    else if (mode === 'week') next.setDate(next.getDate() + amount * 7)
    else next.setDate(next.getDate() + amount)
    setCurrentDate(next)
  }

  const monthLabel = currentDate.toLocaleString(undefined, {
    month: 'long',
    year: 'numeric',
  })

  const dayEventsForModal = dayModalDate
    ? myDutiesOnly
      ? []
      : events
          .filter(
            (event) => toIsoDate(new Date(event.start_time)) === dayModalDate,
          )
          .sort((a, b) => a.start_time.localeCompare(b.start_time))
    : []

  const dayShiftsForModal = dayModalDate ? feedingShiftsOn(dayModalDate) : []

  function renderMonthGrid() {
    const start = startOfMonth(currentDate)
    const end = endOfMonth(currentDate)
    const leading = (start.getDay() + 6) % 7
    const days: (Date | null)[] = []
    for (let i = 0; i < leading; i += 1) days.push(null)
    for (let day = 1; day <= end.getDate(); day += 1)
      days.push(
        new Date(currentDate.getFullYear(), currentDate.getMonth(), day),
      )
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

    return (
      <div className="grid grid-cols-7 gap-2">
        {weekdayLabels.map((label) => (
          <p
            key={label}
            className="px-1 text-xs font-semibold text-slate-400 uppercase tracking-wide"
          >
            {label}
          </p>
        ))}
        {days.map((day, index) => {
          if (!day)
            return (
              <div key={index} className="min-h-24 rounded-2xl bg-white/50" />
            )
          const iso = toIsoDate(day)
          const dayEvents = myDutiesOnly
            ? []
            : events
                .filter(
                  (event) => toIsoDate(new Date(event.start_time)) === iso,
                )
                .sort((a, b) => a.start_time.localeCompare(b.start_time))
          const dayShifts = feedingShiftsOn(iso)
          const totalCount = dayEvents.length + dayShifts.length
          return (
            <button
              key={iso}
              type="button"
              onClick={() => setDayModalDate(iso)}
              className="min-h-24 rounded-2xl border border-slate-200 bg-card p-2 text-left hover:border-forest/30"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-900">
                  {day.getDate()}
                </p>
                {totalCount > 0 && (
                  <span className="text-xs text-slate-400">{totalCount}</span>
                )}
              </div>
              <div className="mt-1 space-y-1">
                {dayShifts.slice(0, 3).map((shift) => (
                  <div
                    key={shift.id}
                    className="flex items-center gap-1 truncate text-xs text-slate-600"
                  >
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: FEEDING_SHIFT_COLOR }}
                    />
                    <span className="truncate">
                      {shift.shift_type?.label ?? '—'}
                    </span>
                  </div>
                ))}
                {dayEvents.slice(0, 3 - dayShifts.length).map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center gap-1 truncate text-xs text-slate-600"
                  >
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: EVENT_COLORS[event.event_type] }}
                    />
                    <span className="truncate">{event.title}</span>
                  </div>
                ))}
              </div>
            </button>
          )
        })}
      </div>
    )
  }

  function renderAgenda() {
    if (visibleEvents.length === 0 && visibleFeedingShifts.length === 0)
      return (
        <div className="panel p-10 text-center text-sm text-slate-500">
          {t('calendarView.noEventsRange')}
        </div>
      )
    return (
      <div className="space-y-3">
        {visibleFeedingShifts.map((shift) => (
          <div
            key={shift.id}
            role="button"
            tabIndex={0}
            onClick={() => setFeedingDetail(shift)}
            className="panel flex w-full cursor-pointer items-start justify-between gap-4 p-4 text-left"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ background: FEEDING_SHIFT_COLOR }}
                />
                <p className="min-w-0 font-medium wrap-break-word text-slate-900">
                  {shift.shift_type?.label ?? '—'}
                </p>
                {shift.completed_at ? (
                  <Badge
                    status="active"
                    label={t('feedingRota.markCompleted')}
                  />
                ) : (
                  <Badge
                    status="pending"
                    label={t('feedingRota.notConfirmed')}
                  />
                )}
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {shift.assigned_owner?.full_name ??
                  t('feedingRota.unassignedOption')}
              </p>
            </div>
            <p className="shrink-0 whitespace-nowrap text-sm text-slate-500">
              {formatDate(shift.date)}
            </p>
          </div>
        ))}
        {visibleEvents.map((event) => (
          <div
            key={event.id}
            role={canManage ? 'button' : undefined}
            tabIndex={canManage ? 0 : undefined}
            onClick={canManage ? () => openEdit(event) : undefined}
            className={`panel flex w-full items-start justify-between gap-4 p-4 text-left ${
              canManage ? 'cursor-pointer' : ''
            }`}
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ background: EVENT_COLORS[event.event_type] }}
                />
                <p className="min-w-0 font-medium wrap-break-word text-slate-900">
                  {event.title}
                </p>
                <Badge status={event.event_type} />
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {event.horse?.name ?? t('calendarView.stableEventFallback')}
              </p>
            </div>
            <p className="shrink-0 whitespace-nowrap text-sm text-slate-500">
              {formatDate(event.start_time)}
            </p>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">
            {t('calendarView.title')}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {t('calendarView.subtitle')}
          </p>
        </div>
        {canManage ? (
          <button
            type="button"
            className="btn-primary"
            onClick={() => openAdd(currentDate)}
          >
            <Icon name="plus" className="h-4 w-4" />
            {t('calendarView.addEvent')}
          </button>
        ) : (
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={myDutiesOnly}
              onChange={(e) => setMyDutiesOnly(e.target.checked)}
            />
            {t('feedingRota.myFilterOnly')}
          </label>
        )}
      </div>

      {loading && (
        <p className="text-sm text-slate-500">{t('calendarView.loading')}</p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {t('calendarView.failedToLoad', { error })}
        </p>
      )}

      {!loading && !error && (
        <>
          <div className="panel p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex gap-2">
                <button
                  type="button"
                  aria-label={t('common.previous')}
                  className="btn-ghost px-3 py-2"
                  onClick={() => shiftDate(-1)}
                >
                  <Icon name="chevronLeft" className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label={t('common.next')}
                  className="btn-ghost px-3 py-2"
                  onClick={() => shiftDate(1)}
                >
                  <Icon name="chevronRight" className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="btn-ghost px-3 py-2"
                  onClick={() => setCurrentDate(new Date())}
                >
                  {t('calendarView.today')}
                </button>
              </div>
              <h2 className="text-xl font-semibold text-slate-900">
                {mode === 'month'
                  ? monthLabel
                  : `${formatDate(toIsoDate(range.start))} – ${formatDate(toIsoDate(range.end))}`}
              </h2>
              <div className="flex gap-2">
                {(['month', 'week', 'day'] as ViewMode[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setMode(item)}
                    className={`rounded-xl px-4 py-2 text-sm font-medium ${
                      mode === item
                        ? 'bg-primary text-white'
                        : 'bg-card text-slate-600'
                    }`}
                  >
                    {t(
                      `calendarView.mode${item.charAt(0).toUpperCase()}${item.slice(1)}`,
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="panel p-5">
            <div className="mb-4 flex flex-wrap gap-3 text-sm text-slate-500">
              {EVENT_TYPES.map((type) => (
                <div key={type} className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ background: EVENT_COLORS[type] }}
                  />
                  {t(`status.${type}`)}
                </div>
              ))}
            </div>
            {mode === 'month' ? renderMonthGrid() : renderAgenda()}
          </div>
        </>
      )}

      <Modal
        open={dayModalDate !== null}
        onClose={() => setDayModalDate(null)}
        title={dayModalDate ? formatDate(dayModalDate) : ''}
      >
        {dayEventsForModal.length === 0 && dayShiftsForModal.length === 0 ? (
          <p className="text-sm text-slate-500">
            {t('calendarView.noEventsDay')}
          </p>
        ) : (
          <div className="space-y-3">
            {dayShiftsForModal.map((shift) => (
              <div
                key={shift.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setDayModalDate(null)
                  setFeedingDetail(shift)
                }}
                className="flex w-full cursor-pointer items-start gap-3 rounded-2xl border border-slate-100 p-3 text-left hover:bg-slate-50"
              >
                <span
                  className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: FEEDING_SHIFT_COLOR }}
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-900">
                      {shift.shift_type?.label ?? '—'}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {shift.shift_type?.time_of_day?.slice(0, 5)}
                    {shift.assigned_owner?.full_name
                      ? ` · ${shift.assigned_owner.full_name}`
                      : ''}
                  </p>
                </div>
              </div>
            ))}
            {dayEventsForModal.map((event) => (
              <div
                key={event.id}
                role={canManage ? 'button' : undefined}
                tabIndex={canManage ? 0 : undefined}
                onClick={
                  canManage
                    ? () => {
                        setDayModalDate(null)
                        openEdit(event)
                      }
                    : undefined
                }
                className={`flex w-full items-start gap-3 rounded-2xl border border-slate-100 p-3 text-left ${
                  canManage ? 'cursor-pointer hover:bg-slate-50' : ''
                }`}
              >
                <span
                  className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: EVENT_COLORS[event.event_type] }}
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-900">{event.title}</p>
                    <Badge status={event.event_type} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {new Date(event.start_time).toLocaleTimeString(undefined, {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {event.horse?.name ? ` · ${event.horse.name}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={t('calendarView.addModalTitle')}
      >
        <form onSubmit={handleAddSubmit} className="grid gap-4">
          {addError && (
            <p role="alert" className="text-sm text-red-600">
              {addError}
            </p>
          )}
          <EventFields
            form={addForm}
            horses={horses}
            onChange={updateAddField}
          />
          <button type="submit" disabled={addSaving} className="btn-primary">
            {addSaving ? t('common.saving') : t('calendarView.save')}
          </button>
        </form>
      </Modal>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.title ?? ''}
      >
        <form onSubmit={handleEditSubmit} className="grid gap-4">
          {editError && (
            <p role="alert" className="text-sm text-red-600">
              {editError}
            </p>
          )}
          <EventFields
            form={editForm}
            horses={horses}
            onChange={updateEditField}
          />
          <button type="submit" disabled={editSaving} className="btn-primary">
            {editSaving ? t('common.saving') : t('common.save')}
          </button>
        </form>
        <button type="button" className="btn-ghost mt-4" onClick={handleDelete}>
          {t('common.delete')}
        </button>
      </Modal>

      <Modal
        open={feedingDetail !== null}
        onClose={() => setFeedingDetail(null)}
        title={feedingDetail?.shift_type?.label ?? ''}
      >
        {feedingDetail && (
          <div className="space-y-3 text-sm">
            <p className="text-slate-700">
              {formatDate(feedingDetail.date)} ·{' '}
              {feedingDetail.shift_type?.time_of_day?.slice(0, 5)}
            </p>
            <ShiftFeedingInfo shift={feedingDetail} />
            <p className="text-slate-700">
              {feedingDetail.assigned_owner?.full_name ??
                t('feedingRota.unassignedOption')}
            </p>
            <p className="text-slate-500">
              {feedingDetail.completed_at
                ? t('feedingRota.completedBy', {
                    name: feedingDetail.assigned_owner?.full_name ?? '—',
                  })
                : t('feedingRota.notConfirmed')}
            </p>
            {(feedingDetail.let_out_at || feedingDetail.let_in_at) && (
              <p className="flex flex-wrap gap-x-2 text-emerald-700">
                {feedingDetail.let_out_at && (
                  <span>
                    {t('feedingRota.letOutStatus', {
                      time: formatTime(feedingDetail.let_out_at),
                    })}
                  </span>
                )}
                {feedingDetail.let_in_at && (
                  <span>
                    {t('feedingRota.letInStatus', {
                      time: formatTime(feedingDetail.let_in_at),
                    })}
                  </span>
                )}
              </p>
            )}
            {canManage && (
              <label>
                <span className="field-label">{t('feedingRota.reassign')}</span>
                <select
                  className="field"
                  value={feedingDetail.assigned_owner_id ?? ''}
                  onChange={async (e) => {
                    const updated = await reassignShift(
                      feedingDetail.id,
                      e.target.value || null,
                    )
                    setFeedingShifts((prev) =>
                      prev.map((s) => (s.id === updated.id ? updated : s)),
                    )
                    setFeedingDetail(updated)
                  }}
                >
                  <option value="">{t('feedingRota.unassignedOption')}</option>
                  {owners.map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.full_name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
