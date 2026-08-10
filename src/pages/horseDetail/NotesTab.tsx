import { useState, type FormEvent } from 'react'
import { Icon } from '../../components/Icon'
import { Modal } from '../../components/Modal'
import { updateHorse } from '../../features/horses/api'
import { usePreferences } from '../../lib/PreferencesContext'

export function NotesTab({
  horseId,
  notes,
  onSaved,
}: {
  horseId: string
  notes: string | null
  onSaved: (notes: string | null) => void
}) {
  const { t } = usePreferences()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function openModal() {
    setValue(notes ?? '')
    setError(null)
    setOpen(true)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const updated = await updateHorse(horseId, { notes: value || null })
      onSaved(updated.notes)
      setOpen(false)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button type="button" className="btn-ghost" onClick={openModal}>
          <Icon name="edit" className="h-4 w-4" />
          {t('common.edit')}
        </button>
      </div>
      <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
        {notes || t('horseDetail.noFreeformNotes')}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t('horseDetail.editNotes')}
      >
        <form onSubmit={handleSubmit} className="grid gap-4">
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          <label>
            <span className="field-label">{t('horseDetail.notesLabel')}</span>
            <textarea
              className="field min-h-32"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </label>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </form>
      </Modal>
    </div>
  )
}
