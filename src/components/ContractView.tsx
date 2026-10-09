import { useEffect, useState } from 'react'
import { Badge } from './Badge'
import { Icon } from './Icon'
import { Modal } from './Modal'
import {
  getContractDetail,
  type ContractDetail,
} from '../features/contracts/api'
import {
  beddingAmountIncVat,
  currentBillingCycleDays,
  hayValueIncVat,
} from '../lib/billing'
import { usePreferences } from '../lib/PreferencesContext'

const SERVICE_LABEL_KEYS: Record<string, string> = {
  full: 'contractForm.serviceFull',
  weekFull: 'contractForm.serviceWeekFull',
  normal: 'contractForm.serviceNormal',
}

export function ContractFields({ contract }: { contract: ContractDetail }) {
  const { t, formatCurrency, formatDate } = usePreferences()
  const cycleDays = currentBillingCycleDays()
  const hayValue =
    contract.hay_item && contract.included_hay_kg
      ? hayValueIncVat(
          contract.hay_item.price,
          contract.included_hay_kg,
          cycleDays,
        )
      : 0
  const beddingValue =
    contract.bedding_item && contract.bedding_quantity
      ? beddingAmountIncVat(
          contract.bedding_item.price,
          contract.bedding_quantity,
        )
      : 0
  const total =
    Math.round((contract.monthly_rent + hayValue + beddingValue) * 100) / 100
  const serviceKey = contract.included_services
    ? SERVICE_LABEL_KEYS[contract.included_services]
    : null

  return (
    <div className="space-y-6">
      {contract.stable && (
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            {contract.stable.name}
          </h2>
          <p className="text-sm text-slate-500">
            {[contract.stable.address, contract.stable.postal_code, contract.stable.city]
              .filter(Boolean)
              .join(', ')}
          </p>
          <p className="text-sm text-slate-500">
            {[contract.stable.phone, contract.stable.email]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="field-label">{t('contractForm.horse')}</span>
          <p className="text-slate-900">{contract.horse?.name ?? '—'}</p>
        </div>
        <div>
          <span className="field-label">{t('contractForm.owner')}</span>
          <p className="text-slate-900">{contract.owner?.full_name ?? '—'}</p>
          {contract.owner?.phone && (
            <p className="text-slate-500">{contract.owner.phone}</p>
          )}
        </div>
        <div>
          <span className="field-label">{t('contractView.stall')}</span>
          <p className="text-slate-900">
            {contract.stall?.stall_number ?? '—'}
          </p>
        </div>
        <div>
          <span className="field-label">{t('contractForm.status')}</span>
          <Badge status={contract.status} />
        </div>
        <div>
          <span className="field-label">{t('contractForm.startDate')}</span>
          <p className="text-slate-900">{formatDate(contract.start_date)}</p>
        </div>
        <div>
          <span className="field-label">{t('contractForm.endDate')}</span>
          <p className="text-slate-900">{formatDate(contract.end_date)}</p>
        </div>
        <div>
          <span className="field-label">{t('contractView.deposit')}</span>
          <p className="text-slate-900">
            {contract.deposit
              ? formatCurrency(contract.deposit)
              : t('contractView.notSet')}
          </p>
        </div>
        {serviceKey && (
          <div>
            <span className="field-label">
              {t('contractForm.includedServices')}
            </span>
            <p className="text-slate-900">{t(serviceKey)}</p>
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-slate-50 p-4">
        <h3 className="text-sm font-semibold text-slate-800">
          {t('contractForm.summaryTitle')}
        </h3>
        <div className="mt-2 space-y-1 text-sm text-slate-600">
          <div className="flex justify-between">
            <span>{t('contractForm.summaryRent')}</span>
            <span>{formatCurrency(contract.monthly_rent)}</span>
          </div>
          {hayValue > 0 && (
            <div className="flex justify-between">
              <span>
                {t('contractForm.summaryHay', {
                  kg: contract.included_hay_kg ?? 0,
                  days: cycleDays,
                })}
              </span>
              <span>{formatCurrency(hayValue)}</span>
            </div>
          )}
          {beddingValue > 0 && (
            <div className="flex justify-between">
              <span>
                {t('contractForm.summaryBedding', {
                  qty: contract.bedding_quantity ?? 0,
                })}
              </span>
              <span>{formatCurrency(beddingValue)}</span>
            </div>
          )}
          <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 font-semibold text-slate-900">
            <span>{t('contractForm.summaryTotal')}</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>
      </div>

      {contract.additional_services && (
        <div>
          <span className="field-label">
            {t('contractForm.additionalServices')}
          </span>
          <p className="whitespace-pre-wrap text-sm text-slate-700">
            {contract.additional_services}
          </p>
        </div>
      )}

      {contract.notes && (
        <div>
          <span className="field-label">{t('contractForm.notes')}</span>
          <p className="whitespace-pre-wrap text-sm text-slate-700">
            {contract.notes}
          </p>
        </div>
      )}
    </div>
  )
}

export function ContractView({
  contractId,
  onClose,
}: {
  contractId: string | null
  onClose: () => void
}) {
  const { t } = usePreferences()
  const [contract, setContract] = useState<ContractDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const loading = contractId !== null && contract?.id !== contractId && !error

  useEffect(() => {
    if (!contractId) return
    let cancelled = false
    getContractDetail(contractId)
      .then((data) => {
        if (!cancelled) {
          setContract(data)
          setError(null)
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [contractId])

  function handleClose() {
    setContract(null)
    setError(null)
    onClose()
  }

  return (
    <>
      <Modal
        open={contractId !== null}
        onClose={handleClose}
        title={t('contractView.title')}
        size="lg"
      >
        {loading && (
          <p className="text-sm text-slate-500">{t('contractView.loading')}</p>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {t('contractView.failedToLoad', { error })}
          </p>
        )}
        {contract && contract.id === contractId && (
          <>
            <div className="mb-4 flex justify-end">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => window.print()}
              >
                <Icon name="fileText" className="h-4 w-4" />
                {t('contractView.print')}
              </button>
            </div>
            <ContractFields contract={contract} />
          </>
        )}
      </Modal>

      {contract && contract.id === contractId && (
        <div className="print-area hidden print:block">
          <ContractFields contract={contract} />
        </div>
      )}
    </>
  )
}
