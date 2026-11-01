import { useEffect, useState, type FormEvent } from 'react'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { EmptyState } from '../../components/EmptyState'
import { Icon } from '../../components/Icon'
import { Modal } from '../../components/Modal'
import {
  cancelBooking,
  cancelSession,
  createStandaloneSession,
  listUpcomingStandaloneSessions,
  type LessonSessionWithBookings,
} from '../../features/lessons/api'
import { getCurrentStableId } from '../../lib/stableContext'
import { usePreferences } from '../../lib/PreferencesContext'

type LessonFormState = {
  title: string
  instructor_name: string
  starts_at: string
  ends_at: string
  capacity: string
  notes: string
}

function emptyForm(): LessonFormState {
  return {
    title: '',
    instructor_name: '',
    starts_at: '',
    ends_at: '',
    capacity: '4',
    notes: '',
  }
}

export function SchedulePanel() {
  const { t, formatDate, formatTime } = usePreferences()
  const [sessions, setSessions] = useState<LessonSessionWithBookings[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState<LessonFormState>(emptyForm)
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  function load() {
    setLoading(true)
    listUpcomingStandaloneSessions()
      .then(setSessions)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  function openAdd() {
    setAddForm(emptyForm())
    setAddError(null)
    setAddOpen(true)
  }

  function updateAddField<K extends keyof LessonFormState>(
    key: K,
    value: LessonFormState[K],
  ) {
    setAddForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleAddSubmit(event: FormEvent) {
    event.preventDefault()
    setAddSaving(true)
    setAddError(null)
    try {
      const stableId = await getCurrentStableId()
      if (!stableId) throw new Error(t('lessons.noStableFound'))
      const created = await createStandaloneSession({
        stable_id: stableId,
        title: addForm.title,
        instructor_name: addForm.instructor_name || null,
        starts_at: new Date(addForm.starts_at).toISOString(),
        ends_at: new Date(addForm.ends_at).toISOString(),
        capacity: Number(addForm.capacity) || 1,
        notes: addForm.notes || null,
      })
      setAddOpen(false)
      load()
      setSelectedId(created.id)
    } catch (err) {
      setAddError((err as Error).message)
    } finally {
      setAddSaving(false)
    }
  }

  function updateSession(updated: LessonSessionWithBookings) {
    setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
  }

  function removeSessionFromList(id: string) {
    setSessions((prev) => prev.filter((s) => s.id !== id))
    setSelectedId(null)
  }

  const selected = sessions.find((s) => s.id === selectedId) ?? null

  if (selected) {
    return (
      <SessionDetailView
        session={selected}
        onBack={() => setSelectedId(null)}
        onUpdate={updateSession}
        onCancelled={() => removeSessionFromList(selected.id)}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <button type="button" className="btn-primary" onClick={openAdd}>
          <Icon name="plus" className="h-4 w-4" />
          {t('lessons.addLesson')}
        </button>
      </div>

      {loading && <p className="text-sm text-slate-500">{t('lessons.loading')}</p>}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {!loading && !error && sessions.length === 0 && (
        <EmptyState
          title={t('lessons.noLessonsTitle')}
          message={t('lessons.noLessonsMessage')}
        />
      )}

      {!loading && !error && sessions.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sessions.map((session) => {
            const confirmedCount = session.bookings.filter(
              (b) => b.status === 'confirmed',
            ).length
            return (
              <button
                key={session.id}
                type="button"
                onClick={() => setSelectedId(session.id)}
                className="panel flex flex-col gap-2 p-5 text-left transition hover:-translate-y-0.5"
              >
                <p className="font-medium text-slate-900">{session.title}</p>
                <p className="text-sm text-slate-500">
                  {formatDate(session.starts_at)} ·{' '}
                  {formatTime(session.starts_at)}–{formatTime(session.ends_at)}
                </p>
                <span className="self-start rounded-full bg-forest/10 px-3 py-1 text-xs font-medium text-forest">
                  {t('lessons.spotsBooked', {
                    booked: confirmedCount,
                    capacity: session.capacity,
                  })}
                </span>
              </button>
            )
          })}
        </div>
      )}

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={t('lessons.addModalTitle')}
      >
        <form onSubmit={handleAddSubmit} className="grid gap-4">
          {addError && (
            <p role="alert" className="text-sm text-red-600">
              {addError}
            </p>
          )}
          <label>
            <span className="field-label">{t('lessons.lessonTitle')}</span>
            <input
              required
              className="field"
              value={addForm.title}
              onChange={(e) => updateAddField('title', e.target.value)}
            />
          </label>
          <label>
            <span className="field-label">{t('lessons.instructor')}</span>
            <input
              className="field"
              value={addForm.instructor_name}
              onChange={(e) =>
                updateAddField('instructor_name', e.target.value)
              }
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="field-label">{t('lessons.startsAt')}</span>
              <input
                required
                type="datetime-local"
                className="field"
                value={addForm.starts_at}
                onChange={(e) => updateAddField('starts_at', e.target.value)}
              />
            </label>
            <label>
              <span className="field-label">{t('lessons.endsAt')}</span>
              <input
                required
                type="datetime-local"
                className="field"
                value={addForm.ends_at}
                onChange={(e) => updateAddField('ends_at', e.target.value)}
              />
            </label>
          </div>
          <label>
            <span className="field-label">{t('lessons.capacity')}</span>
            <input
              required
              type="number"
              min={1}
              className="field"
              value={addForm.capacity}
              onChange={(e) => updateAddField('capacity', e.target.value)}
            />
          </label>
          <label>
            <span className="field-label">{t('lessons.notes')}</span>
            <textarea
              className="field"
              value={addForm.notes}
              onChange={(e) => updateAddField('notes', e.target.value)}
            />
          </label>
          <button type="submit" disabled={addSaving} className="btn-primary">
            {addSaving ? t('common.saving') : t('lessons.save')}
          </button>
        </form>
      </Modal>
    </div>
  )
}

function SessionDetailView({
  session,
  onBack,
  onUpdate,
  onCancelled,
}: {
  session: LessonSessionWithBookings
  onBack: () => void
  onUpdate: (session: LessonSessionWithBookings) => void
  onCancelled: () => void
}) {
  const { t, formatDate, formatTime } = usePreferences()
  const [cancelOpen, setCancelOpen] = useState(false)

  // Standalone lessons never have enrolment-generated bookings (only a
  // course's sessions do), so this roster is never split term/drop-in.
  const confirmedBookings = session.bookings.filter((b) => b.status === 'confirmed')

  async function removeBooking(bookingId: string) {
    await cancelBooking(bookingId)
    onUpdate({
      ...session,
      bookings: session.bookings.map((b) =>
        b.id === bookingId ? { ...b, status: 'cancelled' } : b,
      ),
    })
  }

  async function confirmCancelSession() {
    await cancelSession(session.id)
    setCancelOpen(false)
    onCancelled()
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 text-sm font-medium text-ink/70 hover:text-forest"
      >
        <Icon name="chevronLeft" className="h-4 w-4" />
        {t('lessons.backToSchedule')}
      </button>

      <div className="panel p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="section-title">{session.title}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {[
                formatDate(session.starts_at),
                `${formatTime(session.starts_at)}–${formatTime(session.ends_at)}`,
                session.instructor_name,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {session.notes && (
              <p className="mt-1 text-sm text-slate-500">{session.notes}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-forest/10 px-3 py-1 text-xs font-medium text-forest">
              {t('lessons.spotsBooked', {
                booked: confirmedBookings.length,
                capacity: session.capacity,
              })}
            </span>
            <button type="button" className="btn-ghost" onClick={() => setCancelOpen(true)}>
              {t('lessons.deleteLessonTitle')}
            </button>
          </div>
        </div>

        {confirmedBookings.length === 0 ? (
          <p className="mt-6 text-sm text-slate-500">{t('lessons.noBookingsYet')}</p>
        ) : (
          <div className="mt-6 flex flex-col gap-2 border-t border-slate-100 pt-4">
            {confirmedBookings.map((booking) => (
              <BookingRow key={booking.id} booking={booking} onRemove={removeBooking} />
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={cancelOpen}
        title={t('lessons.deleteLessonTitle')}
        message={t('lessons.confirmDelete')}
        onConfirm={confirmCancelSession}
        onCancel={() => setCancelOpen(false)}
      />
    </div>
  )
}

function BookingRow({
  booking,
  onRemove,
}: {
  booking: LessonSessionWithBookings['bookings'][number]
  onRemove: (bookingId: string) => void
}) {
  const { t } = usePreferences()
  const who = booking.rider?.full_name ?? booking.owner?.full_name ?? '—'
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-700">
        {who} · {booking.horse?.name ?? t('lessons.noHorseAssigned')}
      </span>
      <button
        type="button"
        className="text-xs font-medium text-red-600 hover:underline"
        onClick={() => onRemove(booking.id)}
      >
        {t('lessons.removeBooking')}
      </button>
    </div>
  )
}
