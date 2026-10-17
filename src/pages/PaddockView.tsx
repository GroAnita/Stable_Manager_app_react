import { useEffect, useState, type FormEvent } from 'react'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import {
  createPaddock,
  deletePaddock,
  listPaddocks,
  updatePaddock,
  type PaddockWithHorses,
} from '../features/paddocks/api'
import { usePreferences } from '../lib/PreferencesContext'
import { getCurrentStableId } from '../lib/stableContext'

type FormState = {
  name: string
  size: string
  notes: string
}

const emptyForm: FormState = {
  name: '',
  size: '',
  notes: '',
}

function PaddockFields({
  form,
  onChange,
}: {
  form: FormState
  onChange: <K extends keyof FormState>(key: K, value: FormState[K]) => void
}) {
  const { t } = usePreferences()
  return (
    <div className="grid gap-4">
      <label>
        <span className="field-label">{t('paddockView.name')}</span>
        <input
          required
          className="field"
          value={form.name}
          onChange={(e) => onChange('name', e.target.value)}
        />
      </label>
      <label>
        <span className="field-label">{t('paddockView.size')}</span>
        <input
          className="field"
          placeholder={t('paddockView.sizePlaceholder')}
          value={form.size}
          onChange={(e) => onChange('size', e.target.value)}
        />
      </label>
      <label>
        <span className="field-label">{t('paddockView.notes')}</span>
        <textarea
          className="field min-h-24"
          value={form.notes}
          onChange={(e) => onChange('notes', e.target.value)}
        />
      </label>
    </div>
  )
}

export default function PaddockView() {
  const { t } = usePreferences()
  const [paddocks, setPaddocks] = useState<PaddockWithHorses[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState<FormState>(emptyForm)
  const [addSaving, setAddSaving] = useState(false)

  const [selected, setSelected] = useState<PaddockWithHorses | null>(null)
  const [editForm, setEditForm] = useState<FormState>(emptyForm)
  const [editSaving, setEditSaving] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  function loadPaddocks() {
    setLoading(true)
    listPaddocks()
      .then(setPaddocks)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    listPaddocks()
      .then(setPaddocks)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  function updateAddField<K extends keyof FormState>(
    key: K,
    value: FormState[K],
  ) {
    setAddForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleAddSubmit(event: FormEvent) {
    event.preventDefault()
    setAddSaving(true)
    try {
      const stableId = await getCurrentStableId()
      if (!stableId) throw new Error(t('paddockView.noStableFound'))
      await createPaddock({
        name: addForm.name,
        size: addForm.size || null,
        notes: addForm.notes || null,
        stable_id: stableId,
      })
      setAddOpen(false)
      setAddForm(emptyForm)
      loadPaddocks()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setAddSaving(false)
    }
  }

  function openPaddock(paddock: PaddockWithHorses) {
    setSelected(paddock)
    setDeleteError(null)
    setEditForm({
      name: paddock.name,
      size: paddock.size ?? '',
      notes: paddock.notes ?? '',
    })
  }

  function updateEditField<K extends keyof FormState>(
    key: K,
    value: FormState[K],
  ) {
    setEditForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleEditSubmit(event: FormEvent) {
    event.preventDefault()
    if (!selected) return
    setEditSaving(true)
    try {
      await updatePaddock(selected.id, {
        name: editForm.name,
        size: editForm.size || null,
        notes: editForm.notes || null,
      })
      setSelected(null)
      loadPaddocks()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setEditSaving(false)
    }
  }

  async function handleDelete() {
    if (!selected) return
    const activeHorses = selected.horses.filter((h) => h.active)
    if (activeHorses.length > 0) {
      setDeleteError(t('paddockView.unassignFirst'))
      return
    }
    if (
      !window.confirm(t('paddockView.confirmDelete', { name: selected.name }))
    )
      return
    await deletePaddock(selected.id)
    setSelected(null)
    loadPaddocks()
  }

  const selectedHorses = selected?.horses.filter((h) => h.active) ?? []

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">
            {t('paddockView.title')}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {t('paddockView.subtitle')}
          </p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => setAddOpen(true)}
        >
          <Icon name="plus" className="h-4 w-4" />
          {t('paddockView.addPaddock')}
        </button>
      </div>

      {loading && (
        <p className="text-sm text-slate-500">{t('paddockView.loading')}</p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      {!loading && !error && paddocks.length === 0 && (
        <div className="panel p-10 text-center text-sm text-slate-500">
          {t('paddockView.noPaddocks')}
        </div>
      )}

      {!loading && !error && paddocks.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {paddocks.map((paddock) => {
            const horses = paddock.horses.filter((h) => h.active)
            return (
              <button
                key={paddock.id}
                onClick={() => openPaddock(paddock)}
                className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-left text-emerald-900 shadow-card"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm tracking-[0.25em] uppercase">
                    {t('paddockView.paddockLabel')}
                  </p>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    {t('paddockView.horseCount', { count: horses.length })}
                  </span>
                </div>
                <h3 className="mt-3 text-2xl font-semibold">
                  {paddock.name}
                </h3>
                <p className="mt-2 text-sm opacity-80">
                  {paddock.size || t('paddockView.noSizeSet')}
                </p>
                <p className="mt-4 text-sm opacity-80">
                  {horses.length > 0
                    ? horses.map((h) => h.name).join(', ')
                    : t('paddockView.empty')}
                </p>
              </button>
            )
          })}
        </div>
      )}

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={t('paddockView.addPaddock')}
      >
        <form onSubmit={handleAddSubmit} className="grid gap-4">
          <PaddockFields form={addForm} onChange={updateAddField} />
          <button type="submit" disabled={addSaving} className="btn-primary">
            {addSaving ? t('common.saving') : t('paddockView.addPaddock')}
          </button>
        </form>
      </Modal>

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? selected.name : ''}
      >
        {selected && (
          <div className="space-y-4 text-sm text-slate-600">
            <div>
              <span className="font-medium text-slate-800">
                {t('paddockView.currentHorses')}
              </span>{' '}
              {selectedHorses.length > 0
                ? selectedHorses.map((h) => h.name).join(', ')
                : t('paddockView.noneAssigned')}
            </div>
            <hr className="border-slate-200" />
            <form onSubmit={handleEditSubmit} className="grid gap-4">
              <PaddockFields form={editForm} onChange={updateEditField} />
              <button
                type="submit"
                disabled={editSaving}
                className="btn-primary"
              >
                {editSaving ? t('common.saving') : t('paddockView.saveChanges')}
              </button>
            </form>
            {deleteError && (
              <p className="text-sm text-red-600">{deleteError}</p>
            )}
            <button type="button" className="btn-ghost" onClick={handleDelete}>
              {t('paddockView.deletePaddock')}
            </button>
          </div>
        )}
      </Modal>
    </div>
  )
}
