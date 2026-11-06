import { useVatRegistered } from '../lib/useVatRegistered'
import { useEffect, useState } from 'react'
import { Badge } from './Badge'
import { Icon } from './Icon'
import { Modal } from './Modal'
import {
  getContractDetail,
  getEmptyBoxRate,
  type ContractDetail,
} from '../features/contracts/api'
import {
  beddingAmountIncVat,
  currentBillingCycleDays,
  currentBillingPeriod,
  scheduleDaysInPeriod,
  serviceAmountIncVat,
  hayValueIncVat,
} from '../lib/billing'
import { usePreferences } from '../lib/PreferencesContext'

export function ContractFields({ contract }: { contract: ContractDetail }) {
  const { t, formatCurrency, formatDate } = usePreferences()
  const [emptyBoxRate, setEmptyBoxRate] = useState<number | null>(null)
  const horseIsAway = contract.horse?.away ?? false

  useEffect(() => {
    if (!horseIsAway) return
    let cancelled = false
    getEmptyBoxRate(contract.stable_id)
      .then((rate) => {
        if (!cancelled) setEmptyBoxRate(rate)
      })
      .catch(() => {
        if (!cancelled) setEmptyBoxRate(null)
      })
    return () => {
      cancelled = true
    }
  }, [horseIsAway, contract.stable_id])

  const vatRegistered = useVatRegistered()
  const cycleDays = currentBillingCycleDays()
  const rawHayValue =
    contract.hay_item && contract.included_hay_kg
      ? hayValueIncVat(
          contract.hay_item.price,
          contract.included_hay_kg,
          cycleDays,
          contract.hay_item.vat_exempt || !vatRegistered,
        )
      : 0
  const rawBeddingValue =
    contract.bedding_item && contract.bedding_quantity
      ? beddingAmountIncVat(
          contract.bedding_item.price,
          contract.bedding_quantity,
          contract.bedding_item.vat_exempt || !vatRegistered,
        )
      : 0
  const hayValue = horseIsAway ? 0 : rawHayValue
  const beddingValue = horseIsAway ? 0 : rawBeddingValue
  const rent = horseIsAway ? (emptyBoxRate ?? 0) : contract.monthly_rent
  const period = currentBillingPeriod()
  const services = [
    {
      key: 'mucking',
      label: t('contractForm.serviceMucking'),
      schedule: contract.mucking_schedule,
      item: contract.mucking_item,
    },
    {
      key: 'turnout',
      label: t('contractForm.serviceTurnout'),
      schedule: contract.turnout_schedule,
      item: contract.turnout_item,
    },
  ].map((service) => ({
    ...service,
    amount: horseIsAway
      ? 0
      : serviceAmountIncVat({
          schedule: service.schedule,
          price: service.item?.price,
          unit: service.item?.unit,
          ...period,
          vatExempt: Boolean(service.item?.vat_exempt) || !vatRegistered,
        }),
    days: scheduleDaysInPeriod(service.schedule, period.startIso, period.endIso),
  }))
  const total =
    Math.round(
      (rent +
        hayValue +
        beddingValue +
        services.reduce((sum, service) => sum + service.amount, 0)) *
        100,
    ) / 100

  return (
    <div className="space-y-6">
      {contract.stable && (
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            {contract.stable.name}
          </h2>
          <p className="text-sm text-slate-500">
            {[
              contract.stable.address,
              contract.stable.postal_code,
              contract.stable.city,
            ]
              .filter(Boolean)
              .join(', ')}
          </p>
          <p className="text-sm text-slate-500">
            {[contract.stable.phone, contract.stable.email]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {contract.stable.org_number && (
            <p className="text-sm text-slate-500">
              {t('settings.billingOrgNumber')}: {contract.stable.org_number}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="field-label">{t('contractForm.horse')}</span>
          <p className="text-slate-900">{contract.horse?.name ?? '—'}</p>
          {contract.horse &&
            [
              contract.horse.breed,
              contract.horse.color,
              contract.horse.gender,
              contract.horse.microchip_number
                ? `${t('contractView.microchipNumber')}: ${contract.horse.microchip_number}`
                : null,
            ].some(Boolean) && (
              <p className="text-slate-500">
                {[
                  contract.horse.breed,
                  contract.horse.color,
                  contract.horse.gender,
                  contract.horse.microchip_number
                    ? `${t('contractView.microchipNumber')}: ${contract.horse.microchip_number}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}
        </div>
        <div>
          <span className="field-label">{t('contractForm.owner')}</span>
          <p className="text-slate-900">{contract.owner?.full_name ?? '—'}</p>
          {contract.owner &&
            [
              contract.owner.address,
              contract.owner.postal_code,
              contract.owner.city,
            ]
              .filter(Boolean)
              .join(', ') && (
              <p className="text-slate-500">
                {[
                  contract.owner.address,
                  contract.owner.postal_code,
                  contract.owner.city,
                ]
                  .filter(Boolean)
                  .join(', ')}
              </p>
            )}
          {[contract.owner?.phone, contract.owner?.email].some(Boolean) && (
            <p className="text-slate-500">
              {[contract.owner?.phone, contract.owner?.email]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
        </div>
        <div>
          <span className="field-label">
            {contract.turnout_shelter
              ? t('contractView.turnoutShelter')
              : t('contractView.stall')}
          </span>
          <p className="text-slate-900">
            {contract.turnout_shelter?.name ??
              contract.stall?.stall_number ??
              '—'}
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
      </div>

      <div className="rounded-2xl bg-slate-50 p-4">
        <h3 className="text-sm font-semibold text-slate-800">
          {t('contractForm.summaryTitle')}
        </h3>
        <div className="mt-2 space-y-1 text-sm text-slate-600">
          <div className="flex justify-between">
            <span>
              {t('contractForm.summaryRent')}
              {!horseIsAway && contract.boarding_item && (
                <span className="text-slate-400">
                  {' '}
                  — {contract.boarding_item.item}
                  {vatRegistered && contract.boarding_item.vat_exempt
                    ? ` (${t('common.vatExempt')})`
                    : ''}
                </span>
              )}
            </span>
            <span>{formatCurrency(rent)}</span>
          </div>
          {horseIsAway && (
            <p className="text-xs text-orange-600">
              {t('contractForm.emptyBoxSummaryNote')}
            </p>
          )}
          {hayValue > 0 && (
            <div className="flex justify-between">
              <span>
                {t('contractForm.summaryHay', {
                  kg: contract.included_hay_kg ?? 0,
                  days: cycleDays,
                })}
                {contract.hay_item && (
                  <span className="text-slate-400">
                    {' '}
                    — {contract.hay_item.item}
                    {vatRegistered && contract.hay_item.vat_exempt
                      ? ` (${t('common.vatExempt')})`
                      : ''}
                  </span>
                )}
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
                {contract.bedding_item && (
                  <span className="text-slate-400">
                    {' '}
                    — {contract.bedding_item.item}
                    {vatRegistered && contract.bedding_item.vat_exempt
                      ? ` (${t('common.vatExempt')})`
                      : ''}
                  </span>
                )}
              </span>
              <span>{formatCurrency(beddingValue)}</span>
            </div>
          )}
          {services
            .filter((service) => service.amount > 0)
            .map((service) => (
              <div key={service.key} className="flex justify-between">
                <span>
                  {service.label} (
                  {t(`contractForm.serviceSchedule_${service.schedule}`)})
                  {service.item && (
                    <span className="text-slate-400">
                      {' '}
                      — {service.item.item}
                      {vatRegistered && service.item.vat_exempt
                        ? ` (${t('common.vatExempt')})`
                        : ''}
                    </span>
                  )}
                </span>
                <span>{formatCurrency(service.amount)}</span>
              </div>
            ))}
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

      {contract.contract_terms && (
        <div>
          <span className="field-label">
            {t('contractView.contractTerms')}
          </span>
          <p className="whitespace-pre-wrap text-sm text-slate-700">
            {contract.contract_terms}
          </p>
        </div>
      )}

      <div className="pt-6">
        <span className="field-label">{t('contractView.signatureTitle')}</span>
        <p className="mt-4 border-b border-slate-300 pb-8 text-sm text-slate-400">
          {t('contractView.signaturePlaceDate')}
        </p>
        <div className="mt-8 grid grid-cols-2 gap-8">
          <div>
            <p className="border-b border-slate-300 pb-8" />
            <p className="mt-2 text-xs text-slate-500">
              {t('contractView.signatureStableOwner')}
            </p>
          </div>
          <div>
            <p className="border-b border-slate-300 pb-8" />
            <p className="mt-2 text-xs text-slate-500">
              {t('contractView.signatureHorseOwner')}
            </p>
          </div>
        </div>
      </div>
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
