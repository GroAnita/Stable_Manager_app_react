import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { Modal } from '../../components/Modal'
import { listShiftTypes, type ShiftType } from '../../features/feedingRota/api'
import {
  createFeedingTime,
  deleteFeedingTime,
  updateFeedingTime,
  upsertFeedingPlan,
  type FeedingPlan,
  type FeedingTime,
} from '../../features/horses/api'
import { usePreferences } from '../../lib/PreferencesContext'
import { FeedingExtras } from './FeedingExtras'

type FeedingTimeFormState = {
  feeding_shift_type_id: string
  hay: string
  feed: string
  supplements: string
}

function emptyTimeForm(): FeedingTimeFormState {
  return { feeding_shift_type_id: '', hay: '', feed: '', supplements: '' }
}

// An entry edited before the stable routine existed has no
// feeding_shift_type_id — best-effort match it to a shift type by label so
// editing it doesn't start from a blank selection, but don't force it.
function toTimeForm(entry: FeedingTime, shiftTypes: ShiftType[]): FeedingTimeFormState {
  const matched =
    entry.feeding_shift_type_id ??
    shiftTypes.find((st) => st.label === entry.label)?.id ??
    ''
  return {
    feeding_shift_type_id: matched,
    hay: entry.hay ?? '',
    feed: entry.feed ?? '',
    supplements: entry.supplements ?? '',
  }
}

function sortFeedingTimes(times: FeedingTime[]): FeedingTime[] {
  return [...times].sort((a, b) => {
    if (a.time_of_day && b.time_of_day)
      return a.time_of_day.localeCompare(b.time_of_day)
    if (a.time_of_day) return -1
    if (b.time_of_day) return 1
    return a.created_at.localeCompare(b.created_at)
  })
}

function FeedingTimeFields({
  form,
  shiftTypes,
  onChange,
}: {
  form: FeedingTimeFormState
  shiftTypes: ShiftType[]
  onChange: <K extends keyof FeedingTimeFormState>(
    key: K,
    value: FeedingTimeFormState[K],
  ) => void
}) {
  const { t } = usePreferences()
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="sm:col-span-2">
        <span className="field-label">{t('horseDetail.feedingTime')}</span>
        {shiftTypes.length === 0 ? (
          <p className="field flex items-center text-sm text-slate-400">
            {t('horseDetail.noShiftTypes')}
          </p>
        ) : (
          <select
            required
            className="field"
            value={form.feeding_shift_type_id}
            onChange={(e) => onChange('feeding_shift_type_id', e.target.value)}
          >
            <option value="">{t('horseDetail.selectFeedingTime')}</option>
            {shiftTypes.map((shiftType) => (
              <option key={shiftType.id} value={shiftType.id}>
                {shiftType.label} ({shiftType.time_of_day.slice(0, 5)})
              </option>
            ))}
          </select>
        )}
        {shiftTypes.length === 0 && (
          <Link
            to="/settings?section=stableRoutine"
            className="mt-1 block text-xs text-forest hover:underline"
          >
            {t('horseDetail.setUpStableRoutine')}
          </Link>
        )}
      </label>
      <label>
        <span className="field-label">{t('horseDetail.hay')}</span>
        <input
          className="field"
          value={form.hay}
          onChange={(e) => onChange('hay', e.target.value)}
        />
      </label>
      <label>
        <span className="field-label">{t('horseDetail.grain')}</span>
        <input
          className="field"
          value={form.feed}
          onChange={(e) => onChange('feed', e.target.value)}
        />
      </label>
      <label className="sm:col-span-2">
        <span className="field-label">{t('horseDetail.supplements')}</span>
        <input
          className="field"
          value={form.supplements}
          onChange={(e) => onChange('supplements', e.target.value)}
        />
      </label>
    </div>
  )
}

