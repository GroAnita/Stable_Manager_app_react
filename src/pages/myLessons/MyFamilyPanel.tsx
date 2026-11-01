import { useEffect, useState, type FormEvent } from 'react'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { EmptyState } from '../../components/EmptyState'
import { Icon } from '../../components/Icon'
import { Modal } from '../../components/Modal'
import { getMyOwnerRecord } from '../../features/owners/api'
import {
  createRider,
  deleteRider,
  listRiders,
  updateRider,
  type Rider,
} from '../../features/riders/api'
import { usePreferences } from '../../lib/PreferencesContext'

type RiderFormState = { full_name: string; birthday: string; notes: string }

function emptyForm(): RiderFormState {
  return { full_name: '', birthday: '', notes: '' }
}

function toForm(rider: Rider): RiderFormState {
  return {
    full_name: rider.full_name,
    birthday: rider.birthday ?? '',
    notes: rider.notes ?? '',
  }
}

export function MyFamilyPanel() {
  const { t, formatDate } = usePreferences()
  const [ownerId, setOwnerId] = useState<string | null>(null)
  const [riders, setRiders] = useState<Rider[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState<RiderFormState>(emptyForm)
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const [editing, setEditing] = useState<Rider | null>(null)
  const [editForm, setEditForm] = useState<RiderFormState>(emptyForm)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<Rider | null>(null)

  function load() {
    setLoading(true)
    getMyOwnerRecord()
      .then((owner) => {
        setOwnerId(owner?.id ?? null)
        return owner ? listRiders(owner.id) : []
      })
      .then(setRiders)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  function openAdd() {
    setAddForm(emptyForm())
    setAddError(null)
    setAddOpen(true)
  }

  async function handleAddSubmit(event: FormEvent) {
    event.preventDefault()
    if (!ownerId) return
    setAddSaving(true)
    setAddError(null)
    try {
      const created = await createRider({
        owner_id: ownerId,
        full_name: addForm.full_name,
        birthday: addForm.birthday || null,
        notes: addForm.notes || null,
      })
      setRiders((prev) => [...prev, created])
      setAddOpen(false)
    } catch (err) {
      setAddError((err as Error).message)
    } finally {
      setAddSaving(false)
    }
  }

  function openEdit(rider: Rider) {
    setEditing(rider)
    setEditForm(toForm(rider))
    setEditError(null)
  }

  async function handleEditSubmit(event: FormEvent) {
    event.preventDefault()
    if (!editing) return
    setEditSaving(true)
    setEditError(null)
    try {
      const updated = await updateRider(editing.id, {
        full_name: editForm.full_name,
        birthday: editForm.birthday || null,
        notes: editForm.notes || null,
      })
      setRiders((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
      setEditing(null)
    } catch (err) {
      setEditError((err as Error).message)
    } finally {
      setEditSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    await deleteRider(deleteTarget.id)
    setRiders((prev) => prev.filter((r) => r.id !== deleteTarget.id))
    if (editing?.id === deleteTarget.id) setEditing(null)
    setDeleteTarget(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{t('myFamily.subtitle')}</p>
        <button type="button" className="btn-primary" onClick={openAdd}>
          <Icon name="plus" className="h-4 w-4" />
          {t('myFamily.addRider')}
        </button>
      </div>

      {loading && <p className="text-sm text-slate-500">{t('lessons.loading')}</p>}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {!loading && !error && riders.length === 0 && (
        <EmptyState
          title={t('myFamily.noRidersTitle')}
          message={t('myFamily.noRidersMessage')}
        />
      )}

      {!loading && !error && riders.length > 0 && (
        <div className="panel space-y-3 p-5">
          {riders.map((rider) => (
            <button
              key={rider.id}
              type="button"
              onClick={() => openEdit(rider)}
              className="flex w-full items-center justify-between rounded-2xl border border-slate-100 p-4 text-left hover:bg-card"
            >
              <div>
                <p className="font-medium text-slate-900">{rider.full_name}</p>
                {rider.birthday && (
                  <p className="mt-1 text-sm text-slate-500">
                    {formatDate(rider.birthday)}
                  </p>
                )}
              </div>
              <Icon name="chevronRight" className="h-4 w-4 text-slate-400" />
            </button>
          ))}
        </div>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={t('myFamily.addRider')}>
        <form onSubmit={handleAddSubmit} className="grid gap-4">
          {addError && (
            <p role="alert" className="text-sm text-red-600">
              {addError}
            </p>
          )}
          <label>
            <span className="field-label">{t('myFamily.fullName')}</span>
            <input
              required
              className="field"
              value={addForm.full_name}
              onChange={(e) =>
                setAddForm((prev) => ({ ...prev, full_name: e.target.value }))
              }
            />
          </label>
          <label>
            <span className="field-label">{t('myFamily.birthday')}</span>
            <input
              type="date"
              className="field"
              value={addForm.birthday}
              onChange={(e) =>
                setAddForm((prev) => ({ ...prev, birthday: e.target.value }))
              }
            />
          </label>
          <label>
            <span className="field-label">{t('myFamily.notes')}</span>
            <textarea
              className="field"
              value={addForm.notes}
              onChange={(e) => setAddForm((prev) => ({ ...prev, notes: e.target.value }))}
            />
          </label>
          <button type="submit" disabled={addSaving} className="btn-primary">
            {addSaving ? t('common.saving') : t('common.save')}
          </button>
        </form>
      </Modal>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.full_name ?? ''}
      >
        <form onSubmit={handleEditSubmit} className="grid gap-4">
          {editError && (
            <p role="alert" className="text-sm text-red-600">
              {editError}
            </p>
          )}
          <label>
            <span className="field-label">{t('myFamily.fullName')}</span>
            <input
              required
              className="field"
              value={editForm.full_name}
              onChange={(e) =>
                setEditForm((prev) => ({ ...prev, full_name: e.target.value }))
              }
            />
          </label>
          <label>
            <span className="field-label">{t('myFamily.birthday')}</span>
            <input
              type="date"
              className="field"
              value={editForm.birthday}
              onChange={(e) =>
                setEditForm((prev) => ({ ...prev, birthday: e.target.value }))
              }
            />
          </label>
          <label>
            <span className="field-label">{t('myFamily.notes')}</span>
            <textarea
              className="field"
              value={editForm.notes}
              onChange={(e) =>
                setEditForm((prev) => ({ ...prev, notes: e.target.value }))
              }
            />
          </label>
          <button type="submit" disabled={editSaving} className="btn-primary">
            {editSaving ? t('common.saving') : t('common.save')}
          </button>
        </form>
        <button
          type="button"
          className="btn-ghost mt-4"
          onClick={() => editing && setDeleteTarget(editing)}
        >
          {t('common.delete')}
        </button>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title={t('myFamily.deleteRiderTitle')}
        message={t('myFamily.confirmDelete')}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
