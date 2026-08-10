import { useState, type FormEvent } from 'react'
import { Badge } from '../../components/Badge'
import { Icon } from '../../components/Icon'
import { Modal } from '../../components/Modal'
import {
  createMedicalRecord,
  deleteMedicalRecord,
  updateMedicalRecord,
  type MedicalRecord,
} from '../../features/horses/api'
import { usePreferences } from '../../lib/PreferencesContext'

type MedicalFormState = {
  type: string
  date: string
  veterinarian: string
  description: string
  medication: string
  next_due: string
}

function emptyForm(): MedicalFormState {
  return {
    type: '',
    date: new Date().toISOString().slice(0, 10),
    veterinarian: '',
    description: '',
    medication: '',
    next_due: '',
  }
}

function toForm(record: MedicalRecord): MedicalFormState {
  return {
    type: record.type ?? '',
    date: record.date,
    veterinarian: record.veterinarian ?? '',
    description: record.description ?? '',
    medication: record.medication ?? '',
    next_due: record.next_due ?? '',
  }
}

function MedicalRecordFields({
  form,
  onChange,
}: {
  form: MedicalFormState
  onChange: <K extends keyof MedicalFormState>(
    key: K,
    value: MedicalFormState[K],
  ) => void
}) {
  const { t } = usePreferences()
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label>
        <span className="field-label">{t('horseDetail.recordType')}</span>
        <input
          required
          className="field"
          value={form.type}
          onChange={(e) => onChange('type', e.target.value)}
        />
      </label>
      <label>
        <span className="field-label">{t('horseDetail.recordDate')}</span>
        <input
          required
          type="date"
          className="field"
          value={form.date}
          onChange={(e) => onChange('date', e.target.value)}
        />
      </label>
      <label>
        <span className="field-label">{t('horseDetail.veterinarian')}</span>
        <input
          className="field"
          value={form.veterinarian}
          onChange={(e) => onChange('veterinarian', e.target.value)}
        />
      </label>
      <label>
        <span className="field-label">{t('horseDetail.nextDueDate')}</span>
        <input
          type="date"
          className="field"
          value={form.next_due}
          onChange={(e) => onChange('next_due', e.target.value)}
        />
      </label>
      <label>
        <span className="field-label">{t('horseDetail.medication')}</span>
        <input
          className="field"
          value={form.medication}
          onChange={(e) => onChange('medication', e.target.value)}
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

export function MedicalTab({
  horseId,
  stableId,
  records,
  onChange,
}: {
  horseId: string
  stableId: string
  records: MedicalRecord[]
  onChange: (records: MedicalRecord[]) => void
}) {
  const { t, formatDate } = usePreferences()
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState<MedicalFormState>(emptyForm)
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const [editing, setEditing] = useState<MedicalRecord | null>(null)
  const [editForm, setEditForm] = useState<MedicalFormState>(emptyForm)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  function updateAddField<K extends keyof MedicalFormState>(
    key: K,
    value: MedicalFormState[K],
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
    setAddSaving(true)
    setAddError(null)
    try {
      const created = await createMedicalRecord({
        horse_id: horseId,
        stable_id: stableId,
        type: addForm.type || null,
        date: addForm.date,
        veterinarian: addForm.veterinarian || null,
        description: addForm.description || null,
        medication: addForm.medication || null,
        next_due: addForm.next_due || null,
      })
      onChange([created, ...records].sort((a, b) => (a.date < b.date ? 1 : -1)))
      setAddOpen(false)
    } catch (err) {
      setAddError((err as Error).message)
    } finally {
      setAddSaving(false)
    }
  }

  function openEdit(record: MedicalRecord) {
    setEditing(record)
    setEditForm(toForm(record))
    setEditError(null)
  }

  function updateEditField<K extends keyof MedicalFormState>(
    key: K,
    value: MedicalFormState[K],
  ) {
    setEditForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleEditSubmit(event: FormEvent) {
    event.preventDefault()
    if (!editing) return
    setEditSaving(true)
    setEditError(null)
    try {
      const updated = await updateMedicalRecord(editing.id, {
        type: editForm.type || null,
        date: editForm.date,
        veterinarian: editForm.veterinarian || null,
        description: editForm.description || null,
        medication: editForm.medication || null,
        next_due: editForm.next_due || null,
      })
      onChange(records.map((r) => (r.id === updated.id ? updated : r)))
      setEditing(null)
    } catch (err) {
      setEditError((err as Error).message)
    } finally {
      setEditSaving(false)
    }
  }

  async function handleDelete() {
    if (!editing) return
    if (!window.confirm(t('horseDetail.deleteRecordConfirm'))) return
    await deleteMedicalRecord(editing.id)
    onChange(records.filter((r) => r.id !== editing.id))
    setEditing(null)
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button type="button" className="btn-primary" onClick={openAdd}>
          <Icon name="plus" className="h-4 w-4" />
          {t('horseDetail.addRecord')}
        </button>
      </div>

      {records.length === 0 ? (
        <p className="text-sm text-slate-500">
          {t('horseDetail.noMedicalRecords')}
        </p>
      ) : (
        <div className="space-y-4">
          {records.map((record) => (
            <button
              key={record.id}
              type="button"
              onClick={() => openEdit(record)}
              className="w-full rounded-2xl border border-slate-100 p-4 text-left hover:bg-slate-50"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="min-w-0 font-medium wrap-break-word text-slate-900">
                  {record.type ?? '—'}
                </p>
                {record.type && <Badge status={record.type} />}
              </div>
              {record.description && (
                <p className="mt-2 text-sm text-slate-500">
                  {record.description}
                </p>
              )}
              <p className="mt-3 text-sm text-slate-500">
                {formatDate(record.date)}
                {record.next_due &&
                  ` · ${t('horseDetail.nextDue')} ${formatDate(record.next_due)}`}
                {record.veterinarian && ` · ${record.veterinarian}`}
              </p>
            </button>
          ))}
        </div>
      )}

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={t('horseDetail.addRecord')}
      >
        <form onSubmit={handleAddSubmit} className="grid gap-4">
          {addError && (
            <p role="alert" className="text-sm text-red-600">
              {addError}
            </p>
          )}
          <MedicalRecordFields form={addForm} onChange={updateAddField} />
          <button type="submit" disabled={addSaving} className="btn-primary">
            {addSaving ? t('common.saving') : t('common.add')}
          </button>
        </form>
      </Modal>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={t('horseDetail.editRecord')}
      >
        <form onSubmit={handleEditSubmit} className="grid gap-4">
          {editError && (
            <p role="alert" className="text-sm text-red-600">
              {editError}
            </p>
          )}
          <MedicalRecordFields form={editForm} onChange={updateEditField} />
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