export function FeedingTab({
  horseId,
  stableId,
  plan,
  feedingTimes,
  onPlanSaved,
  onTimesChanged,
}: {
  horseId: string
  stableId: string
  plan: FeedingPlan | null
  feedingTimes: FeedingTime[]
  onPlanSaved: (plan: FeedingPlan) => void
  onTimesChanged: (times: FeedingTime[]) => void
}) {
  const { t } = usePreferences()

  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([])

  useEffect(() => {
    listShiftTypes()
      .then((types) => setShiftTypes(types.filter((st) => st.active)))
      .catch(() => setShiftTypes([]))
  }, [])

  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState<FeedingTimeFormState>(emptyTimeForm)
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const [editing, setEditing] = useState<FeedingTime | null>(null)
  const [editForm, setEditForm] = useState<FeedingTimeFormState>(emptyTimeForm)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const [instructionsOpen, setInstructionsOpen] = useState(false)
  const [instructions, setInstructions] = useState(
    plan?.special_instructions ?? '',
  )
  const [instructionsSaving, setInstructionsSaving] = useState(false)
  const [instructionsError, setInstructionsError] = useState<string | null>(
    null,
  )

  function openAdd() {
    setAddForm(emptyTimeForm())
    setAddError(null)
    setAddOpen(true)
  }

  function updateAddField<K extends keyof FeedingTimeFormState>(
    key: K,
    value: FeedingTimeFormState[K],
  ) {
    setAddForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleAddSubmit(event: FormEvent) {
    event.preventDefault()
    const shiftType = shiftTypes.find(
      (st) => st.id === addForm.feeding_shift_type_id,
    )
    if (!shiftType) return
    setAddSaving(true)
    setAddError(null)
    try {
      const created = await createFeedingTime({
        horse_id: horseId,
        stable_id: stableId,
        feeding_shift_type_id: shiftType.id,
        label: shiftType.label,
        time_of_day: shiftType.time_of_day,
        hay: addForm.hay || null,
        feed: addForm.feed || null,
        supplements: addForm.supplements || null,
      })
      onTimesChanged(sortFeedingTimes([...feedingTimes, created]))
      setAddOpen(false)
    } catch (err) {
      setAddError((err as Error).message)
    } finally {
      setAddSaving(false)
    }
  }

  function openEdit(entry: FeedingTime) {
    setEditing(entry)
    setEditForm(toTimeForm(entry, shiftTypes))
    setEditError(null)
  }

  function updateEditField<K extends keyof FeedingTimeFormState>(
    key: K,
    value: FeedingTimeFormState[K],
  ) {
    setEditForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleEditSubmit(event: FormEvent) {
    event.preventDefault()
    if (!editing) return
    const shiftType = shiftTypes.find(
      (st) => st.id === editForm.feeding_shift_type_id,
    )
    if (!shiftType) return
    setEditSaving(true)
    setEditError(null)
    try {
      const updated = await updateFeedingTime(editing.id, {
        feeding_shift_type_id: shiftType.id,
        label: shiftType.label,
        time_of_day: shiftType.time_of_day,
        hay: editForm.hay || null,
        feed: editForm.feed || null,
        supplements: editForm.supplements || null,
      })
      onTimesChanged(
        sortFeedingTimes(
          feedingTimes.map((entry) =>
            entry.id === updated.id ? updated : entry,
          ),
        ),
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
    if (!window.confirm(t('horseDetail.deleteFeedingTimeConfirm'))) return
    await deleteFeedingTime(editing.id)
    onTimesChanged(feedingTimes.filter((entry) => entry.id !== editing.id))
    setEditing(null)
  }

  function openInstructions() {
    setInstructions(plan?.special_instructions ?? '')
    setInstructionsError(null)
    setInstructionsOpen(true)
  }

  async function handleInstructionsSubmit(event: FormEvent) {
    event.preventDefault()
    setInstructionsSaving(true)
    setInstructionsError(null)
    try {
      const updated = await upsertFeedingPlan({
        horse_id: horseId,
        stable_id: stableId,
        special_instructions: instructions || null,
      })
      onPlanSaved(updated)
      setInstructionsOpen(false)
    } catch (err) {
      setInstructionsError((err as Error).message)
    } finally {
      setInstructionsSaving(false)
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={openInstructions}>
          <Icon name="edit" className="h-4 w-4" />
          {t('horseDetail.specialInstructions')}
        </button>
        <button type="button" className="btn-primary" onClick={openAdd}>
          <Icon name="plus" className="h-4 w-4" />
          {t('horseDetail.addFeedingTime')}
        </button>
      </div>

      {feedingTimes.length === 0 ? (
        <p className="text-sm text-slate-500">
          {t('horseDetail.noFeedingTimes')}
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {feedingTimes.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => openEdit(entry)}
              className="rounded-2xl bg-slate-50 p-4 text-left hover:bg-slate-100"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-slate-900">{entry.label}</h3>
                {entry.time_of_day && (
                  <span className="text-sm text-slate-500">
                    {entry.time_of_day.slice(0, 5)}
                  </span>
                )}
              </div>
              <div className="mt-3 space-y-1.5">
                <p className="rounded-xl border border-slate-200 bg-card px-3 py-1.5 text-sm text-slate-600">
                  <span className="font-medium text-slate-800">
                    {t('horseDetail.hay')}:
                  </span>{' '}
                  {entry.hay || '—'}
                </p>
                <p className="rounded-xl border border-slate-200 bg-card px-3 py-1.5 text-sm text-slate-600">
                  <span className="font-medium text-slate-800">
                    {t('horseDetail.grain')}:
                  </span>{' '}
                  {entry.feed || '—'}
                </p>
                <p className="rounded-xl border border-slate-200 bg-card px-3 py-1.5 text-sm text-slate-600">
                  <span className="font-medium text-slate-800">
                    {t('horseDetail.supplements')}:
                  </span>{' '}
                  {entry.supplements || '—'}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
        {plan?.special_instructions || t('horseDetail.noSpecialFeeding')}
      </div>

      <FeedingExtras
        horseId={horseId}
        stableId={stableId}
        plan={plan}
        onPlanSaved={onPlanSaved}
      />

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={t('horseDetail.addFeedingTime')}
      >
        <form onSubmit={handleAddSubmit} className="grid gap-4">
          {addError && (
            <p role="alert" className="text-sm text-red-600">
              {addError}
            </p>
          )}
          <FeedingTimeFields
            form={addForm}
            shiftTypes={shiftTypes}
            onChange={updateAddField}
          />
          <button type="submit" disabled={addSaving} className="btn-primary">
            {addSaving ? t('common.saving') : t('common.add')}
          </button>
        </form>
      </Modal>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={t('horseDetail.editFeedingTime')}
      >
        <form onSubmit={handleEditSubmit} className="grid gap-4">
          {editError && (
            <p role="alert" className="text-sm text-red-600">
              {editError}
            </p>
          )}
          <FeedingTimeFields
            form={editForm}
            shiftTypes={shiftTypes}
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
        open={instructionsOpen}
        onClose={() => setInstructionsOpen(false)}
        title={t('horseDetail.specialInstructions')}
      >
        <form onSubmit={handleInstructionsSubmit} className="grid gap-4">
          {instructionsError && (
            <p role="alert" className="text-sm text-red-600">
              {instructionsError}
            </p>
          )}
          <label>
            <span className="field-label">
              {t('horseDetail.specialInstructions')}
            </span>
            <textarea
              className="field min-h-32"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </label>
          <button
            type="submit"
            disabled={instructionsSaving}
            className="btn-primary"
          >
            {instructionsSaving ? t('common.saving') : t('common.save')}
          </button>
        </form>
      </Modal>
    </div>
  )
}
