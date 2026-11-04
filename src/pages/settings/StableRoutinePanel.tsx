import { useEffect, useState, type FormEvent } from 'react'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Icon } from '../../components/Icon'
import { Modal } from '../../components/Modal'
import {
  createShiftType,
  deleteShiftType,
  listShiftTypeHorseIds,
  listShiftTypes,
  setShiftTypeHorses,
  updateShiftType,
  type ShiftType,
} from '../../features/feedingRota/api'
import { listHorseOptions } from '../../lib/options'
import type { HorseOption } from '../../lib/options'
import { usePreferences } from '../../lib/PreferencesContext'
import { getCurrentStableId } from '../../lib/stableContext'

type ShiftTypeFormState = {
  label: string
  time_of_day: string
  scope: 'all' | 'horses'
  horse_ids: string[]
}

function emptyShiftTypeForm(): ShiftTypeFormState {
  return { label: '', time_of_day: '', scope: 'all', horse_ids: [] }
}

// Stable-wide feeding times (Morning/Lunch/Dinner/etc.) — the single source
// of truth both the feeding rota and each horse's own feeding plan pick
// from, so staff set a time once here instead of retyping it per horse.
export function StableRoutinePanel() {
  const { t } = usePreferences()

  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([])
  const [horses, setHorses] = useState<HorseOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ShiftType | null>(null)
  const [form, setForm] = useState<ShiftTypeFormState>(emptyShiftTypeForm())
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function load() {
    Promise.all([listShiftTypes(), listHorseOptions()])
      .then(([types, horseOpts]) => {
        setShiftTypes(types)
        setHorses(horseOpts)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  function openAdd() {
    setEditing(null)
    setForm(emptyShiftTypeForm())
    setModalOpen(true)
  }

  function openEdit(shiftType: ShiftType) {
    setEditing(shiftType)
    listShiftTypeHorseIds(shiftType.id)
      .then((horseIds) => {
        setForm({
          label: shiftType.label,
          time_of_day: shiftType.time_of_day.slice(0, 5),
          scope: shiftType.scope as 'all' | 'horses',
          horse_ids: horseIds,
        })
        setModalOpen(true)
      })
      .catch((err: Error) => setError(err.message))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      let shiftTypeId: string
      if (editing) {
        const updated = await updateShiftType(editing.id, {
          label: form.label,
          time_of_day: form.time_of_day,
          scope: form.scope,
        })
        shiftTypeId = updated.id
      } else {
        const stableId = await getCurrentStableId()
        if (!stableId) throw new Error(t('feedingRota.noStableFound'))
        const created = await createShiftType({
          stable_id: stableId,
          label: form.label,
          time_of_day: form.time_of_day,
          scope: form.scope,
        })
        shiftTypeId = created.id
      }
      await setShiftTypeHorses(
        shiftTypeId,
        form.scope === 'horses' ? form.horse_ids : [],
      )
      setModalOpen(false)
      load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deletingId) return
    try {
      await deleteShiftType(deletingId)
      setDeletingId(null)
      load()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  if (loading) return <p className="text-sm text-slate-500">{t('common.loading')}</p>

  return (
    <div className="panel p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="section-title">{t('settings.stableRoutineTitle')}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {t('settings.stableRoutineHint')}
          </p>
        </div>
        <button type="button" className="btn-primary shrink-0" onClick={openAdd}>
          <Icon name="plus" className="h-4 w-4" />
          {t('feedingRota.addShiftType')}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {shiftTypes.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          {t('feedingRota.noShiftTypes')}
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {shiftTypes.map((shiftType) => (
            <div
              key={shiftType.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-4 py-2.5"
            >
              <div>
                <p className="font-medium text-slate-800">{shiftType.label}</p>
                <p className="text-xs text-slate-500">
                  {shiftType.time_of_day.slice(0, 5)} ·{' '}
                  {shiftType.scope === 'all'
                    ? t('feedingRota.scopeAll')
                    : t('feedingRota.scopeHorses')}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  aria-label={`${t('common.edit')}: ${shiftType.label}`}
                  className="text-slate-400 hover:text-forest"
                  onClick={() => openEdit(shiftType)}
                >
                  <Icon name="edit" className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label={`${t('common.delete')}: ${shiftType.label}`}
                  className="text-slate-400 hover:text-red-600"
                  onClick={() => setDeletingId(shiftType.id)}
                >
                  <Icon name="trash" className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          editing ? t('feedingRota.editShiftType') : t('feedingRota.addShiftType')
        }
      >
        <form onSubmit={handleSubmit} className="grid gap-4">
          <label>
            <span className="field-label">{t('feedingRota.shiftTypeLabel')}</span>
            <input
              required
              className="field"
              value={form.label}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, label: e.target.value }))
              }
            />
          </label>
          <label>
            <span className="field-label">{t('feedingRota.shiftTypeTime')}</span>
            <input
              required
              type="time"
              className="field"
              value={form.time_of_day}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, time_of_day: e.target.value }))
              }
            />
          </label>
          <label>
            <span className="field-label">{t('feedingRota.shiftTypeScope')}</span>
            <select
              className="field"
              value={form.scope}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  scope: e.target.value as 'all' | 'horses',
                }))
              }
            >
              <option value="all">{t('feedingRota.scopeAll')}</option>
              <option value="horses">{t('feedingRota.scopeHorses')}</option>
            </select>
          </label>
          {form.scope === 'horses' && (
            <div>
              <span className="field-label">{t('feedingRota.selectHorses')}</span>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-3">
                {horses.map((horse) => (
                  <label key={horse.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.horse_ids.includes(horse.id)}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          horse_ids: e.target.checked
                            ? [...prev.horse_ids, horse.id]
                            : prev.horse_ids.filter((id) => id !== horse.id),
                        }))
                      }
                    />
                    {horse.name}
                  </label>
                ))}
              </div>
            </div>
          )}
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </form>
      </Modal>

      <ConfirmDialog
        open={deletingId !== null}
        title={t('feedingRota.addShiftType')}
        message={t('feedingRota.deleteShiftTypeConfirm')}
        onConfirm={handleDelete}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  )
}
