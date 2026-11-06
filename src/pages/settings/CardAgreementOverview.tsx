import { useEffect, useState } from 'react'
import {
  listCardAgreementOverview,
  withdrawCardAgreement,
} from '../../features/payments/cardAgreement'
import { useConfirm } from '../../lib/ConfirmContext'
import type {
  OverviewLine,
  OverviewStatus,
} from '../../lib/cardAgreementOverview'
import { usePreferences } from '../../lib/PreferencesContext'

const STATUS_STYLES: Record<OverviewStatus, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  paused: 'bg-amber-100 text-amber-700',
  waitingForCard: 'bg-amber-100 text-amber-700',
  withdrawn: 'bg-slate-100 text-slate-600',
  notSigned: 'bg-slate-100 text-slate-600',
}

function cardLabel(line: OverviewLine): string {
  const { agreement, status } = line
  if (!agreement?.card_last4 || (status !== 'active' && status !== 'paused')) {
    return '—'
  }
  const brand = agreement.card_brand ?? ''
  return `${brand.charAt(0).toUpperCase()}${brand.slice(1)} •••• ${agreement.card_last4}`.trim()
}

export function CardAgreementOverview() {
  const { t, formatDate } = usePreferences()
  const [lines, setLines] = useState<OverviewLine[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const confirm = useConfirm()
  const [stopping, setStopping] = useState<string | null>(null)

  useEffect(() => {
    listCardAgreementOverview()
      .then(setLines)
      .catch((err: Error) => setError(err.message))
  }, [])

  async function handleStop(line: OverviewLine) {
    if (
      !(await confirm(
        t('settings.paymentsStopConfirm', { name: line.ownerName }),
        { confirmLabel: t('settings.paymentsStop') },
      ))
    )
      return
    setStopping(line.id)
    setError(null)
    try {
      await withdrawCardAgreement(line.id)
      setLines(await listCardAgreementOverview())
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setStopping(null)
    }
  }

  const signed = lines?.filter(
    (line) => line.status === 'active' || line.status === 'paused',
  ).length

  return (
    <div className="space-y-3 border-t border-slate-100 pt-4">
      <h3 className="text-sm font-semibold text-slate-900">
        {t('settings.paymentsSignedTitle')}
      </h3>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {!lines && !error && (
        <p className="text-sm text-slate-500">
          {t('settings.paymentsLoading')}
        </p>
      )}
      {lines?.length === 0 && (
        <p className="text-sm text-slate-500">
          {t('settings.paymentsSignedEmpty')}
        </p>
      )}
      {lines && lines.length > 0 && (
        <>
          <p className="text-sm text-slate-500">
            {t('settings.paymentsSignedCount', {
              signed: signed ?? 0,
              total: lines.length,
            })}
          </p>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('settings.paymentsSignedOwner')}</th>
                  <th>{t('settings.paymentsSignedHorse')}</th>
                  <th>{t('settings.paymentsSignedStatus')}</th>
                  <th>{t('settings.paymentsSignedCard')}</th>
                  <th>{t('settings.paymentsSignedChargeDay')}</th>
                  <th>{t('settings.paymentsSignedDate')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const inForce =
                    line.status === 'active' || line.status === 'paused'
                  return (
                    <tr key={line.id}>
                      <td>{line.ownerName}</td>
                      <td>{line.horseName}</td>
                      <td>
                        <span
                          className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[line.status]}`}
                        >
                          {t(`settings.paymentsSignedStatus_${line.status}`)}
                        </span>
                        {line.status === 'withdrawn' &&
                          line.agreement?.card_removal_error && (
                            <p className="mt-1 text-xs text-amber-700">
                              {t('settings.paymentsCardNotRemoved')}
                            </p>
                          )}
                      </td>
                      <td className="whitespace-nowrap">{cardLabel(line)}</td>
                      <td>
                        {inForce && line.agreement
                          ? t('settings.paymentsChargeDayOption', {
                              day: line.agreement.charge_day,
                            })
                          : '—'}
                      </td>
                      <td className="whitespace-nowrap">
                        {inForce && line.agreement
                          ? formatDate(line.agreement.accepted_at.slice(0, 10))
                          : '—'}
                      </td>
                      <td>
                        {inForce && (
                          <button
                            type="button"
                            className="btn-ghost whitespace-nowrap px-3 py-1.5"
                            disabled={stopping === line.id}
                            onClick={() => handleStop(line)}
                          >
                            {t('settings.paymentsStop')}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
