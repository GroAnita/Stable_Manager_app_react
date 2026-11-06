import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import { CreditNoteView } from '../../components/CreditNoteView'
import {
  createAdditionalInvoice,
  createCreditNote,
  listCreditNotes,
  listInvoiceLines,
  sendCreditNote,
  type CreditNote,
} from '../../features/payments/creditNotes'
import { invoiceAmountDue } from '../../lib/billing'
import { useConfirm } from '../../lib/ConfirmContext'
import { usePreferences } from '../../lib/PreferencesContext'
import { useVatRegistered } from '../../lib/useVatRegistered'
import type { Database } from '../../types/supabase'

type InvoiceLine = Database['public']['Tables']['invoice_lines']['Row']

type PanelPayment = {
  id: string
  amount: number
  status: string
  charge_status: string | null
  credited_amount: number
  credited_after_payment: number
  refunded_amount: number
}

const KNOWN_ERRORS = [
  'credit_note_reason_required',
  'credit_note_lines_required',
  'credit_note_amount_invalid',
  'credit_note_amount_too_high',
  'charge_in_progress',
  'additional_invoice_description_required',
  'additional_invoice_period_invalid',
  'additional_invoice_due_too_soon',
]

function daysFromToday(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

export function CreditNotePanel({
  payment,
  canCreate,
  onChanged,
}: {
  payment: PanelPayment
  canCreate: boolean
  onChanged: () => void
}) {
  const { t, formatCurrency, formatDate } = usePreferences()
  const confirm = useConfirm()
  const vatRegistered = useVatRegistered()
  const [lines, setLines] = useState<InvoiceLine[]>([])
  const [notes, setNotes] = useState<CreditNote[]>([])
  const [viewing, setViewing] = useState<string | null>(null)
  const [mode, setMode] = useState<'none' | 'credit' | 'additional'>('none')
  const [creditAll, setCreditAll] = useState(true)
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [reason, setReason] = useState('')
  const [additional, setAdditional] = useState({
    description: '',
    amount: '',
    vatCode: 'standard',
    periodStart: '',
    periodEnd: '',
    dueDate: daysFromToday(8),
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(() => {
    Promise.all([listInvoiceLines(payment.id), listCreditNotes(payment.id)])
      .then(([lineRows, noteRows]) => {
        setLines(lineRows)
        setNotes(noteRows)
      })
      .catch((err: Error) => setError(err.message))
  }, [payment.id])

  useEffect(load, [load])

  const remaining = useMemo(() => {
    const credited = new Map<string, number>()
    for (const note of notes) {
      for (const line of note.lines) {
        credited.set(
          line.invoice_line_id,
          (credited.get(line.invoice_line_id) ?? 0) +
            Math.round(Number(line.amount_gross) * 100),
        )
      }
    }
    return lines.map((line) => ({
      line,
      left:
        (Math.round(Number(line.amount_gross) * 100) -
          (credited.get(line.id) ?? 0)) /
        100,
    }))
  }, [lines, notes])

  const open = remaining.filter((row) => row.left > 0)
  const toRefund =
    Math.round(
      (Number(payment.credited_after_payment) -
        Number(payment.refunded_amount)) *
        100,
    ) / 100

  function explain(err: unknown): string {
    const text = (err as Error).message
    const known = KNOWN_ERRORS.find((code) => text.includes(code))
    return known ? t(`creditNote.error_${known}`) : text
  }

  async function handleSend(id: string): Promise<boolean> {
    const sent = await sendCreditNote(id)
    if (!sent) setError(t('creditNote.emailFailed'))
    return sent
  }

  async function handleCredit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setMessage(null)
    const request = creditAll
      ? open.map((row) => ({ line_id: row.line.id, amount_gross: row.left }))
      : open.flatMap((row) => {
          const value = Number((amounts[row.line.id] ?? '').replace(',', '.'))
          return value > 0
            ? [{ line_id: row.line.id, amount_gross: value }]
            : []
        })
    const total =
      Math.round(
        request.reduce((sum, row) => sum + row.amount_gross, 0) * 100,
      ) / 100
    if (
      !(await confirm(
        t('creditNote.confirm', { amount: formatCurrency(total) }),
        { confirmLabel: t('creditNote.create') },
      ))
    )
      return
    setSaving(true)
    try {
      const id = await createCreditNote({
        paymentId: payment.id,
        reason,
        lines: request,
      })
      const sent = await handleSend(id).catch(() => false)
      setMessage(t(sent ? 'creditNote.created' : 'creditNote.createdNoEmail'))
      setMode('none')
      setReason('')
      setAmounts({})
      setCreditAll(true)
      load()
      onChanged()
    } catch (err) {
      setError(explain(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleAdditional(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setMessage(null)
    setSaving(true)
    try {
      await createAdditionalInvoice({
        paymentId: payment.id,
        description: additional.description,
        amountGross: Number(additional.amount.replace(',', '.')),
        vatCode: additional.vatCode,
        periodStart: additional.periodStart,
        periodEnd: additional.periodEnd,
        dueDate: additional.dueDate,
      })
      setMessage(t('creditNote.additionalCreated'))
      setMode('none')
      onChanged()
    } catch (err) {
      setError(explain(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleResend(id: string) {
    setError(null)
    try {
      if (await handleSend(id)) {
        setMessage(t('creditNote.emailSent'))
        load()
      }
    } catch (err) {
      setError(explain(err))
    }
  }

  // Older invoices have no lines to refer to.
  if (lines.length === 0 && notes.length === 0) return null

  return (
    <div className="space-y-3 border-t border-slate-100 pt-3">
      {notes.length > 0 && (
        <div className="space-y-2">
          <p className="font-medium text-slate-700">{t('creditNote.list')}</p>
          {notes.map((note) => (
            <div
              key={note.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="font-medium text-slate-800">
                  {note.credit_note_number} · −
                  {formatCurrency(note.amount_gross)}
                </p>
                <p className="text-xs text-slate-500">
                  {formatDate(note.issued_on)} · {note.reason}
                </p>
                {!note.email_sent_at && (
                  <p className="text-xs text-amber-700">
                    {t('creditNote.emailNotSent')}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {!note.email_sent_at && canCreate && (
                  <button
                    type="button"
                    className="btn-ghost px-3 py-1.5"
                    onClick={() => handleResend(note.id)}
                  >
                    {t('creditNote.sendEmail')}
                  </button>
                )}
                <button
                  type="button"
                  className="btn-ghost px-3 py-1.5"
                  onClick={() => setViewing(note.id)}
                >
                  {t('creditNote.view')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {toRefund > 0 && (
        <p className="font-medium text-amber-700">
          {t('creditNote.toRefund', { amount: formatCurrency(toRefund) })}
        </p>
      )}

      {error && (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      )}
      {message && <p className="text-forest">{message}</p>}

      {canCreate && mode === 'none' && (
        <div className="flex flex-wrap gap-2">
          {open.length > 0 && payment.charge_status !== 'processing' && (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setMode('credit')}
            >
              {t('creditNote.create')}
            </button>
          )}
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setMode('additional')}
          >
            {t('creditNote.additionalCreate')}
          </button>
        </div>
      )}

      {mode === 'credit' && (
        <form onSubmit={handleCredit} className="grid gap-3">
          <fieldset className="grid gap-1">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={creditAll}
                onChange={() => setCreditAll(true)}
              />
              {t('creditNote.creditAll', {
                amount: formatCurrency(
                  open.reduce((sum, row) => sum + row.left, 0),
                ),
              })}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={!creditAll}
                onChange={() => setCreditAll(false)}
              />
              {t('creditNote.creditLines')}
            </label>
          </fieldset>
          {!creditAll &&
            open.map(({ line, left }) => (
              <label key={line.id}>
                <span className="field-label">
                  {line.description} (
                  {t('creditNote.lineLeft', { amount: formatCurrency(left) })})
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={left}
                  className="field"
                  value={amounts[line.id] ?? ''}
                  onChange={(e) =>
                    setAmounts((prev) => ({
                      ...prev,
                      [line.id]: e.target.value,
                    }))
                  }
                />
              </label>
            ))}
          <label>
            <span className="field-label">{t('creditNote.reason')}</span>
            <textarea
              required
              className="field"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <p className="text-xs text-slate-500">{t('creditNote.hint')}</p>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? t('common.saving') : t('creditNote.create')}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setMode('none')}
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      )}

      {mode === 'additional' && (
        <form onSubmit={handleAdditional} className="grid gap-3">
          <p className="text-xs text-slate-500">
            {t('creditNote.additionalHint')}
          </p>
          <label>
            <span className="field-label">{t('invoice.description')}</span>
            <input
              required
              className="field"
              value={additional.description}
              onChange={(e) =>
                setAdditional((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
            />
          </label>
          <label>
            <span className="field-label">
              {t('creditNote.additionalAmount')}
            </span>
            <input
              required
              type="number"
              step="0.01"
              min="0.01"
              className="field"
              value={additional.amount}
              onChange={(e) =>
                setAdditional((prev) => ({ ...prev, amount: e.target.value }))
              }
            />
          </label>
          {vatRegistered && (
            <label>
              <span className="field-label">{t('priceList.vatCode')}</span>
              <select
                className="field"
                value={additional.vatCode}
                onChange={(e) =>
                  setAdditional((prev) => ({
                    ...prev,
                    vatCode: e.target.value,
                  }))
                }
              >
                {['standard', 'exempt', 'none'].map((value) => (
                  <option key={value} value={value}>
                    {t(`priceList.vatCode_${value}`)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="field-label">{t('creditNote.periodStart')}</span>
              <input
                required
                type="date"
                className="field"
                value={additional.periodStart}
                onChange={(e) =>
                  setAdditional((prev) => ({
                    ...prev,
                    periodStart: e.target.value,
                  }))
                }
              />
            </label>
            <label>
              <span className="field-label">{t('creditNote.periodEnd')}</span>
              <input
                required
                type="date"
                className="field"
                value={additional.periodEnd}
                onChange={(e) =>
                  setAdditional((prev) => ({
                    ...prev,
                    periodEnd: e.target.value,
                  }))
                }
              />
            </label>
          </div>
          <label>
            <span className="field-label">{t('invoice.dueDate')}</span>
            <input
              required
              type="date"
              min={daysFromToday(8)}
              className="field"
              value={additional.dueDate}
              onChange={(e) =>
                setAdditional((prev) => ({ ...prev, dueDate: e.target.value }))
              }
            />
          </label>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? t('common.saving') : t('creditNote.additionalCreate')}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setMode('none')}
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      )}

      {invoiceAmountDue(payment) <= 0 && payment.status !== 'paid' && (
        <p className="text-slate-500">{t('creditNote.fullyCredited')}</p>
      )}

      <CreditNoteView creditNoteId={viewing} onClose={() => setViewing(null)} />
    </div>
  )
}
