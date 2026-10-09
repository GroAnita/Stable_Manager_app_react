import { useState, type FormEvent } from 'react'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Icon } from '../../components/Icon'
import { Modal } from '../../components/Modal'
import { StatusDot } from '../../components/StatusDot'
import {
  createVaccination,
  deleteVaccination,
  updateVaccination,
  type Vaccination,
} from '../../features/horses/api'
import {
  getAnnualBoosterStatus,
  getGrunnvaksineStatus,
  type VaccinationDose,
} from '../../lib/vaccinations'
import { usePreferences } from '../../lib/PreferencesContext'

type FormState = {
  date: string
  dose: VaccinationDose
  notes: string
}

function emptyForm(): FormState {
  return { date: new Date().toISOString().slice(0, 10), dose: 'A', notes: '' }
}

function toForm(record: Vaccination): FormState {
  return {
    date: record.date,
    dose: record.dose as VaccinationDose,
    notes: record.notes ?? '',
  }
}

function VaccinationFields({
  form,
  onChange,
}: {
  form: FormState
  onChange: <K extends keyof FormState>(key: K, value: FormState[K]) => void
}) {
  const { t } = usePreferences()
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label>
        <span className="field-label">{t('vaccinations.date')}</span>
        <input
          required
          type="date"
          className="field"
          value={form.date}
          onChange={(e) => onChange('date', e.target.value)}
        />
      </label>
      <label>
        <span className="field-label">{t('vaccinations.dose')}</span>
        <select
          className="field"
          value={form.dose}
          onChange={(e) => onChange('dose', e.target.value as VaccinationDose)}
        >
          <option value="A">{t('vaccinations.doseA')}</option>
          <option value="B">{t('vaccinations.doseB')}</option>
          <option value="C">{t('vaccinations.doseC')}</option>
          <option value="annual">{t('vaccinations.doseAnnual')}</option>
        </select>
      </label>
      <label className="sm:col-span-2">
        <span className="field-label">{t('vaccinations.notes')}</span>
        <textarea
          className="field"
          value={form.notes}
          onChange={(e) => onChange('notes', e.target.value)}
        />
      </label>
    </div>
  )
}

