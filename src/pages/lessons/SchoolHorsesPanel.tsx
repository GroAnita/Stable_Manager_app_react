import { useEffect, useState } from 'react'
import { EmptyState } from '../../components/EmptyState'
import { HorseCard } from '../../components/HorseCard'
import { listHorses, type HorseListItem } from '../../features/horses/api'
import { usePreferences } from '../../lib/PreferencesContext'

export function SchoolHorsesPanel() {
  const { t } = usePreferences()
  const [horses, setHorses] = useState<HorseListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listHorses()
      .then(setHorses)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const schoolHorses = horses.filter((horse) => horse.is_school_horse)

  return (
    <div className="space-y-4">
      <div>
        <h2 className="section-title">{t('lessons.schoolHorsesTitle')}</h2>
        <p className="mt-2 text-sm text-slate-500">
          {t('lessons.schoolHorsesSubtitle')}
        </p>
      </div>

      {loading && <p className="text-sm text-slate-500">{t('lessons.loading')}</p>}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {!loading && !error && schoolHorses.length === 0 && (
        <EmptyState
          title={t('lessons.noHorsesTitle')}
          message={t('lessons.noHorsesMessage')}
        />
      )}

      {!loading && !error && schoolHorses.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {schoolHorses.map((horse) => (
            <HorseCard key={horse.id} horse={horse} />
          ))}
        </div>
      )}
    </div>
  )
}
