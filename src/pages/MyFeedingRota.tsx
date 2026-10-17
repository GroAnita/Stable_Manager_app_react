import { useEffect, useState } from 'react'
import { ShiftFeedingInfo } from '../components/ShiftFeedingInfo'
import {
  listMySwapRequests,
  listMyUpcomingShifts,
  listRotaParticipants,
  markShiftCompleted,
  requestShiftSwap,
  respondToShiftSwap,
  type FeedingShift,
  type RotaParticipant,
  type SwapRequest,
} from '../features/feedingRota/api'
import { getMyOwnerRecord } from '../features/owners/api'
import { usePreferences } from '../lib/PreferencesContext'

export default function MyFeedingRota() {
  const { t, formatDate } = usePreferences()
  const [myOwnerId, setMyOwnerId] = useState<string | null>(null)
  const [shifts, setShifts] = useState<FeedingShift[]>([])
  const [participants, setParticipants] = useState<RotaParticipant[]>([])
  const [swaps, setSwaps] = useState<SwapRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [swapTargetByShift, setSwapTargetByShift] = useState<
    Record<string, string>
  >({})

  function load() {
    Promise.all([
      getMyOwnerRecord(),
      listMyUpcomingShifts(),
      listRotaParticipants(),
      listMySwapRequests(),
    ])
      .then(([owner, upcoming, parts, swapRequests]) => {
        setMyOwnerId(owner?.id ?? null)
        setShifts(upcoming)
        setParticipants(parts)
        setSwaps(swapRequests)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const myShifts = shifts.filter((s) => s.assigned_owner_id === myOwnerId)
  const nextDuty = myShifts.find((s) => !s.completed_at) ?? null

  const incomingSwaps = swaps.filter(
    (s) => s.requested_to_owner_id === myOwnerId && s.status === 'pending',
  )
  const outgoingSwaps = swaps.filter(
    (s) => s.requested_by_owner_id === myOwnerId && s.status !== 'pending',
  )

  async function handleComplete(shiftId: string) {
    if (!myOwnerId) return
    setError(null)
    try {
      await markShiftCompleted(shiftId, myOwnerId)
      load()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function handleRequestSwap(shiftId: string) {
    const toOwnerId = swapTargetByShift[shiftId]
    if (!toOwnerId) return
    setError(null)
    try {
      await requestShiftSwap(shiftId, toOwnerId)
      setSwapTargetByShift((prev) => ({ ...prev, [shiftId]: '' }))
      load()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function handleRespondSwap(swapId: string, accept: boolean) {
    setError(null)
    try {
      await respondToShiftSwap(swapId, accept)
      load()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  if (loading)
    return <p className="text-sm text-slate-500">{t('feedingRota.loading')}</p>

  return (
    <div className="page-shell">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">
          {t('feedingRota.title')}
        </h1>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="panel p-6">
        <h2 className="section-title">{t('feedingRota.myNextDuty')}</h2>
        {nextDuty ? (
          <div className="mt-3 rounded-2xl bg-forest/10 p-4">
            <p className="text-lg font-semibold text-forest">
              {formatDate(nextDuty.date)} · {nextDuty.shift_type?.label ?? '—'}
            </p>
            <p className="text-sm text-slate-600">
              {nextDuty.shift_type?.time_of_day?.slice(0, 5)}
            </p>
            <div className="mt-3">
              <ShiftFeedingInfo shift={nextDuty} />
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            {t('feedingRota.noUpcomingDuty')}
          </p>
        )}
      </div>

      <div className="panel p-6">
        <h2 className="section-title">{t('feedingRota.upcomingDuties')}</h2>
        {myShifts.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            {t('feedingRota.noUpcomingDuties')}
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {myShifts.map((shift) => (
              <div key={shift.id} className="rounded-2xl bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-slate-900">
                    {formatDate(shift.date)} · {shift.shift_type?.label ?? '—'}
                  </p>
                  <p className="text-sm text-slate-500">
                    {shift.completed_at ? (
                      <span className="text-emerald-700">
                        {t('feedingRota.completedBy', {
                          name: shift.assigned_owner?.full_name ?? '—',
                        })}{' '}
                        {t('feedingRota.completedOn', {
                          date: formatDate(shift.completed_at),
                        })}
                      </span>
                    ) : (
                      t('feedingRota.notConfirmed')
                    )}
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {!shift.completed_at && (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => handleComplete(shift.id)}
                    >
                      {t('feedingRota.markCompleted')}
                    </button>
                  )}
                  <select
                    className="field"
                    value={swapTargetByShift[shift.id] ?? ''}
                    onChange={(e) =>
                      setSwapTargetByShift((prev) => ({
                        ...prev,
                        [shift.id]: e.target.value,
                      }))
                    }
                  >
                    <option value="">
                      {t('feedingRota.selectSwapTarget')}
                    </option>
                    {participants
                      .filter((p) => p.active && p.owner_id !== myOwnerId)
                      .map((p) => (
                        <option key={p.owner_id} value={p.owner_id}>
                          {p.owner?.full_name ?? '—'}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={!swapTargetByShift[shift.id]}
                    onClick={() => handleRequestSwap(shift.id)}
                  >
                    {t('feedingRota.requestSwap')}
                  </button>
                </div>
                <div className="mt-3">
                  <ShiftFeedingInfo shift={shift} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel p-6">
        <h2 className="section-title">
          {t('feedingRota.incomingSwapRequests')}
        </h2>
        {incomingSwaps.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            {t('feedingRota.noSwapRequests')}
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {incomingSwaps.map((swap) => (
              <div
                key={swap.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4"
              >
                <p className="text-sm text-slate-700">
                  {swap.requested_by?.full_name ?? '—'} ·{' '}
                  {swap.shift ? formatDate(swap.shift.date) : '—'} ·{' '}
                  {swap.shift?.shift_type?.label ?? '—'}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => handleRespondSwap(swap.id, true)}
                  >
                    {t('feedingRota.acceptSwap')}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => handleRespondSwap(swap.id, false)}
                  >
                    {t('feedingRota.declineSwap')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {outgoingSwaps.length > 0 && (
        <div className="panel p-6">
          <h2 className="section-title">
            {t('feedingRota.outgoingSwapRequests')}
          </h2>
          <div className="mt-3 space-y-2">
            {outgoingSwaps.map((swap) => (
              <div
                key={swap.id}
                className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm"
              >
                <p className="text-slate-700">
                  {swap.requested_to?.full_name ?? '—'} ·{' '}
                  {swap.shift ? formatDate(swap.shift.date) : '—'}
                </p>
                <p className="text-slate-500">
                  {swap.status === 'accepted'
                    ? t('feedingRota.swapStatusAccepted')
                    : swap.status === 'declined'
                      ? t('feedingRota.swapStatusDeclined')
                      : t('feedingRota.swapStatusCancelled')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
