import { useState } from 'react'
import {
  cancelContractNotice,
  giveContractNotice,
  noticeEndDatePreview,
  sendContractNoticeEmail,
} from '../features/contracts/api'
import { useConfirm } from '../lib/ConfirmContext'
import { usePreferences } from '../lib/PreferencesContext'

const KNOWN_ERRORS = [
  'notice_period_missing',
  'notice_already_given',
  'notice_end_date_past',
  'contract_not_running',
  'final_invoice_exists',
]

export function ContractNoticePanel({
  contract,
  role,
  onChanged,
}: {
  contract: {
    id: string
    status: string
    end_date: string | null
    notice_months: number | null
    notice_given_at: string | null
    notice_given_by_role: string | null
  }
  role: 'boarder' | 'stableOwner'
  onChanged: () => void
}) {
  const { t, formatDate } = usePreferences()
  const confirm = useConfirm()
  const preview =
    contract.notice_months === null
      ? null
      : noticeEndDatePreview(contract.notice_months)
  const [endDate, setEndDate] = useState(preview ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  function explain(err: unknown): string {
    const text = (err as Error).message
    const known = KNOWN_ERRORS.find((code) => text.includes(code))
    return known ? t(`contractNotice.error_${known}`) : text
  }

  async function handleGive() {
    const shownDate = role === 'boarder' ? preview : endDate
    if (!shownDate) return
    if (
      !(await confirm(
        t(
          role === 'boarder'
            ? 'contractNotice.confirmBoarder'
            : 'contractNotice.confirmStable',
          { date: formatDate(shownDate) },
        ),
        { confirmLabel: t('contractNotice.give') },
      ))
    )
      return
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      await giveContractNotice(
        contract.id,
        role === 'stableOwner' ? endDate : null,
      )
      const sent = await sendContractNoticeEmail(contract.id).catch(() => false)
      setMessage(
        t(sent ? 'contractNotice.given' : 'contractNotice.givenNoEmail'),
      )
      onChanged()
    } catch (err) {
      setError(explain(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleCancel() {
    if (
      !(await confirm(t('contractNotice.confirmCancel'), {
        confirmLabel: t('contractNotice.cancel'),
      }))
    )
      return
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      await cancelContractNotice(contract.id)
      setMessage(t('contractNotice.cancelled'))
      onChanged()
    } catch (err) {
      setError(explain(err))
    } finally {
      setSaving(false)
    }
  }

  if (!['active', 'ending_soon'].includes(contract.status)) return null

  return (
    <div className="mt-6 space-y-3 border-t border-slate-100 pt-4 text-sm">
      <h3 className="font-semibold text-slate-900">
        {t('contractNotice.title')}
      </h3>
      {error && (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      )}
      {message && <p className="text-forest">{message}</p>}

      {contract.notice_given_at && contract.end_date ? (
        <>
          <p className="font-medium text-amber-700">
            {t('contractNotice.endsOn', {
              date: formatDate(contract.end_date),
            })}
          </p>
          <p className="text-slate-500">
            {t(
              contract.notice_given_by_role === 'boarder'
                ? 'contractNotice.givenByBoarder'
                : 'contractNotice.givenByStable',
              { date: formatDate(contract.notice_given_at.slice(0, 10)) },
            )}{' '}
            {t('contractNotice.finalInvoiceHint')}
          </p>
          {role === 'stableOwner' && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-ghost"
                disabled={saving}
                onClick={handleCancel}
              >
                {t('contractNotice.cancel')}
              </button>
              <button
                type="button"
                className="btn-ghost"
                disabled={saving}
                onClick={() => {
                  setMessage(null)
                  sendContractNoticeEmail(contract.id)
                    .then((sent) =>
                      sent
                        ? setMessage(t('contractNotice.emailSent'))
                        : setError(t('contractNotice.emailFailed')),
                    )
                    .catch((err: Error) => setError(err.message))
                }}
              >
                {t('contractNotice.sendAgain')}
              </button>
            </div>
          )}
        </>
      ) : role === 'boarder' ? (
        preview ? (
          <>
            <p className="text-slate-600">
              {t('contractNotice.boarderHint', {
                months: contract.notice_months ?? 0,
                date: formatDate(preview),
              })}
            </p>
            <button
              type="button"
              className="btn-ghost"
              disabled={saving}
              onClick={handleGive}
            >
              {t('contractNotice.give')}
            </button>
          </>
        ) : (
          <p className="text-slate-500">
            {t('contractNotice.noPeriodBoarder')}
          </p>
        )
      ) : (
        <>
          <p className="text-slate-600">{t('contractNotice.stableHint')}</p>
          <label className="block max-w-xs">
            <span className="field-label">{t('contractNotice.endDate')}</span>
            <input
              type="date"
              className="field"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn-ghost"
            disabled={saving || !endDate}
            onClick={handleGive}
          >
            {t('contractNotice.register')}
          </button>
        </>
      )}
    </div>
  )
}