export function VaccinationSection({
  horseId,
  stableId,
  vaccinations,
  onChange,
}: {
  horseId: string
  stableId: string
  vaccinations: Vaccination[]
  onChange: (vaccinations: Vaccination[]) => void
}) {
  const { t, formatDate } = usePreferences()
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState<FormState>(emptyForm)
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const [editing, setEditing] = useState<Vaccination | null>(null)
  const [editForm, setEditForm] = useState<FormState>(emptyForm)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  const grunnvaksine = getGrunnvaksineStatus(vaccinations)
  const annual = getAnnualBoosterStatus(vaccinations, grunnvaksine)

  const grunnvaksineDot: 'green' | 'yellow' | 'red' | 'grey' =
    grunnvaksine.status === 'valid'
      ? 'green'
      : grunnvaksine.status === 'pending'
        ? 'green'
        : grunnvaksine.status === 'invalid'
          ? 'red'
          : 'grey'

  const grunnvaksineLabel =
    grunnvaksine.status === 'not_started'
      ? t('vaccinations.grunnvaksineNotStarted')
      : grunnvaksine.status === 'pending'
        ? t('vaccinations.grunnvaksinePending', {
            date: formatDate(grunnvaksine.deadline),
          })
        : grunnvaksine.status === 'valid'
          ? t('vaccinations.grunnvaksineValid')
          : t('vaccinations.grunnvaksineInvalid')

  const annualDot: 'green' | 'yellow' | 'red' | 'grey' =
    annual.status === 'not_applicable' ? 'grey' : annual.status

  const annualLabel =
    annual.status === 'not_applicable'
      ? t('vaccinations.annualNotApplicable')
      : annual.status === 'green'
        ? t('vaccinations.annualGreen', { date: formatDate(annual.dueDate) })
        : annual.status === 'yellow'
          ? t('vaccinations.annualYellow', { date: formatDate(annual.dueDate) })
          : t('vaccinations.annualRed', { date: formatDate(annual.dueDate) })

  function doseLabel(dose: string): string {
    switch (dose) {
      case 'A':
        return t('vaccinations.doseA')
      case 'B':
        return t('vaccinations.doseB')
      case 'C':
        return t('vaccinations.doseC')
      default:
        return t('vaccinations.doseAnnual')
    }
  }

  function updateAddField<K extends keyof FormState>(key: K, value: FormState[K]) {
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
      const created = await createVaccination({
        horse_id: horseId,
        stable_id: stableId,
        dose: addForm.dose,
        date: addForm.date,
        notes: addForm.notes || null,
      })
      onChange(
        [created, ...vaccinations].sort((a, b) => (a.date < b.date ? 1 : -1)),
      )
      setAddOpen(false)
    } catch (err) {
      setAddError((err as Error).message)
    } finally {
      setAddSaving(false)
    }
  }

  function openEdit(record: Vaccination) {
    setEditing(record)
    setEditForm(toForm(record))
    setEditError(null)
  }

  function updateEditField<K extends keyof FormState>(
    key: K,
    value: FormState[K],
  ) {
    setEditForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleEditSubmit(event: FormEvent) {
    event.preventDefault()
    if (!editing) return
    setEditSaving(true)
    setEditError(null)
    try {
      const updated = await updateVaccination(editing.id, {
        dose: editForm.dose,
        date: editForm.date,
        notes: editForm.notes || null,
      })
      onChange(
        vaccinations
          .map((v) => (v.id === updated.id ? updated : v))
          .sort((a, b) => (a.date < b.date ? 1 : -1)),
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
    await deleteVaccination(editing.id)
    onChange(vaccinations.filter((v) => v.id !== editing.id))
    setConfirmDeleteOpen(false)
    setEditing(null)
  }

  return (
    <div className="rounded-2xl border border-slate-100 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold text-slate-900">
          {t('vaccinations.title')}
        </h3>
        <button type="button" className="btn-primary" onClick={openAdd}>
          <Icon name="plus" className="h-4 w-4" />
          {t('vaccinations.add')}
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
          <StatusDot color={grunnvaksineDot} />
          <span className="font-medium text-slate-700">
            {t('vaccinations.grunnvaksine')}:
          </span>
          <span className="text-slate-600">{grunnvaksineLabel}</span>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
          <StatusDot color={annualDot} />
          <span className="font-medium text-slate-700">
            {t('vaccinations.annualVaccine')}:
          </span>
          <span className="text-slate-600">{annualLabel}</span>
        </div>
      </div>

      {vaccinations.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          {t('vaccinations.noVaccinations')}
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {vaccinations.map((record) => (
            <button
              key={record.id}
              type="button"
              onClick={() => openEdit(record)}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-100 px-4 py-2.5 text-left text-sm hover:bg-slate-50"
            >
              <span className="font-medium text-slate-800">
                {doseLabel(record.dose)}
              </span>
              <span className="text-slate-500">{formatDate(record.date)}</span>
            </button>
          ))}
        </div>
      )}

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={t('vaccinations.add')}
      >
        <form onSubmit={handleAddSubmit} className="grid gap-4">
          {addError && (
            <p role="alert" className="text-sm text-red-600">
              {addError}
            </p>
          )}
          <VaccinationFields form={addForm} onChange={updateAddField} />
          <button type="submit" disabled={addSaving} className="btn-primary">
            {addSaving ? t('common.saving') : t('common.add')}
          </button>
        </form>
      </Modal>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={t('vaccinations.edit')}
      >
        <form onSubmit={handleEditSubmit} className="grid gap-4">
          {editError && (
            <p role="alert" className="text-sm text-red-600">
              {editError}
            </p>
          )}
          <VaccinationFields form={editForm} onChange={updateEditField} />
          <button type="submit" disabled={editSaving} className="btn-primary">
            {editSaving ? t('common.saving') : t('common.save')}
          </button>
        </form>
        <button
          type="button"
          className="btn-ghost mt-4"
          onClick={() => setConfirmDeleteOpen(true)}
        >
          {t('common.delete')}
        </button>
      </Modal>

      <ConfirmDialog
        open={confirmDeleteOpen}
        title={t('vaccinations.edit')}
        message={t('vaccinations.deleteConfirm')}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </div>
  )
}
