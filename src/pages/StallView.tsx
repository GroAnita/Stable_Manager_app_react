import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Badge } from '../components/Badge'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import {
  createStall,
  deleteStall,
  listStalls,
  updateStall,
  type Stall,
  type StallWithHorses,
} from '../features/stalls/api'
import { usePreferences } from '../lib/PreferencesContext'
import { getCurrentStableId } from '../lib/stableContext'

type StallStatus = Stall['status']
type Filter = 'all' | StallStatus

const STATUS_OPTIONS: StallStatus[] = [
  'available',
  'occupied',
  'reserved',
  'maintenance',
]

const CARD_PALETTE: Record<StallStatus, string> = {
  available: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  occupied: 'bg-amber-50 border-amber-200 text-amber-900',
  reserved: 'bg-sky-50 border-sky-200 text-sky-900',
  maintenance: 'bg-red-50 border-red-200 text-red-900',
}

type FormState = {
  stall_number: string
  size: string
  status: StallStatus
  notes: string
}

const emptyForm: FormState = {
  stall_number: '',
  size: '',
  status: 'available',
  notes: '',
}

function StallFields({
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
        <span className="field-label">{t('stallView.stallNumber')}</span>
        <input
          required
          className="field"
          value={form.stall_number}
          onChange={(e) => onChange('stall_number', e.target.value)}
        />
      </label>
      <label>
        <span className="field-label">{t('stallView.size')}</span>
        <input
          className="field"
          placeholder={t('stallView.sizePlaceholder')}
          value={form.size}
          onChange={(e) => onChange('size', e.target.value)}
        />
      </label>
      <label>
        <span className="field-label">{t('stallView.status')}</span>
        <select
          className="field"
          value={form.status}
          onChange={(e) => onChange('status', e.target.value as StallStatus)}
        >
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {t(`status.${status}`)}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="field-label">{t('stallView.notes')}</span>
        <textarea
          className="field min-h-24"
          value={form.notes}
          onChange={(e) => onChange('notes', e.target.value)}
        />
      </label>
    </div>
  )
}

export default function StallView() {
  const { t } = usePreferences()
  const [stalls, setStalls] = useState<StallWithHorses[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')

  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState<FormState>(emptyForm)
  const [addSaving, setAddSaving] = useState(false)

  const [selected, setSelected] = useState<StallWithHorses | null>(null)
  const [editForm, setEditForm] = useState<FormState>(emptyForm)
  const [editSaving, setEditSaving] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  function loadStalls() {
    setLoading(true)
    listStalls()
      .then(setStalls)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    listStalls()
      .then(setStalls)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(
    () =>
      filter === 'all' ? stalls : stalls.filter((s) => s.status === filter),
    [stalls, filter],
  )

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
      if (!stableId) throw new Error(t('stallView.noStableFound'))
      await createStall({ ...addForm, stable_id: stableId })
      setAddOpen(false)
      setAddForm(emptyForm)
      loadStalls()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setAddSaving(false)
    }
  }

  function openStall(stall: StallWithHorses) {
    setSelected(stall)
    setDeleteError(null)
    setEditForm({
      stall_number: stall.stall_number,
      size: stall.size ?? '',
      status: stall.status,
      notes: stall.notes ?? '',
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
      await updateStall(selected.id, editForm)
      setSelected(null)
      loadStalls()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setEditSaving(false)
    }
  }

  async function handleDelete() {
    if (!selected) return
    const currentHorse = selected.horses.find((h) => h.active)
    if (currentHorse) {
      setDeleteError(t('stallView.unassignFirst'))
      return
    }
    if (
      !window.confirm(
        t('stallView.confirmDelete', { number: selected.stall_number }),
      )
    )
      return
    await deleteStall(selected.id)
    setSelected(null)
    loadStalls()
  }

  const selectedHorse = selected?.horses.find((h) => h.active) ?? null

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">
            {t('stallView.title')}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {t('stallView.subtitle')}
          </p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => setAddOpen(true)}
        >
          <Icon name="plus" className="h-4 w-4" />
          {t('stallView.addStall')}
        </button>
      </div>

      <div className="panel p-4">
        <select
          className="field max-w-xs"
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
        >
          <option value="all">{t('stallView.allStalls')}</option>
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {t(`status.${status}`)}
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <p className="text-sm text-slate-500">{t('stallView.loading')}</p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="panel p-10 text-center text-sm text-slate-500">
          {t('stallView.noStalls')}
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((stall) => {
            const horse = stall.horses.find((h) => h.active)
            return (
              <button
                key={stall.id}
                onClick={() => openStall(stall)}
                className={`rounded-2xl border p-4 text-left shadow-card ${CARD_PALETTE[stall.status]}`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm tracking-[0.25em] uppercase">
                    {t('stallView.stallLabel')}
                  </p>
                  <Badge status={stall.status} />
                </div>
                <h3 className="mt-3 text-2xl font-semibold">
                  {stall.stall_number}
                </h3>
                <p className="mt-2 text-sm opacity-80">
                  {stall.size || t('stallView.noSizeSet')}
                </p>
                <p className="mt-4 text-sm opacity-80">
                  {horse
                    ? horse.name
                    : stall.status === 'available'
                      ? t('stallView.ready')
                      : t(`status.${stall.status}`)}
                </p>
              </button>
            )
          })}
        </div>
      )}

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={t('stallView.addStall')}
      >
        <form onSubmit={handleAddSubmit} className="grid gap-4">
          <StallFields form={addForm} onChange={updateAddField} />
          <button type="submit" disabled={addSaving} className="btn-primary">
            {addSaving ? t('common.saving') : t('stallView.addStall')}
          </button>
        </form>
      </Modal>

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={
          selected
            ? `${t('stallView.stallLabel')} ${selected.stall_number}`
            : ''
        }
      >
        {selected && (
          <div className="space-y-4 text-sm text-slate-600">
            <div>
              <span className="font-medium text-slate-800">
                {t('stallView.currentHorse')}
              </span>{' '}
              {selectedHorse?.name ?? t('stallView.noneAssigned')}
            </div>
            <div>
              <span className="font-medium text-slate-800">
                {t('stallView.owner')}
              </span>{' '}
              {selectedHorse?.owner?.full_name ?? '—'}
            </div>
            <hr className="border-slate-200" />
            <form onSubmit={handleEditSubmit} className="grid gap-4">
              <StallFields form={editForm} onChange={updateEditField} />
              <button
                type="submit"
                disabled={editSaving}
                className="btn-primary"
              >
                {editSaving ? t('common.saving') : t('stallView.saveChanges')}
              </button>
            </form>
            {deleteError && (
              <p className="text-sm text-red-600">{deleteError}</p>
            )}
            <button type="button" className="btn-ghost" onClick={handleDelete}>
              {t('stallView.deleteStall')}
            </button>
          </div>
        )}
      </Modal>
    </div>
  )
}
