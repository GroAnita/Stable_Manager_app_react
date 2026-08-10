import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/Icon'
import { listOwners, type Owner } from '../features/owners/api'
import { usePreferences } from '../lib/PreferencesContext'

export default function OwnerList() {
  const { t } = usePreferences()
  const [owners, setOwners] = useState<Owner[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    listOwners()
      .then((data) => {
        if (!cancelled) setOwners(data)
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
    if (!query) return owners
    return owners.filter((owner) =>
      [owner.full_name, owner.email, owner.phone].some((value) =>
        value?.toLowerCase().includes(query),
      ),
    )
  }, [owners, search])

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">
            {t('ownerList.title')}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {t('ownerList.subtitle')}
          </p>
        </div>
        <Link to="/owners/new" className="btn-primary">
          <Icon name="plus" className="h-4 w-4" />
          {t('ownerList.addOwner')}
        </Link>
      </div>

      <div className="panel p-4">
        <input
          type="search"
          className="field"
          placeholder={t('ownerList.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading && (
        <p className="text-sm text-slate-500">{t('ownerList.loading')}</p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {t('ownerList.failedToLoad', { error })}
        </p>
      )}

      {!loading && !error && filtered.length === 0 && (
        <EmptyState
          icon="👤"
          title={t('ownerList.noOwnersTitle')}
          message={t('ownerList.noOwnersMessage')}
        />
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((owner) => (
            <Link
              key={owner.id}
              to={`/owners/${owner.id}`}
              className="panel block p-5 text-left transition hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">
                    {owner.full_name}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {owner.email ?? '—'}
                  </p>
                </div>
                {owner.phone && (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                    {owner.phone}
                  </span>
                )}
              </div>
              {owner.address && (
                <p className="mt-4 text-sm text-slate-500">{owner.address}</p>
              )}
              {owner.emergency_contact && (
                <p className="mt-3 text-sm text-slate-400">
                  {t('ownerList.emergency', {
                    contact: owner.emergency_contact,
                  })}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
