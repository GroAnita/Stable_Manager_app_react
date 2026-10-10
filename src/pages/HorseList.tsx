import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '../components/Badge'
import { EmptyState } from '../components/EmptyState'
import { HorseCard } from '../components/HorseCard'
import { Icon } from '../components/Icon'
import { Pagination } from '../components/Pagination'
import { listHorses, type HorseListItem } from '../features/horses/api'
import { usePreferences } from '../lib/PreferencesContext'

const PAGE_SIZE = 6

function capitalize(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : ''
}

export default function HorseList() {
  const { t } = usePreferences()
  const [horses, setHorses] = useState<HorseListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [search, setSearch] = useState('')
  const [breedFilter, setBreedFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)

  const statusLabel = (status: string) => {
    const key = `status.${status}`
    const translated = t(key)
    return translated === key ? capitalize(status.replace(/_/g, ' ')) : translated
  }

  const breeds = useMemo(
    () =>
      [...new Set(horses.map((horse) => horse.breed).filter(Boolean))].sort() as string[],
    [horses],
  )
  const statuses = useMemo(
    () => [...new Set(horses.map((horse) => horse.status))].sort(),
    [horses],
  )

  const filteredHorses = useMemo(() => {
    const query = search.toLowerCase()
    return horses.filter(
      (horse) =>
        (breedFilter === 'all' || horse.breed === breedFilter) &&
        (statusFilter === 'inactive'
          ? !horse.active
          : horse.active &&
            (statusFilter === 'all' || horse.status === statusFilter)) &&
        [horse.name, horse.breed, horse.color, horse.passport_number].some(
          (value) => value && String(value).toLowerCase().includes(query),
        ),
    )
  }, [horses, search, breedFilter, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredHorses.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const visibleHorses = filteredHorses.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  )

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
        <div className="flex items-center gap-3">
          <div className="flex rounded-2xl border border-slate-200 bg-white p-1">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`rounded-xl px-4 py-2 text-sm font-medium ${
                viewMode === 'grid'
                  ? 'bg-forest text-white'
                  : 'text-slate-500'
              }`}
            >
              {t('horseList.grid')}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`rounded-xl px-4 py-2 text-sm font-medium ${
                viewMode === 'list'
                  ? 'bg-forest text-white'
                  : 'text-slate-500'
              }`}
            >
              {t('horseList.list')}
            </button>
          </div>
          <Link to="/horses/new" className="btn-primary">
            <Icon name="plus" className="h-4 w-4" />
            {t('horseList.newHorse')}
          </Link>
        </div>
      </div>

      {loading && (
        <p className="text-sm text-slate-500">{t('horseList.loading')}</p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {t('horseList.failedToLoad', { error })}
        </p>
      )}

      {!loading && !error && horses.length > 0 && (
        <div className="panel grid gap-3 p-4 lg:grid-cols-[2fr,1fr]">
          <input
            type="search"
            className="field"
            placeholder={t('horseList.searchPlaceholder')}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
          />
          <div className="grid gap-3 lg:grid-cols-2">
            <select
              className="field"
              value={breedFilter}
              onChange={(event) => {
                setBreedFilter(event.target.value)
                setPage(1)
              }}
            >
              <option value="all">{t('horseList.allBreeds')}</option>
              {breeds.map((breed) => (
                <option key={breed} value={breed}>
                  {breed}
                </option>
              ))}
            </select>
            <select
              className="field"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value)
                setPage(1)
              }}
            >
              <option value="all">{t('horseList.allStatuses')}</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
                </option>
              ))}
              <option value="inactive">{t('horseList.notActive')}</option>
            </select>
          </div>
        </div>
      )}

      {!loading && !error && filteredHorses.length === 0 && (
        <EmptyState
          title={t('horseList.noHorsesTitle')}
          message={t('horseList.noHorsesMessage')}
        />
      )}

      {!loading && !error && visibleHorses.length > 0 && viewMode === 'grid' && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleHorses.map((horse) => (
            <HorseCard key={horse.id} horse={horse} />
          ))}
        </div>
      )}

      {!loading && !error && visibleHorses.length > 0 && viewMode === 'list' && (
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
              {visibleHorses.map((horse) => (
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
                    <div className="flex flex-wrap gap-2">
                      <Badge status={horse.status} />
                      {horse.away && <Badge status="away" />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && filteredHorses.length > 0 && (
        <Pagination
          page={currentPage}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      )}
    </div>
  )
}
