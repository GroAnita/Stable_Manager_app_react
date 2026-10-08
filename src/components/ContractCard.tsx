import { Link } from 'react-router-dom'
import { Badge } from './Badge'
import type { ContractListItem } from '../features/contracts/api'
import { usePreferences } from '../lib/PreferencesContext'

export function ContractCard({
  contract,
  monthlyTotal,
  onView,
  onDelete,
}: {
  contract: ContractListItem
  monthlyTotal: number
  onView: () => void
  onDelete: () => void
}) {
  const { t, formatCurrency, formatDate } = usePreferences()

  return (
    <div className="panel flex flex-col gap-3 p-5">
      <button type="button" onClick={onView} className="text-left">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              {contract.horse?.name ?? '—'}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {contract.owner?.full_name ?? '—'}
            </p>
          </div>
          <Badge status={contract.status} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-slate-500">
          <div>
            <span className="block text-xs uppercase tracking-wide text-slate-400">
              {t('contractList.monthlyTotal')}
            </span>
            {formatCurrency(monthlyTotal)}
          </div>
          <div>
            <span className="block text-xs uppercase tracking-wide text-slate-400">
              {t('contractList.endDate')}
            </span>
            {formatDate(contract.end_date)}
          </div>
        </div>
      </button>
      <div className="flex gap-2 border-t border-slate-100 pt-3">
        <Link
          to={`/contracts/${contract.id}/edit`}
          className="btn-ghost flex-1 justify-center px-3 py-2"
        >
          {t('contractList.edit')}
        </Link>
        <button
          type="button"
          onClick={onDelete}
          className="btn-ghost flex-1 justify-center px-3 py-2"
        >
          {t('contractList.delete')}
        </button>
      </div>
    </div>
  )
}
