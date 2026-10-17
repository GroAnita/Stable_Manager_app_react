import { useEffect, useState } from 'react'
import {
  addAdditionalOwner,
  listAdditionalOwners,
  removeAdditionalOwner,
  type AdditionalOwner,
} from '../../features/horses/api'
import { listOwners, type Owner } from '../../features/owners/api'
import { usePreferences } from '../../lib/PreferencesContext'

export function AdditionalOwnersCard({
  horseId,
  primaryOwnerId,
}: {
  horseId: string
  primaryOwnerId: string | null
}) {
  const { t } = usePreferences()
  const [additionalOwners, setAdditionalOwners] = useState<AdditionalOwner[]>(
    [],
  )
  const [allOwners, setAllOwners] = useState<Owner[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([listAdditionalOwners(horseId), listOwners()])
      .then(([additional, owners]) => {
        setAdditionalOwners(additional)
        setAllOwners(owners)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [horseId])

  const availableOwners = allOwners.filter(
    (owner) =>
      owner.id !== primaryOwnerId &&
      !additionalOwners.some((added) => added.id === owner.id),
  )

  async function handleAdd() {
    if (!selected) return
    setSaving(true)
    setError(null)
    try {
      const owner = await addAdditionalOwner(horseId, selected)
      setAdditionalOwners((prev) => [...prev, owner])
      setSelected('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove(ownerId: string) {
    setError(null)
    try {
      await removeAdditionalOwner(horseId, ownerId)
      setAdditionalOwners((prev) => prev.filter((o) => o.id !== ownerId))
    } catch (err) {
      setError((err as Error).message)
    }
  }

  if (loading) return null

  return (
    <div className="border-t border-slate-100 pt-6">
      <h2 className="section-title">{t('horseDetail.additionalOwners')}</h2>
      <p className="mt-1 text-sm text-slate-500">
        {t('horseDetail.additionalOwnersHint')}
      </p>

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="mt-3 space-y-2">
        {additionalOwners.length === 0 ? (
          <p className="text-sm text-slate-500">
            {t('horseDetail.noAdditionalOwners')}
          </p>
        ) : (
          additionalOwners.map((owner) => (
            <div
              key={owner.id}
              className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3"
            >
              <p className="font-medium text-slate-900">{owner.full_name}</p>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => handleRemove(owner.id)}
              >
                {t('common.remove')}
              </button>
            </div>
          ))
        )}
      </div>

      {additionalOwners.length < 2 && availableOwners.length > 0 && (
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <label className="min-w-50 flex-1">
            <span className="field-label">
              {t('horseDetail.addAdditionalOwner')}
            </span>
            <select
              className="field"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">{t('horseDetail.selectOwner')}</option>
              {availableOwners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.full_name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn-primary"
            disabled={!selected || saving}
            onClick={handleAdd}
          >
            {saving ? t('common.saving') : t('common.add')}
          </button>
        </div>
      )}
    </div>
  )
}
