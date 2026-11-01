import { useEffect, useState, type FormEvent } from 'react'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { EmptyState } from '../../components/EmptyState'
import { Icon } from '../../components/Icon'
import { Modal } from '../../components/Modal'
import {
  cancelLessonBooking,
  createLesson,
  deleteLesson,
  listUpcomingLessons,
  type LessonWithBookings,
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
  const [lessons, setLessons] = useState<LessonWithBookings[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState<LessonFormState>(emptyForm)
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<LessonWithBookings | null>(
    null,
  )

  function load() {
    setLoading(true)
    listUpcomingLessons()
      .then(setLessons)
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
      await createLesson({
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
    } catch (err) {
      setAddError((err as Error).message)
    } finally {
      setAddSaving(false)
    }
  }

  async function confirmDeleteLesson() {
    if (!deleteTarget) return
    await deleteLesson(deleteTarget.id)
    setLessons((prev) => prev.filter((l) => l.id !== deleteTarget.id))
    setDeleteTarget(null)
  }

  async function removeBooking(bookingId: string) {
    await cancelLessonBooking(bookingId)
    setLessons((prev) =>
      prev.map((lesson) => ({
        ...lesson,
        bookings: lesson.bookings.filter((b) => b.id !== bookingId),
      })),
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
      {!loading && !error && lessons.length === 0 && (
        <EmptyState
          title={t('lessons.noLessonsTitle')}
          message={t('lessons.noLessonsMessage')}
        />
      )}

      {!loading && !error && lessons.length > 0 && (
        <div className="space-y-3">
          {lessons.map((lesson) => (
            <div key={lesson.id} className="panel p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
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
                  {lesson.notes && (
                    <p className="mt-1 text-sm text-slate-500">{lesson.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-forest/10 px-3 py-1 text-xs font-medium text-forest">
                    {t('lessons.spotsBooked', {
                      booked: lesson.bookings.length,
                      capacity: lesson.capacity,
                    })}
                  </span>
                  <button
                    type="button"
                    aria-label={`${t('common.delete')}: ${lesson.title}`}
                    onClick={() => setDeleteTarget(lesson)}
                    className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  >
                    <Icon name="trash" className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {lesson.bookings.length > 0 && (
                <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-3">
                  {lesson.bookings.map((booking) => (
                    <div
                      key={booking.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-slate-700">
                        {booking.owner?.full_name} · {booking.horse?.name}
                      </span>
                      <button
                        type="button"
                        className="text-xs font-medium text-red-600 hover:underline"
                        onClick={() => removeBooking(booking.id)}
                      >
                        {t('lessons.removeBooking')}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
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

      <ConfirmDialog
        open={deleteTarget !== null}
        title={t('lessons.deleteLessonTitle')}
        message={t('lessons.confirmDelete')}
        onConfirm={confirmDeleteLesson}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
