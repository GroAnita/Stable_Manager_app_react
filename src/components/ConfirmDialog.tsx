import { Modal } from './Modal'
import { usePreferences } from '../lib/PreferencesContext'

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const { t } = usePreferences()
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <p className="text-sm text-slate-600">{message}</p>
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" className="btn-ghost" onClick={onCancel}>
          {t('common.cancel')}
        </button>
        <button type="button" className="btn-secondary" onClick={onConfirm}>
          {confirmLabel ?? t('common.delete')}
        </button>
      </div>
    </Modal>
  )
}
