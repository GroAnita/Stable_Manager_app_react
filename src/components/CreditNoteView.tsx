import { useEffect, useState } from 'react'
import {
  getCreditNote,
  type CreditNoteDetail,
} from '../features/payments/creditNotes'
import { usePreferences } from '../lib/PreferencesContext'
import { Icon } from './Icon'
import { Modal } from './Modal'

function CreditNoteFields({ note }: { note: CreditNoteDetail }) {
  const { t, formatCurrency, formatDate } = usePreferences()
  const stable = note.stable
  const owner = note.payment?.owner
  const showVat = Boolean(stable?.vat_registered)
  const lines = [...note.lines].sort((a, b) => a.position - b.position)
  const negative = (amount: number) => `−${formatCurrency(amount)}`

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          {stable?.logo_url && (
            <img
              src={stable.logo_url}
              alt=""
              className="mb-2 h-12 w-12 rounded-xl object-cover"
            />
          )}
          <h2 className="text-lg font-semibold text-slate-900">
            {stable?.name ?? '—'}
          </h2>
          {stable && (
            <>
              <p className="text-sm text-slate-500">
                {[stable.address, stable.postal_code, stable.city]
                  .filter(Boolean)
                  .join(', ')}
              </p>
              {stable.org_number && (
                <p className="text-sm text-slate-500">
                  {stable.org_number}
                  {stable.vat_registered ? ` ${t('invoice.vatSuffix')}` : ''}
                </p>
              )}
              <p className="text-sm text-slate-500">
                {[stable.phone, stable.email].filter(Boolean).join(' · ')}
              </p>
            </>
          )}
        </div>
        <div className="shrink-0 text-right">
          <h1 className="text-2xl font-bold text-slate-900">
            {t('creditNote.title')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {note.credit_note_number}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="field-label">{t('invoice.billTo')}</span>
          <p className="font-medium text-slate-900">
            {owner?.full_name ?? '—'}
          </p>
          {owner && (
            <p className="text-slate-500">
              {[owner.address, owner.postal_code, owner.city]
                .filter(Boolean)
                .join(', ')}
            </p>
          )}
        </div>
        <div>
          <span className="field-label">{t('creditNote.date')}</span>
          <p className="text-slate-900">{formatDate(note.issued_on)}</p>
          <span className="field-label mt-3 block">
            {t('creditNote.originalInvoice')}
          </span>
          <p className="text-slate-900">
            {note.payment?.invoice_number ?? '—'}
            {note.payment
              ? ` (${formatDate(note.payment.created_at.slice(0, 10))})`
              : ''}
          </p>
        </div>
      </div>

      <div className="text-sm">
        <span className="field-label">{t('creditNote.reason')}</span>
        <p className="whitespace-pre-wrap text-slate-900">{note.reason}</p>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="py-2 font-medium">{t('invoice.description')}</th>
            {showVat && (
              <th className="py-2 text-right font-medium">
                {t('invoice.vat')}
              </th>
            )}
            <th className="py-2 text-right font-medium">
              {t('invoice.amount')}
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id} className="border-b border-slate-100">
              <td className="py-2 text-slate-700">{line.description}</td>
              {showVat && (
                <td className="py-2 text-right text-slate-500">
                  {t(`invoice.vatCode_${line.vat_code}`)}
                </td>
              )}
              <td className="py-2 text-right text-slate-700">
                {negative(line.amount_gross)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          {showVat && (
            <>
              <tr>
                <td colSpan={2} className="pt-3 text-slate-600">
                  {t('invoice.totalNet')}
                </td>
                <td className="pt-3 text-right text-slate-600">
                  {negative(note.amount_net)}
                </td>
              </tr>
              <tr>
                <td colSpan={2} className="pt-1 text-slate-600">
                  {t('invoice.vat')}
                </td>
                <td className="pt-1 text-right text-slate-600">
                  {negative(note.vat_amount)}
                </td>
              </tr>
            </>
          )}
          <tr>
            <td
              colSpan={showVat ? 2 : 1}
              className="pt-3 font-semibold text-slate-900"
            >
              {t('creditNote.total')}
            </td>
            <td className="pt-3 text-right font-semibold text-slate-900">
              {negative(note.amount_gross)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

export function CreditNoteView({
  creditNoteId,
  onClose,
}: {
  creditNoteId: string | null
  onClose: () => void
}) {
  const { t } = usePreferences()
  const [note, setNote] = useState<CreditNoteDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!creditNoteId) return
    let cancelled = false
    getCreditNote(creditNoteId)
      .then((data) => {
        if (!cancelled) {
          setNote(data)
          setError(null)
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [creditNoteId])

  const current = note && note.id === creditNoteId ? note : null

  return (
    <>
      <Modal
        open={creditNoteId !== null}
        onClose={onClose}
        title={t('creditNote.title')}
        size="lg"
      >
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        {!current && !error && (
          <p className="text-sm text-slate-500">{t('common.loading')}</p>
        )}
        {current && (
          <>
            <div className="mb-4 flex justify-end">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => window.print()}
              >
                <Icon name="fileText" className="h-4 w-4" />
                {t('invoice.print')}
              </button>
            </div>
            <CreditNoteFields note={current} />
          </>
        )}
      </Modal>
      {current && (
        <div className="print-area hidden print:block">
          <CreditNoteFields note={current} />
        </div>
      )}
    </>
  )
}
