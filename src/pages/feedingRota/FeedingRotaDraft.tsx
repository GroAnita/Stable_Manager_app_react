import { useEffect, useMemo, useState } from 'react'
import {
  listOwnerHorseCounts,
  type OwnerHorseCount,
  type OwnerUnavailability,
} from '../../features/feedingRota/api'
import {
  buildFeedingRotaDraft,
  feedingCounts,
  nextMonday,
  type DraftDay,
} from '../../lib/feedingRotaDraft'
import { usePreferences } from '../../lib/PreferencesContext'
import { DraftCalendar, DraftList, SlotLegend } from './DraftViews'

const HORSE_GROUPS = [1, 2, 3, 4]

// A test of a rota worked out from each owner's number of horses. Nothing here is
// saved, and it doesn't touch the rota above it.
export function FeedingRotaDraft({
  unavailability,
}: {
  unavailability: OwnerUnavailability[]
}) {
  const { t, language } = usePreferences()
  const [owners, setOwners] = useState<OwnerHorseCount[]>([])
  const [error, setError] = useState<string | null>(null)
  const [excluded, setExcluded] = useState<string[]>([])
  const [weeks, setWeeks] = useState(6)
  const [feedingsPerDay, setFeedingsPerDay] = useState(2)
  const [startDate, setStartDate] = useState(() =>
    nextMonday(new Date().toISOString().slice(0, 10)),
  )
  const [days, setDays] = useState<DraftDay[] | null>(null)
  const [draftFeedings, setDraftFeedings] = useState(2)
  const [view, setView] = useState<'calendar' | 'list'>('calendar')

  useEffect(() => {
    listOwnerHorseCounts()
      .then(setOwners)
      .catch((err: Error) => setError(err.message))
  }, [])

  const namesById = useMemo(
    () => new Map(owners.map((owner) => [owner.id, owner.full_name])),
    [owners],
  )
  const ownerName = (id: string) => namesById.get(id) ?? '—'
  const included = owners.filter((owner) => !excluded.includes(owner.id))

  function handleDistribute() {
    setDays(
      buildFeedingRotaDraft({
        owners: included,
        startDate,
        weeks,
        feedingsPerDay,
        unavailability,
      }),
    )
    setDraftFeedings(feedingsPerDay)
  }

  function toggleOwner(id: string) {
    setExcluded((prev) =>
      prev.includes(id) ? prev.filter((other) => other !== id) : [...prev, id],
    )
  }

  const counts = days ? feedingCounts(days) : null
  const viewProps = days && {
    days,
    feedingsPerDay: draftFeedings,
    ownerName,
    t,
    locale: language === 'no' ? 'nb-NO' : 'en-GB',
  }

  return (
    <div className="panel space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="section-title">{t('feedingRotaDraft.title')}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {t('feedingRotaDraft.hint')}
          </p>
        </div>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
          {t('feedingRotaDraft.testBadge')}
        </span>
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
          <span className="field-label">
            {t('feedingRotaDraft.feedingsPerDay')}
          </span>
          <select
            className="field"
            value={feedingsPerDay}
            onChange={(e) => setFeedingsPerDay(Number(e.target.value))}
          >
            {[1, 2, 3, 4].map((value) => (
              <option key={value} value={value}>
                {value}
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

      <button
        type="button"
        className="btn-primary"
        disabled={included.length === 0}
        onClick={handleDistribute}
      >
        {t('feedingRotaDraft.distribute')}
      </button>

      {viewProps && counts && (
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
            <SlotLegend feedingsPerDay={draftFeedings} t={t} />
          </div>

          {view === 'calendar' ? (
            <DraftCalendar {...viewProps} />
          ) : (
            <DraftList {...viewProps} />
          )}

          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">
              {t('feedingRotaDraft.countsTitle')}
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {included.map((owner) => (
                <span
                  key={owner.id}
                  className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700"
                >
                  {owner.full_name}: {counts.get(owner.id) ?? 0}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
