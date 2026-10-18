import { useEffect, useState, type FormEvent } from 'react'
import { Icon } from '../../components/Icon'
import { Modal } from '../../components/Modal'
import {
  createTurnoutShelter,
  deleteTurnoutShelter,
  listTurnoutShelters,
  updateTurnoutShelter,
  type TurnoutShelterWithHorses,
} from '../../features/turnoutShelters/api'
import { usePreferences } from '../../lib/PreferencesContext'
import { getCurrentStableId } from '../../lib/stableContext'

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

function ShelterFields({
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
        <span className="field-label">{t('turnoutShelterView.name')}</span>
        <input
          required
          className="field"
          value={form.name}
          onChange={(e) => onChange('name', e.target.value)}
        />
      </label>
      <label>
        <span className="field-label">{t('turnoutShelterView.size')}</span>
        <input
          className="field"
          placeholder={t('turnoutShelterView.sizePlaceholder')}
          value={form.size}
          onChange={(e) => onChange('size', e.target.value)}
        />
      </label>
      <label>
        <span className="field-label">{t('turnoutShelterView.notes')}</span>
        <textarea
          className="field min-h-24"
          value={form.notes}
          onChange={(e) => onChange('notes', e.target.value)}
        />
      </label>
    </div>
  )
}

export function TurnoutShelterSection() {
  const { t } = usePreferences()
  const [shelters, setShelters] = useState<TurnoutShelterWithHorses[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState<FormState>(emptyForm)
  const [addSaving, setAddSaving] = useState(false)

  const [selected, setSelected] = useState<TurnoutShelterWithHorses | null>(
    null,
  )
  const [editForm, setEditForm] = useState<FormState>(emptyForm)
  const [editSaving, setEditSaving] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  function loadShelters() {
    setLoading(true)
    listTurnoutShelters()
      .then(setShelters)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    listTurnoutShelters()
      .then(setShelters)
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
      if (!stableId) throw new Error(t('turnoutShelterView.noStableFound'))
      await createTurnoutShelter({
        name: addForm.name,
        size: addForm.size || null,
        notes: addForm.notes || null,
        stable_id: stableId,
      })
      setAddOpen(false)
      setAddForm(emptyForm)
      loadShelters()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setAddSaving(false)
    }
  }

  function openShelter(shelter: TurnoutShelterWithHorses) {
    setSelected(shelter)
    setDeleteError(null)
    setEditForm({
      name: shelter.name,
      size: shelter.size ?? '',
      notes: shelter.notes ?? '',
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
      await updateTurnoutShelter(selected.id, {
        name: editForm.name,
        size: editForm.size || null,
        notes: editForm.notes || null,
      })
      setSelected(null)
      loadShelters()
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
      setDeleteError(t('turnoutShelterView.unassignFirst'))
      return
    }
    if (
      !window.confirm(
        t('turnoutShelterView.confirmDelete', { name: selected.name }),
      )
    )
      return
    await deleteTurnoutShelter(selected.id)
    setSelected(null)
    loadShelters()
  }

  const selectedHorses = selected?.horses.filter((h) => h.active) ?? []

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">
            {t('turnoutShelterView.title')}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {t('turnoutShelterView.subtitle')}
          </p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => setAddOpen(true)}
        >
          <Icon name="plus" className="h-4 w-4" />
          {t('turnoutShelterView.addShelter')}
        </button>
      </div>

      {loading && (
        <p className="mt-4 text-sm text-slate-500">
          {t('turnoutShelterView.loading')}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-600">
          {error}
        </p>
      )}

      {!loading && !error && shelters.length === 0 && (
        <div className="panel mt-4 p-10 text-center text-sm text-slate-500">
          {t('turnoutShelterView.noShelters')}
        </div>
      )}

      {!loading && !error && shelters.length > 0 && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {shelters.map((shelter) => {
            const horses = shelter.horses.filter((h) => h.active)
            return (
              <button
                key={shelter.id}
                onClick={() => openShelter(shelter)}
                className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-left text-sky-900 shadow-card"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm tracking-[0.25em] uppercase">
                    {t('turnoutShelterView.shelterLabel')}
                  </p>
                  <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-700">
                    {t('turnoutShelterView.horseCount', {
                      count: horses.length,
                    })}
                  </span>
                </div>
                <h3 className="mt-3 text-2xl font-semibold">{shelter.name}</h3>
                <p className="mt-2 text-sm opacity-80">
                  {shelter.size || t('turnoutShelterView.noSizeSet')}
                </p>
                <p className="mt-4 text-sm opacity-80">
                  {horses.length > 0
                    ? horses.map((h) => h.name).join(', ')
                    : t('turnoutShelterView.empty')}
                </p>
              </button>
            )
          })}
        </div>
      )}

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={t('turnoutShelterView.addShelter')}
      >
        <form onSubmit={handleAddSubmit} className="grid gap-4">
          <ShelterFields form={addForm} onChange={updateAddField} />
          <button type="submit" disabled={addSaving} className="btn-primary">
            {addSaving ? t('common.saving') : t('turnoutShelterView.addShelter')}
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
                {t('turnoutShelterView.currentHorses')}
              </span>{' '}
              {selectedHorses.length > 0
                ? selectedHorses.map((h) => h.name).join(', ')
                : t('turnoutShelterView.noneAssigned')}
            </div>
            <hr className="border-slate-200" />
            <form onSubmit={handleEditSubmit} className="grid gap-4">
              <ShelterFields form={editForm} onChange={updateEditField} />
              <button
                type="submit"
                disabled={editSaving}
                className="btn-primary"
              >
                {editSaving
                  ? t('common.saving')
                  : t('turnoutShelterView.saveChanges')}
              </button>
            </form>
            {deleteError && (
              <p className="text-sm text-red-600">{deleteError}</p>
            )}
            <button type="button" className="btn-ghost" onClick={handleDelete}>
              {t('turnoutShelterView.deleteShelter')}
            </button>
          </div>
        )}
      </Modal>
    </div>
  )
}
