import { useEffect, useState, type FormEvent } from 'react'
import { Badge } from '../components/Badge'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import {
  addRotaParticipant,
  createOwnerUnavailability,
  createShiftType,
  deleteOwnerUnavailability,
  deleteShift,
  deleteShiftType,
  lastPublishedOwnerByType,
  listOwnerUnavailability,
  listRotaParticipants,
  listShiftsInRange,
  listShiftTypeHorseIds,
  listShiftTypes,
  publishDraftShifts,
  reassignShift,
  setRotaParticipantActive,
  setShiftTypeHorses,
  updateShiftType,
  upsertDraftShifts,
  type FeedingShift,
  type OwnerUnavailability,
  type RotaParticipant,
  type ShiftType,
} from '../features/feedingRota/api'
import { generateDraftSchedule } from '../lib/feedingRotation'
import { listHorseOptions, listOwnerOptions } from '../lib/options'
import type { HorseOption, OwnerOption } from '../lib/options'
import { usePreferences } from '../lib/PreferencesContext'
import { useAuth } from '../lib/AuthContext'
import { getCurrentStableId } from '../lib/stableContext'

type ShiftTypeFormState = {
  label: string
  time_of_day: string
  scope: 'all' | 'horses'
  horse_ids: string[]
}

function emptyShiftTypeForm(): ShiftTypeFormState {
  return { label: '', time_of_day: '', scope: 'all', horse_ids: [] }
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function addDaysIso(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export default function FeedingRota() {
  const { t, formatDate } = usePreferences()
  const { session } = useAuth()

  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([])
  const [participants, setParticipants] = useState<RotaParticipant[]>([])
  const [unavailability, setUnavailability] = useState<OwnerUnavailability[]>([])
  const [owners, setOwners] = useState<OwnerOption[]>([])
  const [horses, setHorses] = useState<HorseOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [shiftTypeModalOpen, setShiftTypeModalOpen] = useState(false)
  const [editingShiftType, setEditingShiftType] = useState<ShiftType | null>(null)
  const [shiftTypeForm, setShiftTypeForm] = useState<ShiftTypeFormState>(emptyShiftTypeForm())
  const [shiftTypeSaving, setShiftTypeSaving] = useState(false)
  const [deletingShiftTypeId, setDeletingShiftTypeId] = useState<string | null>(null)

  const [addParticipantOwnerId, setAddParticipantOwnerId] = useState('')

  const [unavailabilityModalOpen, setUnavailabilityModalOpen] = useState(false)
  const [unavailabilityOwnerId, setUnavailabilityOwnerId] = useState('')
  const [unavailabilityStart, setUnavailabilityStart] = useState('')
  const [unavailabilityEnd, setUnavailabilityEnd] = useState('')
  const [unavailabilityReason, setUnavailabilityReason] = useState('')
  const [deletingUnavailabilityId, setDeletingUnavailabilityId] = useState<string | null>(null)

  const [dateFrom, setDateFrom] = useState(todayIso())
  const [dateTo, setDateTo] = useState(addDaysIso(todayIso(), 6))
  const [shifts, setShifts] = useState<FeedingShift[]>([])
  const [generating, setGenerating] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false)
  const [deletingShiftId, setDeletingShiftId] = useState<string | null>(null)

  function load() {
    Promise.all([
      listShiftTypes(),
      listRotaParticipants(),
      listOwnerUnavailability(),
      listOwnerOptions(),
      listHorseOptions(),
    ])
      .then(([types, parts, unavail, ownerOpts, horseOpts]) => {
        setShiftTypes(types)
        setParticipants(parts)
        setUnavailability(unavail)
        setOwners(ownerOpts)
        setHorses(horseOpts)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  function loadShifts() {
    listShiftsInRange(dateFrom, dateTo)
      .then(setShifts)
      .catch((err: Error) => setError(err.message))
  }

  useEffect(loadShifts, [dateFrom, dateTo])

  // -------------------------------------------------------------------
  // Shift types

  function openAddShiftType() {
    setEditingShiftType(null)
    setShiftTypeForm(emptyShiftTypeForm())
    setShiftTypeModalOpen(true)
  }

  function openEditShiftType(shiftType: ShiftType) {
    setEditingShiftType(shiftType)
    listShiftTypeHorseIds(shiftType.id)
      .then((horseIds) => {
        setShiftTypeForm({
          label: shiftType.label,
          time_of_day: shiftType.time_of_day.slice(0, 5),
          scope: shiftType.scope as 'all' | 'horses',
          horse_ids: horseIds,
        })
        setShiftTypeModalOpen(true)
      })
      .catch((err: Error) => setError(err.message))
  }

  async function handleShiftTypeSubmit(event: FormEvent) {
    event.preventDefault()
    setShiftTypeSaving(true)
    setError(null)
    try {
      let shiftTypeId: string
      if (editingShiftType) {
        const updated = await updateShiftType(editingShiftType.id, {
          label: shiftTypeForm.label,
          time_of_day: shiftTypeForm.time_of_day,
          scope: shiftTypeForm.scope,
        })
        shiftTypeId = updated.id
      } else {
        const stableId = await getCurrentStableId()
        if (!stableId) throw new Error('No stable found.')
        const created = await createShiftType({
          stable_id: stableId,
          label: shiftTypeForm.label,
          time_of_day: shiftTypeForm.time_of_day,
          scope: shiftTypeForm.scope,
        })
        shiftTypeId = created.id
      }
      await setShiftTypeHorses(
        shiftTypeId,
        shiftTypeForm.scope === 'horses' ? shiftTypeForm.horse_ids : [],
      )
      setShiftTypeModalOpen(false)
      load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setShiftTypeSaving(false)
    }
  }

  async function handleDeleteShiftType() {
    if (!deletingShiftTypeId) return
    try {
      await deleteShiftType(deletingShiftTypeId)
      setDeletingShiftTypeId(null)
      load()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  // -------------------------------------------------------------------
  // Participants

  async function handleAddParticipant() {
    if (!addParticipantOwnerId) return
    try {
      const stableId = await getCurrentStableId()
      if (!stableId) throw new Error('No stable found.')
      await addRotaParticipant(stableId, addParticipantOwnerId)
      setAddParticipantOwnerId('')
      load()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function handleToggleParticipant(participant: RotaParticipant) {
    try {
      await setRotaParticipantActive(participant.id, !participant.active)
      load()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const availableOwnersForParticipation = owners.filter(
    (owner) => !participants.some((p) => p.owner_id === owner.id && p.active),
  )

  // -------------------------------------------------------------------
  // Unavailability

  function openAddUnavailability() {
    setUnavailabilityOwnerId('')
    setUnavailabilityStart(todayIso())
    setUnavailabilityEnd(todayIso())
    setUnavailabilityReason('')
    setUnavailabilityModalOpen(true)
  }

  async function handleUnavailabilitySubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    try {
      const stableId = await getCurrentStableId()
      if (!stableId) throw new Error('No stable found.')
      await createOwnerUnavailability({
        stable_id: stableId,
        owner_id: unavailabilityOwnerId,
        start_date: unavailabilityStart,
        end_date: unavailabilityEnd,
        reason: unavailabilityReason || null,
      })
      setUnavailabilityModalOpen(false)
      load()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function handleDeleteUnavailability() {
    if (!deletingUnavailabilityId) return
    try {
      await deleteOwnerUnavailability(deletingUnavailabilityId)
      setDeletingUnavailabilityId(null)
      load()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  // -------------------------------------------------------------------
  // Schedule generation / publish / manual adjustments

  async function handleGenerateDraft() {
    setGenerating(true)
    setError(null)
    try {
      const stableId = await getCurrentStableId()
      if (!stableId || !session) throw new Error('No stable found.')

      const activeTypeIds = shiftTypes.filter((st) => st.active).map((st) => st.id)
      const activeParticipantOwnerIds = participants
        .filter((p) => p.active)
        .map((p) => p.owner_id)
      const existing = await listShiftsInRange(dateFrom, dateTo)
      const lastAssigned = await lastPublishedOwnerByType(
        stableId,
        activeTypeIds,
        dateFrom,
      )

      const plans = generateDraftSchedule({
        shiftTypeIds: activeTypeIds,
        participantOwnerIds: activeParticipantOwnerIds,
        unavailability: unavailability.map((u) => ({
          owner_id: u.owner_id,
          start_date: u.start_date,
          end_date: u.end_date,
        })),
        existingShifts: existing.map((s) => ({
          shift_type_id: s.shift_type_id,
          date: s.date,
          status: s.status,
        })),
        lastAssignedByType: lastAssigned,
        dateFrom,
        dateTo,
      })

      await upsertDraftShifts(stableId, session.user.id, plans)
      loadShifts()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  async function handlePublish() {
    setPublishing(true)
    setError(null)
    try {
      await publishDraftShifts(dateFrom, dateTo)
      setPublishConfirmOpen(false)
      loadShifts()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setPublishing(false)
    }
  }

  async function handleReassign(shiftId: string, ownerId: string) {
    try {
      await reassignShift(shiftId, ownerId || null)
      loadShifts()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function handleDeleteShift() {
    if (!deletingShiftId) return
    try {
      await deleteShift(deletingShiftId)
      setDeletingShiftId(null)
      loadShifts()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const hasDrafts = shifts.some((s) => s.status === 'draft')

  if (loading)
    return <p className="text-sm text-slate-500">{t('feedingRota.loading')}</p>

  return (
    <div className="page-shell">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">
          {t('feedingRota.title')}
        </h1>
        <p className="mt-2 text-sm text-slate-500">{t('feedingRota.subtitle')}</p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="panel p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="section-title">{t('feedingRota.shiftTypesTitle')}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {t('feedingRota.shiftTypesHint')}
              </p>
            </div>
            <button type="button" className="btn-primary shrink-0" onClick={openAddShiftType}>
              <Icon name="plus" className="h-4 w-4" />
              {t('feedingRota.addShiftType')}
            </button>
          </div>
          {shiftTypes.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">{t('feedingRota.noShiftTypes')}</p>
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
                      onClick={() => openEditShiftType(shiftType)}
                    >
                      <Icon name="edit" className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`${t('common.delete')}: ${shiftType.label}`}
                      className="text-slate-400 hover:text-red-600"
                      onClick={() => setDeletingShiftTypeId(shiftType.id)}
                    >
                      <Icon name="trash" className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel p-6">
          <h2 className="section-title">{t('feedingRota.participantsTitle')}</h2>
          <p className="mt-1 text-sm text-slate-500">{t('feedingRota.participantsHint')}</p>
          <div className="mt-4 flex gap-2">
            <select
              className="field"
              value={addParticipantOwnerId}
              onChange={(e) => setAddParticipantOwnerId(e.target.value)}
            >
              <option value="">{t('feedingRota.selectOwnerToAdd')}</option>
              {availableOwnersForParticipation.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.full_name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn-secondary shrink-0"
              disabled={!addParticipantOwnerId}
              onClick={handleAddParticipant}
            >
              {t('feedingRota.addParticipant')}
            </button>
          </div>
          {participants.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">{t('feedingRota.noParticipants')}</p>
          ) : (
            <div className="mt-4 space-y-2">
              {participants.map((participant) => (
                <div
                  key={participant.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-4 py-2.5"
                >
                  <p className="font-medium text-slate-800">
                    {participant.owner?.full_name ?? '—'}
                    {!participant.active && (
                      <span className="ml-2 text-xs text-slate-400">
                        ({t('feedingRota.participantInactive')})
                      </span>
                    )}
                  </p>
                  <button
                    type="button"
                    className="btn-ghost shrink-0"
                    onClick={() => handleToggleParticipant(participant)}
                  >
                    {participant.active
                      ? t('feedingRota.removeParticipant')
                      : t('feedingRota.addParticipant')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel p-6 xl:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="section-title">{t('feedingRota.unavailabilityTitle')}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {t('feedingRota.unavailabilityHint')}
              </p>
            </div>
            <button
              type="button"
              className="btn-primary shrink-0"
              onClick={openAddUnavailability}
            >
              <Icon name="plus" className="h-4 w-4" />
              {t('feedingRota.addUnavailability')}
            </button>
          </div>
          {unavailability.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              {t('feedingRota.noUnavailability')}
            </p>
          ) : (
            <div className="mt-4 space-y-2">
              {unavailability.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-4 py-2.5"
                >
                  <div>
                    <p className="font-medium text-slate-800">
                      {item.owner?.full_name ?? '—'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDate(item.start_date)} – {formatDate(item.end_date)}
                      {item.reason ? ` · ${item.reason}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`${t('common.delete')}: ${item.owner?.full_name ?? ''}`}
                    className="text-slate-400 hover:text-red-600"
                    onClick={() => setDeletingUnavailabilityId(item.id)}
                  >
                    <Icon name="trash" className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel p-6 xl:col-span-2">
          <h2 className="section-title">{t('feedingRota.scheduleTitle')}</h2>
          <p className="mt-1 text-sm text-slate-500">{t('feedingRota.scheduleHint')}</p>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label>
              <span className="field-label">{t('feedingRota.dateFrom')}</span>
              <input
                type="date"
                className="field"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </label>
            <label>
              <span className="field-label">{t('feedingRota.dateTo')}</span>
              <input
                type="date"
                className="field"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="btn-primary"
              disabled={generating || shiftTypes.length === 0}
              onClick={handleGenerateDraft}
            >
              {generating ? t('feedingRota.generating') : t('feedingRota.generateDraft')}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={!hasDrafts}
              onClick={() => setPublishConfirmOpen(true)}
            >
              {t('feedingRota.publishDrafts')}
            </button>
          </div>

          {shifts.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              {t('feedingRota.noShiftsInRange')}
            </p>
          ) : (
            <div className="mt-4 space-y-2">
              {shifts.map((shift) => (
                <div
                  key={shift.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 px-4 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-800">
                        {formatDate(shift.date)} · {shift.shift_type?.label ?? '—'}
                      </p>
                      <Badge
                        status={shift.status === 'published' ? 'active' : 'pending'}
                        label={
                          shift.status === 'published'
                            ? t('feedingRota.statusPublished')
                            : t('feedingRota.statusDraft')
                        }
                      />
                    </div>
                    {shift.unassignable && (
                      <p className="mt-1 text-xs text-red-600">
                        {t('feedingRota.unassignableWarning')}
                      </p>
                    )}
                    {shift.completed_at && (
                      <p className="mt-1 text-xs text-emerald-600">
                        {t('feedingRota.completedBy', {
                          name: shift.assigned_owner?.full_name ?? '—',
                        })}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <select
                      aria-label={`${t('feedingRota.reassignOwnerLabel')}: ${formatDate(shift.date)} · ${shift.shift_type?.label ?? ''}`}
                      className="field"
                      value={shift.assigned_owner_id ?? ''}
                      onChange={(e) => handleReassign(shift.id, e.target.value)}
                    >
                      <option value="">{t('feedingRota.unassignedOption')}</option>
                      {owners.map((owner) => (
                        <option key={owner.id} value={owner.id}>
                          {owner.full_name}
                        </option>
                      ))}
                    </select>
                    {shift.status === 'draft' && (
                      <button
                        type="button"
                        aria-label={`${t('common.delete')}: ${formatDate(shift.date)} · ${shift.shift_type?.label ?? ''}`}
                        className="text-slate-400 hover:text-red-600"
                        onClick={() => setDeletingShiftId(shift.id)}
                      >
                        <Icon name="trash" className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal
        open={shiftTypeModalOpen}
        onClose={() => setShiftTypeModalOpen(false)}
        title={
          editingShiftType
            ? t('feedingRota.editShiftType')
            : t('feedingRota.addShiftType')
        }
      >
        <form onSubmit={handleShiftTypeSubmit} className="grid gap-4">
          <label>
            <span className="field-label">{t('feedingRota.shiftTypeLabel')}</span>
            <input
              required
              className="field"
              value={shiftTypeForm.label}
              onChange={(e) =>
                setShiftTypeForm((prev) => ({ ...prev, label: e.target.value }))
              }
            />
          </label>
          <label>
            <span className="field-label">{t('feedingRota.shiftTypeTime')}</span>
            <input
              required
              type="time"
              className="field"
              value={shiftTypeForm.time_of_day}
              onChange={(e) =>
                setShiftTypeForm((prev) => ({ ...prev, time_of_day: e.target.value }))
              }
            />
          </label>
          <label>
            <span className="field-label">{t('feedingRota.shiftTypeScope')}</span>
            <select
              className="field"
              value={shiftTypeForm.scope}
              onChange={(e) =>
                setShiftTypeForm((prev) => ({
                  ...prev,
                  scope: e.target.value as 'all' | 'horses',
                }))
              }
            >
              <option value="all">{t('feedingRota.scopeAll')}</option>
              <option value="horses">{t('feedingRota.scopeHorses')}</option>
            </select>
          </label>
          {shiftTypeForm.scope === 'horses' && (
            <div>
              <span className="field-label">{t('feedingRota.selectHorses')}</span>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-3">
                {horses.map((horse) => (
                  <label key={horse.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={shiftTypeForm.horse_ids.includes(horse.id)}
                      onChange={(e) =>
                        setShiftTypeForm((prev) => ({
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
          <button type="submit" disabled={shiftTypeSaving} className="btn-primary">
            {shiftTypeSaving ? t('common.saving') : t('common.save')}
          </button>
        </form>
      </Modal>

      <ConfirmDialog
        open={deletingShiftTypeId !== null}
        title={t('feedingRota.addShiftType')}
        message={t('feedingRota.deleteShiftTypeConfirm')}
        onConfirm={handleDeleteShiftType}
        onCancel={() => setDeletingShiftTypeId(null)}
      />

      <Modal
        open={unavailabilityModalOpen}
        onClose={() => setUnavailabilityModalOpen(false)}
        title={t('feedingRota.addUnavailability')}
      >
        <form onSubmit={handleUnavailabilitySubmit} className="grid gap-4">
          <label>
            <span className="field-label">{t('feedingRota.unavailabilityOwner')}</span>
            <select
              required
              className="field"
              value={unavailabilityOwnerId}
              onChange={(e) => setUnavailabilityOwnerId(e.target.value)}
            >
              <option value="">{t('feedingRota.selectOwnerToAdd')}</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.full_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="field-label">{t('feedingRota.unavailabilityStart')}</span>
            <input
              required
              type="date"
              className="field"
              value={unavailabilityStart}
              onChange={(e) => setUnavailabilityStart(e.target.value)}
            />
          </label>
          <label>
            <span className="field-label">{t('feedingRota.unavailabilityEnd')}</span>
            <input
              required
              type="date"
              className="field"
              value={unavailabilityEnd}
              onChange={(e) => setUnavailabilityEnd(e.target.value)}
            />
          </label>
          <label>
            <span className="field-label">{t('feedingRota.unavailabilityReason')}</span>
            <input
              className="field"
              value={unavailabilityReason}
              onChange={(e) => setUnavailabilityReason(e.target.value)}
            />
          </label>
          <button type="submit" className="btn-primary">
            {t('common.save')}
          </button>
        </form>
      </Modal>

      <ConfirmDialog
        open={deletingUnavailabilityId !== null}
        title={t('feedingRota.addUnavailability')}
        message={t('feedingRota.deleteUnavailabilityConfirm')}
        onConfirm={handleDeleteUnavailability}
        onCancel={() => setDeletingUnavailabilityId(null)}
      />

      <ConfirmDialog
        open={deletingShiftId !== null}
        title={t('feedingRota.scheduleTitle')}
        message={t('feedingRota.deleteShiftConfirm')}
        onConfirm={handleDeleteShift}
        onCancel={() => setDeletingShiftId(null)}
      />

      <ConfirmDialog
        open={publishConfirmOpen}
        title={t('feedingRota.publishDrafts')}
        message={t('feedingRota.publishConfirm')}
        confirmLabel={publishing ? t('feedingRota.publishing') : t('feedingRota.publishDrafts')}
        onConfirm={handlePublish}
        onCancel={() => setPublishConfirmOpen(false)}
      />
    </div>
  )
}
