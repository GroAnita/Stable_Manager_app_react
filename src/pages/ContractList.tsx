import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '../components/Badge'
import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/Icon'
import {
  deleteContract,
  listContracts,
  type ContractListItem,
} from '../features/contracts/api'
import {
  beddingAmountIncVat,
  currentBillingCycleDays,
  hayValueIncVat,
} from '../lib/billing'
import { usePreferences } from '../lib/PreferencesContext'

type Filter = 'all' | 'active' | 'ending_soon' | 'expired' | 'cancelled'

const FILTER_KEYS: { value: Filter; key: string }[] = [
  { value: 'all', key: 'contractList.filterAll' },
  { value: 'active', key: 'contractList.filterActive' },
  { value: 'ending_soon', key: 'contractList.filterEndingSoon' },
  { value: 'expired', key: 'contractList.filterExpired' },
  { value: 'cancelled', key: 'contractList.filterCancelled' },
]

function totalMonthlyPrice(contract: ContractListItem): number {
  const cycleDays = currentBillingCycleDays()
  const hay =
    contract.included_hay_kg && contract.hay_item
      ? hayValueIncVat(
          contract.hay_item.price,
          contract.included_hay_kg,
          cycleDays,
        )
      : 0
  const bedding =
    contract.bedding_quantity && contract.bedding_item
      ? beddingAmountIncVat(
          contract.bedding_item.price,
          contract.bedding_quantity,
        )
      : 0
  return Math.round((Number(contract.monthly_rent) + hay + bedding) * 100) / 100
}

export default function ContractList() {
  const { t, formatCurrency, formatDate } = usePreferences()
  const [contracts, setContracts] = useState<ContractListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')

  useEffect(() => {
    let cancelled = false
    listContracts()
      .then((data) => {
        if (!cancelled) setContracts(data)
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

  const filtered = useMemo(
    () =>
      filter === 'all'
        ? contracts
        : contracts.filter((c) => c.status === filter),
    [contracts, filter],
  )

  async function handleDelete(contract: ContractListItem) {
    const name = contract.horse?.name ?? t('contractList.fallbackHorse')
    if (!window.confirm(t('contractList.confirmDelete', { name }))) return
    await deleteContract(contract.id)
    setContracts((prev) => prev.filter((c) => c.id !== contract.id))
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">
            {t('contractList.title')}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {t('contractList.subtitle')}
          </p>
        </div>
        <Link to="/contracts/new" className="btn-primary">
          <Icon name="plus" className="h-4 w-4" />
          {t('contractList.addContract')}
        </Link>
      </div>

      <div className="panel p-4">
        <div className="flex flex-wrap gap-2">
          {FILTER_KEYS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              className={`rounded-xl px-4 py-2 text-sm font-medium ${
                filter === item.value
                  ? 'bg-forest text-white'
                  : 'bg-white text-slate-600'
              }`}
            >
              {t(item.key)}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <p className="text-sm text-slate-500">{t('contractList.loading')}</p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {t('contractList.failedToLoad', { error })}
        </p>
      )}
      {!loading && !error && filtered.length === 0 && (
        <EmptyState
          title={t('contractList.noContracts')}
          message={t('contractList.noContractsFiltered')}
        />
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('contractList.horse')}</th>
                <th>{t('contractList.owner')}</th>
                <th>{t('contractList.monthlyTotal')}</th>
                <th>{t('contractList.endDate')}</th>
                <th>{t('contractList.status')}</th>
                <th>{t('contractList.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((contract) => (
                <tr key={contract.id}>
                  <td>{contract.horse?.name ?? '—'}</td>
                  <td>{contract.owner?.full_name ?? '—'}</td>
                  <td>{formatCurrency(totalMonthlyPrice(contract))}</td>
                  <td>{formatDate(contract.end_date)}</td>
                  <td>
                    <Badge status={contract.status} />
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <Link
                        to={`/contracts/${contract.id}/edit`}
                        className="btn-ghost px-3 py-2"
                      >
                        {t('contractList.edit')}
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(contract)}
                        className="btn-ghost px-3 py-2"
                      >
                        {t('contractList.delete')}
                      </button>
                    </div>
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
