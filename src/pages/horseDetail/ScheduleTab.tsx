import { useState, type FormEvent } from 'react'
import { Badge } from '../../components/Badge'
import { Icon } from '../../components/Icon'
import { Modal } from '../../components/Modal'
import {
  createHorseEvent,
  deleteHorseEvent,
  updateHorseEvent,
  type HorseEvent,
} from '../../features/horses/api'
import { usePreferences } from '../../lib/PreferencesContext'
import type { Database } from '../../types/supabase'

type EventType = Database['public']['Enums']['calendar_event_type']

const EVENT_TYPES: EventType[] = [
  'vet',
  'farrier',
  'vaccination',
  'worming',
  'training',
  'stable_event',
  'arena_booking',
]

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
  start_time: string
  end_time: string
  description: string
}

function emptyForm(): EventFormState {
  return {
    title: '',
    event_type: 'vet',
    start_time: '',
    end_time: '',
    description: '',
  }
}

function toForm(event: HorseEvent): EventFormState {
  return {
    title: event.title,
    event_type: event.event_type,
    start_time: toDatetimeLocal(event.start_time),
    end_time: toDatetimeLocal(event.end_time),
    description: event.description ?? '',
  }
}

function EventFields({
  form,
  onChange,
}: {
  form: EventFormState
  onChange: <K extends keyof EventFormState>(
    key: K,
    value: EventFormState[K],
  ) => void
}) {
  const { t } = usePreferences()
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="sm:col-span-2">
        <span className="field-label">{t('horseDetail.eventTitle')}</span>
        <input
          required
          className="field"
          value={form.title}
          onChange={(e) => onChange('title', e.target.value)}
        />
      </label>
      <label>
        <span className="field-label">{t('horseDetail.eventType')}</span>
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
      <div />
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

export function ScheduleTab({
  horseId,
  stableId,
  events,
  onChange,
}: {
  horseId: string
  stableId: string
  events: HorseEvent[]
  onChange: (events: HorseEvent[]) => void
}) {
  const { t, formatDate } = usePreferences()
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState<EventFormState>(emptyForm)
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const [editing, setEditing] = useState<HorseEvent | null>(null)
  const [editForm, setEditForm] = useState<EventFormState>(emptyForm)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  function updateAddField<K extends keyof EventFormState>(
    key: K,
    value: EventFormState[K],
  ) {
    setAddForm((prev) => ({ ...prev, [key]: value }))
  }

  function openAdd() {
    setAddForm(emptyForm())
    setAddError(null)
    setAddOpen(true)
  }

  async function handleAddSubmit(event: FormEvent) {
    event.preventDefault()
    const startTime = fromDatetimeLocal(addForm.start_time)
    if (!startTime) return
    setAddSaving(true)
    setAddError(null)
    try {
      const created = await createHorseEvent({
        horse_id: horseId,
        stable_id: stableId,
        title: addForm.title,
        event_type: addForm.event_type,
        start_time: startTime,
        end_time: fromDatetimeLocal(addForm.end_time),
        description: addForm.description || null,
      })
      onChange(
        [...events, created].sort((a, b) =>
          a.start_time < b.start_time ? -1 : 1,
        ),
      )
      setAddOpen(false)
    } catch (err) {
      setAddError((err as Error).message)
    } finally {
      setAddSaving(false)
    }
  }

  function openEdit(event: HorseEvent) {
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
        title: editForm.title,
        event_type: editForm.event_type,
        start_time: startTime,
        end_time: fromDatetimeLocal(editForm.end_time),
        description: editForm.description || null,
      })
      onChange(events.map((e) => (e.id === updated.id ? updated : e)))
      setEditing(null)
    } catch (err) {
      setEditError((err as Error).message)
    } finally {
      setEditSaving(false)
    }
  }

  async function handleDelete() {
    if (!editing) return
    if (!window.confirm(t('horseDetail.deleteEventConfirm'))) return
    await deleteHorseEvent(editing.id)
    onChange(events.filter((e) => e.id !== editing.id))
    setEditing(null)
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button type="button" className="btn-primary" onClick={openAdd}>
          <Icon name="plus" className="h-4 w-4" />
          {t('horseDetail.addEvent')}
        </button>
      </div>

      {events.length === 0 ? (
        <p className="text-sm text-slate-500">
          {t('horseDetail.noAppointments')}
        </p>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={() => openEdit(event)}
              className="w-full rounded-2xl bg-slate-50 px-4 py-3 text-left hover:bg-slate-100"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="min-w-0 font-medium wrap-break-word text-slate-900">
                  {event.title}
                </p>
                <Badge status={event.event_type} />
              </div>
              <p className="mt-2 text-sm text-slate-500">
                {formatDate(event.start_time)}
              </p>
              {event.description && (
                <p className="mt-1 text-sm text-slate-500">
                  {event.description}
                </p>
              )}
            </button>
          ))}
        </div>
      )}

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={t('horseDetail.addEvent')}
      >
        <form onSubmit={handleAddSubmit} className="grid gap-4">
          {addError && (
            <p role="alert" className="text-sm text-red-600">
              {addError}
            </p>
          )}
          <EventFields form={addForm} onChange={updateAddField} />
          <button type="submit" disabled={addSaving} className="btn-primary">
            {addSaving ? t('common.saving') : t('common.add')}
          </button>
        </form>
      </Modal>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={t('horseDetail.editEvent')}
      >
        <form onSubmit={handleEditSubmit} className="grid gap-4">
          {editError && (
            <p role="alert" className="text-sm text-red-600">
              {editError}
            </p>
          )}
          <EventFields form={editForm} onChange={updateEditField} />
          <button type="submit" disabled={editSaving} className="btn-primary">
            {editSaving ? t('common.saving') : t('common.save')}
          </button>
        </form>
        <button type="button" className="btn-ghost mt-4" onClick={handleDelete}>
          {t('common.delete')}
        </button>
      </Modal>
    </div>
  )
}
