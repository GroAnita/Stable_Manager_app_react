import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '../components/Badge'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import {
  addRotaParticipant,
  createOwnerUnavailability,
  deleteOwnerUnavailability,
  deleteShift,
  lastPublishedOwnerByType,
  listOwnerUnavailability,
  listRotaParticipants,
  listShiftsInRange,
  listShiftTypes,
  publishDraftShifts,
  reassignShift,
  setRotaParticipantActive,
  upsertDraftShifts,
  type FeedingShift,
  type OwnerUnavailability,
  type RotaParticipant,
  type ShiftType,
} from '../features/feedingRota/api'
import { generateDraftSchedule } from '../lib/feedingRotation'
import { listOwnerOptions } from '../lib/options'
import type { OwnerOption } from '../lib/options'
import { usePreferences } from '../lib/PreferencesContext'
import { useAuth } from '../lib/AuthContext'
import { getCurrentStableId } from '../lib/stableContext'
import { FeedingRotaDraft } from './feedingRota/FeedingRotaDraft'

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function addDaysIso(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export default function FeedingRota() {
  const { t, formatDate, formatTime } = usePreferences()
  const { session } = useAuth()

  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([])
  const [participants, setParticipants] = useState<RotaParticipant[]>([])
  const [unavailability, setUnavailability] = useState<OwnerUnavailability[]>([])
  const [owners, setOwners] = useState<OwnerOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
    ])
      .then(([types, parts, unavail, ownerOpts]) => {
        setShiftTypes(types)
        setParticipants(parts)
        setUnavailability(unavail)
        setOwners(ownerOpts)
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
            <Link
              to="/settings?section=stableRoutine"
              className="btn-ghost shrink-0"
            >
              {t('feedingRota.manageInSettings')}
            </Link>
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
                    {(shift.let_out_at || shift.let_in_at) && (
                      <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-emerald-600">
                        {shift.let_out_at && (
                          <span>
                            {t('feedingRota.letOutStatus', {
                              time: formatTime(shift.let_out_at),
                            })}
                          </span>
                        )}
                        {shift.let_in_at && (
                          <span>
                            {t('feedingRota.letInStatus', {
                              time: formatTime(shift.let_in_at),
                            })}
                          </span>
                        )}
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

      <FeedingRotaDraft unavailability={unavailability} />

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
