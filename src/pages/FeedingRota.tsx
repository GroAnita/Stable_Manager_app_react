import { useEffect, useState, type FormEvent } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import {
  createOwnerUnavailability,
  deleteOwnerUnavailability,
  listOwnerUnavailability,
  type OwnerUnavailability,
} from '../features/feedingRota/api'
import { listOwnerOptions } from '../lib/options'
import type { OwnerOption } from '../lib/options'
import { usePreferences } from '../lib/PreferencesContext'
import { getCurrentStableId } from '../lib/stableContext'
import { FeedingRotaDraft } from './feedingRota/FeedingRotaDraft'

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function FeedingRota() {
  const { t, formatDate } = usePreferences()

  const [unavailability, setUnavailability] = useState<OwnerUnavailability[]>(
    [],
  )
  const [owners, setOwners] = useState<OwnerOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [unavailabilityModalOpen, setUnavailabilityModalOpen] = useState(false)
  const [unavailabilityOwnerId, setUnavailabilityOwnerId] = useState('')
  const [unavailabilityStart, setUnavailabilityStart] = useState('')
  const [unavailabilityEnd, setUnavailabilityEnd] = useState('')
  const [unavailabilityReason, setUnavailabilityReason] = useState('')
  const [deletingUnavailabilityId, setDeletingUnavailabilityId] = useState<
    string | null
  >(null)

  function load() {
    Promise.all([listOwnerUnavailability(), listOwnerOptions()])
      .then(([unavail, ownerOpts]) => {
        setUnavailability(unavail)
        setOwners(ownerOpts)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  function openAddUnavailability() {
    setUnavailabilityOwnerId('')
    setUnavailabilityStart(todayIso())
    setUnavailabilityEnd(todayIso())
    setUnavailabilityReason('')
    setUnavailabilityModalOpen(true)
  }

  async function handleUnavailabilitySubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    try {
      const stableId = await getCurrentStableId()
      if (!stableId) throw new Error('No stable found.')
      await createOwnerUnavailability({
        stable_id: stableId,
        owner_id: unavailabilityOwnerId,
        start_date: unavailabilityStart,
        end_date: unavailabilityEnd,
        reason: unavailabilityReason || null,
      })
      setUnavailabilityModalOpen(false)
      load()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function handleDeleteUnavailability() {
    if (!deletingUnavailabilityId) return
    try {
      await deleteOwnerUnavailability(deletingUnavailabilityId)
      setDeletingUnavailabilityId(null)
      load()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  if (loading)
    return <p className="text-sm text-slate-500">{t('feedingRota.loading')}</p>

  return (
    <div className="page-shell">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">
          {t('feedingRota.title')}
        </h1>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="panel p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="section-title">
              {t('feedingRota.unavailabilityTitle')}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {t('feedingRota.unavailabilityHint')}
            </p>
          </div>
          <button
            type="button"
            className="btn-primary shrink-0"
            onClick={openAddUnavailability}
          >
            <Icon name="plus" className="h-4 w-4" />
            {t('feedingRota.addUnavailability')}
          </button>
        </div>
        {unavailability.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            {t('feedingRota.noUnavailability')}
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {unavailability.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-4 py-2.5"
              >
                <div>
                  <p className="font-medium text-slate-800">
                    {item.owner?.full_name ?? '—'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatDate(item.start_date)} – {formatDate(item.end_date)}
                    {item.reason ? ` · ${item.reason}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`${t('common.delete')}: ${item.owner?.full_name ?? ''}`}
                  className="text-slate-400 hover:text-red-600"
                  onClick={() => setDeletingUnavailabilityId(item.id)}
                >
                  <Icon name="trash" className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <FeedingRotaDraft unavailability={unavailability} />

      <Modal
        open={unavailabilityModalOpen}
        onClose={() => setUnavailabilityModalOpen(false)}
        title={t('feedingRota.addUnavailability')}
      >
        <form onSubmit={handleUnavailabilitySubmit} className="grid gap-4">
          <label>
            <span className="field-label">
              {t('feedingRota.unavailabilityOwner')}
            </span>
            <select
              required
              className="field"
              value={unavailabilityOwnerId}
              onChange={(e) => setUnavailabilityOwnerId(e.target.value)}
            >
              <option value="">{t('feedingRota.selectOwnerToAdd')}</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.full_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="field-label">
              {t('feedingRota.unavailabilityStart')}
            </span>
            <input
              required
              type="date"
              className="field"
              value={unavailabilityStart}
              onChange={(e) => setUnavailabilityStart(e.target.value)}
            />
          </label>
          <label>
            <span className="field-label">
              {t('feedingRota.unavailabilityEnd')}
            </span>
            <input
              required
              type="date"
              className="field"
              value={unavailabilityEnd}
              onChange={(e) => setUnavailabilityEnd(e.target.value)}
            />
          </label>
          <label>
            <span className="field-label">
              {t('feedingRota.unavailabilityReason')}
            </span>
            <input
              className="field"
              value={unavailabilityReason}
              onChange={(e) => setUnavailabilityReason(e.target.value)}
            />
          </label>
          <button type="submit" className="btn-primary">
            {t('common.save')}
          </button>
        </form>
      </Modal>

      <ConfirmDialog
        open={deletingUnavailabilityId !== null}
        title={t('feedingRota.addUnavailability')}
        message={t('feedingRota.deleteUnavailabilityConfirm')}
        onConfirm={handleDeleteUnavailability}
        onCancel={() => setDeletingUnavailabilityId(null)}
      />
    </div>
  )
}
