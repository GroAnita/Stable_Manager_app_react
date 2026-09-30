import { Link } from 'react-router-dom'
import { Badge } from './Badge'
import { HorseAvatar } from './HorseAvatar'
import type { HorseListItem } from '../features/horses/api'
import { usePreferences } from '../lib/PreferencesContext'

export function HorseCard({ horse }: { horse: HorseListItem }) {
  const { t } = usePreferences()

  return (
    <Link
      to={`/horses/${horse.id}`}
      className="panel flex flex-col gap-4 p-5 transition hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-4">
        <HorseAvatar name={horse.name} photoUrl={horse.photo_url} />
        <Badge status={horse.status} />
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
    </Link>
  )
}
