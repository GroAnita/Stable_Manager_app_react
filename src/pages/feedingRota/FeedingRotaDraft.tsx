import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Modal } from '../../components/Modal'
import {
  addRotaParticipant,
  listOwnerHorseCounts,
  listRotaParticipants,
  listShiftsInRange,
  listShiftTypes,
  publishFeedingRota,
  reassignShift,
  type OwnerHorseCount,
  type OwnerUnavailability,
  type ShiftType,
} from '../../features/feedingRota/api'
import {
  buildFeedingRotaDraft,
  draftDayLabel,
  feedingCounts,
  nextMonday,
  replaceDraftSlot,
  rotaEndDate,
  ROTA_DAY_OPTIONS,
  unpublishedSlots,
  type DraftDay,
  type PublishedSlot,
  type RotaDayOption,
} from '../../lib/feedingRotaDraft'
import { usePreferences } from '../../lib/PreferencesContext'
import { getCurrentStableId } from '../../lib/stableContext'
import { DraftCalendar, DraftList, SlotLegend } from './DraftViews'

const HORSE_GROUPS = [1, 2, 3, 4]

// Works out a rota from each owner's number of horses. A rota is only on this page
// until it's published, which creates the shifts owners see and can swap.
export function FeedingRotaDraft({
  unavailability,
}: {
  unavailability: OwnerUnavailability[]
}) {
  const { t, language } = usePreferences()
  const [owners, setOwners] = useState<OwnerHorseCount[]>([])
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [excluded, setExcluded] = useState<string[]>([])
  const [weeks, setWeeks] = useState(6)
  const [rotaDays, setRotaDays] = useState<RotaDayOption>('monSun')
  const [startDate, setStartDate] = useState(() =>
    nextMonday(new Date().toISOString().slice(0, 10)),
  )
  const [published, setPublished] = useState<PublishedSlot[]>([])
  const [publishedNames, setPublishedNames] = useState<Map<string, string>>(
    new Map(),
  )
  const [days, setDays] = useState<DraftDay[]>([])
  const [view, setView] = useState<'calendar' | 'list'>('calendar')
  const [picking, setPicking] = useState<{
    date: string
    slot: number
  } | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [reloadCount, setReloadCount] = useState(0)

  useEffect(() => {
    Promise.all([
      listOwnerHorseCounts(),
      listRotaParticipants(),
      listShiftTypes(),
    ])
      .then(([ownerRows, participants, types]) => {
        setOwners(ownerRows)
        setShiftTypes(types.filter((type) => type.active))
        // A stable that already chose who takes part keeps that choice.
        if (participants.length > 0) {
          const active = participants
            .filter((participant) => participant.active)
            .map((participant) => participant.owner_id)
          setExcluded(
            ownerRows
              .filter((owner) => !active.includes(owner.id))
              .map((owner) => owner.id),
          )
        }
        setReady(true)
      })
      .catch((err: Error) => setError(err.message))
  }, [])

  // Shows what's already published for the period, and clears any rota not yet
  // published, because it was worked out for different dates.
  useEffect(() => {
    if (!ready || !startDate) return
    let cancelled = false
    listShiftsInRange(startDate, rotaEndDate(startDate, weeks))
      .then((shifts) => {
        if (cancelled) return
        const live = shifts.filter((shift) => shift.status === 'published')
        const slots: PublishedSlot[] = live.flatMap((shift) => {
          const slot = shiftTypes.findIndex(
            (type) => type.id === shift.shift_type_id,
          )
          return slot < 0
            ? []
            : [
                {
                  date: shift.date,
                  slot,
                  ownerId: shift.assigned_owner_id,
                  shiftId: shift.id,
                  completed: shift.completed_at !== null,
                },
              ]
        })
        setPublished(slots)
        setPublishedNames(
          new Map(
            live.flatMap((shift) =>
              shift.assigned_owner
                ? [[shift.assigned_owner.id, shift.assigned_owner.full_name]]
                : [],
            ),
          ),
        )
        setDays(
          buildFeedingRotaDraft({
            owners: [],
            startDate,
            weeks,
            slotCount: shiftTypes.length,
            published: slots,
            planNew: false,
          }),
        )
      })
      .catch((err: Error) => setError(err.message))
    return () => {
      cancelled = true
    }
  }, [ready, shiftTypes, startDate, weeks, reloadCount])

  const namesById = useMemo(
    () =>
      new Map([
        ...publishedNames,
        ...owners.map((owner) => [owner.id, owner.full_name] as const),
      ]),
    [owners, publishedNames],
  )
  const ownerName = (id: string) => namesById.get(id) ?? '—'
  const included = owners.filter((owner) => !excluded.includes(owner.id))
  const slotLabels = shiftTypes.map((type) => type.label)
  const locale = language === 'no' ? 'nb-NO' : 'en-GB'
  const toPublish = unpublishedSlots(days)
  const withoutOwner = toPublish.filter((slot) => !slot.ownerId).length
  const counts = feedingCounts(days)
  const pickedDay = picking && days.find((day) => day.date === picking.date)
  const pickedSlot = picking && pickedDay?.slots[picking.slot]

  function handleDistribute() {
    setMessage(null)
    setDays(
      buildFeedingRotaDraft({
        owners: included,
        startDate,
        weeks,
        slotCount: shiftTypes.length,
        rotaDays,
        unavailability,
        published,
      }),
    )
  }

  function toggleOwner(id: string) {
    setExcluded((prev) =>
      prev.includes(id) ? prev.filter((other) => other !== id) : [...prev, id],
    )
  }

  async function handleSwap(ownerId: string) {
    if (!picking || !pickedSlot) return
    setError(null)
    try {
      if (pickedSlot.shiftId) {
        const stableId = await getCurrentStableId()
        if (!stableId) throw new Error('No stable found.')
        await addRotaParticipant(stableId, ownerId)
        await reassignShift(pickedSlot.shiftId, ownerId)
      }
      setDays((prev) =>
        replaceDraftSlot(prev, picking.date, picking.slot, ownerId),
      )
      setPicking(null)
    } catch (err) {
      setError((err as Error).message)
      setPicking(null)
    }
  }

  async function handlePublish() {
    setPublishing(true)
    setError(null)
    try {
      const created = await publishFeedingRota({
        dateFrom: startDate,
        dateTo: rotaEndDate(startDate, weeks),
        plans: toPublish.map((slot) => ({
          shift_type_id: shiftTypes[slot.slot].id,
          date: slot.date,
          owner_id: slot.ownerId,
        })),
        excludedOwnerIds: excluded,
        noticeTitle: t('feedingRotaDraft.noticeTitle'),
        noticeMessage: t('feedingRotaDraft.noticeMessage'),
      })
      setMessage(t('feedingRotaDraft.published', { count: created }))
      setReloadCount((count) => count + 1)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setConfirmOpen(false)
      setPublishing(false)
    }
  }

  return (
    <div className="panel space-y-6 p-6">
      <div>
        <h2 className="section-title">{t('feedingRotaDraft.title')}</h2>
        <p className="mt-1 text-sm text-slate-500">
          {t('feedingRotaDraft.hint')}
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <label>
          <span className="field-label">{t('feedingRotaDraft.weeks')}</span>
          <input
            type="number"
            min={1}
            max={12}
            className="field"
            value={weeks}
            onChange={(e) =>
              setWeeks(Math.min(12, Math.max(1, Number(e.target.value) || 1)))
            }
          />
        </label>
        <label>
          <span className="field-label">{t('feedingRotaDraft.rotaDays')}</span>
          <select
            className="field"
            value={rotaDays}
            onChange={(e) => setRotaDays(e.target.value as RotaDayOption)}
          >
            {(Object.keys(ROTA_DAY_OPTIONS) as RotaDayOption[]).map((value) => (
              <option key={value} value={value}>
                {t(`feedingRotaDraft.rotaDays_${value}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">{t('feedingRotaDraft.startDate')}</span>
          <input
            type="date"
            className="field"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </label>
      </div>

      {ready && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-700">
              {t('feedingRotaDraft.feedingTimes')}
            </p>
            <p className="text-sm text-slate-500">
              {slotLabels.length > 0
                ? slotLabels.join(', ')
                : t('feedingRotaDraft.noFeedingTimes')}
            </p>
          </div>
          <Link
            to="/settings?section=stableRoutine"
            className="btn-ghost shrink-0"
          >
            {t('feedingRota.manageInSettings')}
          </Link>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs text-slate-500">
          {t('feedingRotaDraft.ownersHint')}
        </p>
        {HORSE_GROUPS.map((group) => {
          const members = owners.filter((owner) =>
            group === 4 ? owner.horses >= 4 : owner.horses === group,
          )
          return (
            <div
              key={group}
              className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center"
            >
              <span className="text-sm font-medium text-slate-700">
                {t(`feedingRotaDraft.group${group}`)}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {members.length === 0 && (
                  <span className="text-xs text-slate-400">—</span>
                )}
                {members.map((owner) => {
                  const off = excluded.includes(owner.id)
                  return (
                    <button
                      key={owner.id}
                      type="button"
                      aria-pressed={!off}
                      onClick={() => toggleOwner(owner.id)}
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                        off
                          ? 'border-slate-200 text-slate-400 line-through'
                          : 'border-forest/30 bg-forest/10 text-forest'
                      }`}
                    >
                      {owner.full_name}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn-primary"
          disabled={included.length === 0 || shiftTypes.length === 0}
          onClick={handleDistribute}
        >
          {t('feedingRotaDraft.distribute')}
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={toPublish.length === 0}
          onClick={() => setConfirmOpen(true)}
        >
          {t('feedingRotaDraft.publish')}
        </button>
        {message && <p className="text-sm text-forest">{message}</p>}
      </div>

      {days.length > 0 && (
        <div className="space-y-4 border-t border-slate-100 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
              {(['calendar', 'list'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={view === value}
                  onClick={() => setView(value)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                    view === value
                      ? 'bg-card text-forest shadow-sm'
                      : 'text-slate-500'
                  }`}
                >
                  {t(`feedingRotaDraft.view_${value}`)}
                </button>
              ))}
            </div>
            <SlotLegend slotLabels={slotLabels} t={t} />
          </div>

          {view === 'calendar' ? (
            <DraftCalendar
              days={days}
              slotLabels={slotLabels}
              ownerName={ownerName}
              t={t}
              locale={locale}
              onPick={(date, slot) => setPicking({ date, slot })}
            />
          ) : (
            <DraftList
              days={days}
              slotLabels={slotLabels}
              ownerName={ownerName}
              t={t}
              locale={locale}
              onPick={(date, slot) => setPicking({ date, slot })}
            />
          )}

          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">
              {t('feedingRotaDraft.countsTitle')}
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {[...counts.entries()].map(([ownerId, count]) => (
                <span
                  key={ownerId}
                  className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700"
                >
                  {ownerName(ownerId)}: {count}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <Modal
        open={picking !== null}
        onClose={() => setPicking(null)}
        title={t('feedingRotaDraft.swapTitle')}
      >
        {picking && pickedDay && pickedSlot && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500 first-letter:uppercase">
              {draftDayLabel(picking.date, locale)} · {slotLabels[picking.slot]}
            </p>
            {pickedSlot.shiftId && (
              <p className="text-sm text-amber-700">
                {t('feedingRotaDraft.swapPublished')}
              </p>
            )}
            <div className="space-y-1.5">
              {included.map((owner) => {
                const current = pickedSlot.ownerId === owner.id
                const sameDay =
                  !current &&
                  pickedDay.slots.some((slot) => slot?.ownerId === owner.id)
                const away = unavailability.some(
                  (range) =>
                    range.owner_id === owner.id &&
                    picking.date >= range.start_date &&
                    picking.date <= range.end_date,
                )
                return (
                  <button
                    key={owner.id}
                    type="button"
                    disabled={current}
                    onClick={() => handleSwap(owner.id)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm ${
                      current
                        ? 'border-forest/30 bg-forest/10 text-forest'
                        : 'border-slate-200 text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {owner.full_name}
                      </span>
                      {current && (
                        <span className="block text-xs">
                          {t('feedingRotaDraft.swapCurrent')}
                        </span>
                      )}
                      {sameDay && (
                        <span className="block text-xs text-amber-700">
                          {t('feedingRotaDraft.swapSameDay')}
                        </span>
                      )}
                      {away && (
                        <span className="block text-xs text-red-600">
                          {t('feedingRotaDraft.swapAway')}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-xs text-slate-500">
                      {t('feedingRotaDraft.swapCount', {
                        count: counts.get(owner.id) ?? 0,
                      })}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        title={t('feedingRotaDraft.publish')}
        message={[
          t('feedingRotaDraft.publishConfirm', { count: toPublish.length }),
          withoutOwner > 0
            ? t('feedingRotaDraft.publishWithoutOwner', { count: withoutOwner })
            : '',
        ]
          .filter(Boolean)
          .join(' ')}
        confirmLabel={
          publishing
            ? t('feedingRotaDraft.publishing')
            : t('feedingRotaDraft.publish')
        }
        onConfirm={handlePublish}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}
