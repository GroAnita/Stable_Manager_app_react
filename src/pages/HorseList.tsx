import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '../components/Badge'
import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/Icon'
import { listHorses, type HorseListItem } from '../features/horses/api'
import { usePreferences } from '../lib/PreferencesContext'

export default function HorseList() {
  const { t } = usePreferences()
  const [horses, setHorses] = useState<HorseListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listHorses()
      .then((data) => {
        if (!cancelled) setHorses(data)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="page-shell">
      <div className="page-header">
        <h1 className="text-3xl font-semibold text-slate-900">
          {t('horseList.title')}
        </h1>
        <Link to="/horses/new" className="btn-primary">
          <Icon name="plus" className="h-4 w-4" />
          {t('horseList.newHorse')}
        </Link>
      </div>

      {loading && (
        <p className="text-sm text-slate-500">{t('horseList.loading')}</p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {t('horseList.failedToLoad', { error })}
        </p>
      )}
      {!loading && !error && horses.length === 0 && (
        <EmptyState
          title={t('horseList.noHorsesTitle')}
          message={t('horseList.noHorsesMessage')}
        />
      )}

      {!loading && !error && horses.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('horseList.name')}</th>
                <th>{t('horseList.breed')}</th>
                <th>{t('horseList.age')}</th>
                <th>{t('horseList.owner')}</th>
                <th>{t('horseList.stall')}</th>
                <th>{t('horseList.status')}</th>
              </tr>
            </thead>
            <tbody>
              {horses.map((horse) => (
                <tr key={horse.id}>
                  <td>
                    <Link
                      to={`/horses/${horse.id}`}
                      className="font-medium text-forest hover:underline"
                    >
                      {horse.name}
                    </Link>
                  </td>
                  <td>{horse.breed ?? '—'}</td>
                  <td>{horse.age ?? '—'}</td>
                  <td>{horse.owner?.full_name ?? '—'}</td>
                  <td>{horse.stall?.stall_number ?? '—'}</td>
                  <td>
                    <Badge status={horse.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
