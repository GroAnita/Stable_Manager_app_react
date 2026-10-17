import { useState } from 'react'
import {
  getShiftFeedingInfo,
  type FeedingShift,
  type ShiftHorseFeeding,
} from '../features/feedingRota/api'
import { usePreferences } from '../lib/PreferencesContext'

export function ShiftFeedingInfo({ shift }: { shift: FeedingShift }) {
  const { t } = usePreferences()
  const [open, setOpen] = useState(false)
  const [info, setInfo] = useState<ShiftHorseFeeding[] | null>(null)
  const [loading, setLoading] = useState(false)

  function toggle() {
    const next = !open
    setOpen(next)
    if (next && info === null) {
      setLoading(true)
      getShiftFeedingInfo(shift)
        .then(setInfo)
        .catch(() => setInfo([]))
        .finally(() => setLoading(false))
    }
  }

  return (
    <div>
      <button
        type="button"
        className="text-sm font-medium text-forest hover:underline"
        onClick={toggle}
      >
        {open
          ? t('feedingRota.hideFeedingInfo')
          : t('feedingRota.viewFeedingInfo')}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {loading || info === null ? (
            <p className="text-sm text-slate-500">{t('feedingRota.loading')}</p>
          ) : info.length === 0 ? (
            <p className="text-sm text-slate-500">
              {t('feedingRota.noHorsesInScope')}
            </p>
          ) : (
            info.map((item) => (
              <div
                key={item.horse.id}
                className="rounded-xl border border-slate-100 bg-white p-3"
              >
                <p className="font-medium text-slate-800">{item.horse.name}</p>
                {item.feedingTimes.length === 0 ? (
                  <p className="mt-1 text-xs text-slate-400">
                    {t('horseDetail.noFeedingTimes')}
                  </p>
                ) : (
                  <div className="mt-1 space-y-1">
                    {item.feedingTimes.map((ft) => (
                      <p key={ft.id} className="text-xs text-slate-600">
                        <span className="font-medium">
                          {ft.label}
                          {ft.time_of_day
                            ? ` (${ft.time_of_day.slice(0, 5)})`
                            : ''}
                        </span>
                        {': '}
                        {t('horseDetail.hay')} {ft.hay || '—'} ·{' '}
                        {t('horseDetail.grain')} {ft.feed || '—'} ·{' '}
                        {t('horseDetail.supplements')} {ft.supplements || '—'}
                      </p>
                    ))}
                  </div>
                )}
                {item.specialInstructions && (
                  <p className="mt-1 text-xs text-slate-500">
                    {item.specialInstructions}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
