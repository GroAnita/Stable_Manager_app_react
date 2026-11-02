import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/Icon'
import { listCoRiders, type CoRider } from '../features/co-riders/api'
import { usePreferences } from '../lib/PreferencesContext'

export default function CoRiderList() {
  const { t } = usePreferences()
  const [coRiders, setCoRiders] = useState<CoRider[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    listCoRiders()
      .then((data) => {
        if (!cancelled) setCoRiders(data)
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

  const filtered = useMemo(() => {
    const query = search.toLowerCase()
    if (!query) return coRiders
    return coRiders.filter((coRider) =>
      [coRider.full_name, coRider.email, coRider.phone].some((value) =>
        value?.toLowerCase().includes(query),
      ),
    )
  }, [coRiders, search])

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">
            {t('coRiderList.title')}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {t('coRiderList.subtitle')}
          </p>
        </div>
        <Link to="/co-riders/new" className="btn-primary">
          <Icon name="plus" className="h-4 w-4" />
          {t('coRiderList.addCoRider')}
        </Link>
      </div>

      <div className="panel p-4">
        <input
          type="search"
          className="field"
          placeholder={t('coRiderList.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading && (
        <p className="text-sm text-slate-500">{t('coRiderList.loading')}</p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {t('coRiderList.failedToLoad', { error })}
        </p>
      )}

      {!loading && !error && filtered.length === 0 && (
        <EmptyState
          icon="🐎"
          title={t('coRiderList.noCoRidersTitle')}
          message={t('coRiderList.noCoRidersMessage')}
        />
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((coRider) => (
            <Link
              key={coRider.id}
              to={`/co-riders/${coRider.id}`}
              className="panel block p-5 text-left transition hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">
                    {coRider.full_name}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {coRider.email ?? '—'}
                  </p>
                </div>
                {coRider.phone && (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                    {coRider.phone}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
