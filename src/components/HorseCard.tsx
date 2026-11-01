import { Link } from 'react-router-dom'
import { Badge } from './Badge'
import { HorseAvatar } from './HorseAvatar'
import { Toggle } from './Toggle'
import type { HorseListItem } from '../features/horses/api'
import { usePreferences } from '../lib/PreferencesContext'

export function HorseCard({
  horse,
  onToggleSchoolHorse,
}: {
  horse: HorseListItem
  onToggleSchoolHorse?: (checked: boolean) => void
}) {
  const { t } = usePreferences()

  const identity = (
    <>
      <div className="flex items-start justify-between gap-4">
        <HorseAvatar name={horse.name} photoUrl={horse.photo_url} />
        <div className="flex flex-wrap justify-end gap-2">
          <Badge status={horse.status} />
          {horse.away && <Badge status="away" />}
        </div>
      </div>
      <div>
        <h3 className="text-xl font-semibold text-slate-900">{horse.name}</h3>
        <p className="mt-1 text-sm text-slate-500">
          {horse.breed ?? '—'} · {horse.age ?? '—'}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm text-slate-500">
        <div>
          <span className="block text-xs uppercase tracking-wide text-slate-400">
            {t('horseList.stall')}
          </span>
          {horse.stall?.stall_number ?? '—'}
        </div>
        <div>
          <span className="block text-xs uppercase tracking-wide text-slate-400">
            {t('horseList.owner')}
          </span>
          {horse.owner?.full_name ?? '—'}
        </div>
      </div>
    </>
  )

  // Nesting the toggle's own button inside the card's navigation <Link>
  // would make every toggle click also navigate to the horse's detail
  // page, so when a toggle is wanted, the link only wraps the identity
  // block and the toggle sits outside it as a sibling.
  if (!onToggleSchoolHorse) {
    return (
      <Link
        to={`/horses/${horse.id}`}
        className="panel flex flex-col gap-4 p-5 transition hover:-translate-y-0.5"
      >
        {identity}
      </Link>
    )
  }

  return (
    <div className="panel flex flex-col gap-4 p-5">
      <Link
        to={`/horses/${horse.id}`}
        className="flex flex-col gap-4 transition hover:opacity-80"
      >
        {identity}
      </Link>
      <div className="border-t border-slate-100 pt-3">
        <Toggle
          label={t('lessons.schoolHorse')}
          checked={horse.is_school_horse}
          onChange={onToggleSchoolHorse}
        />
      </div>
    </div>
  )
}
