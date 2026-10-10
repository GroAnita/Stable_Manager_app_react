import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Badge } from '../components/Badge'
import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/Icon'
import {
  deleteOwner,
  getOwner,
  getOwnerHorses,
  type Owner,
  type OwnerHorse,
} from '../features/owners/api'
import { createOwnerInvite, inviteUrl } from '../features/invites/api'
import { useAuth } from '../lib/AuthContext'
import { usePreferences } from '../lib/PreferencesContext'

export default function OwnerDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = usePreferences()
  const { session, profile } = useAuth()
  const [owner, setOwner] = useState<Owner | null>(null)
  const [horses, setHorses] = useState<OwnerHorse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [invite, setInvite] = useState<string | null>(null)
  const [inviteSaving, setInviteSaving] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    Promise.all([getOwner(id), getOwnerHorses(id)])
      .then(([ownerData, horsesData]) => {
        if (cancelled) return
        setOwner(ownerData)
        setHorses(horsesData)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  async function handleDelete() {
    if (
      !id ||
      !owner ||
      !window.confirm(t('ownerDetail.confirmDelete', { name: owner.full_name }))
    )
      return
    await deleteOwner(id)
    navigate('/owners')
  }

  async function handleGenerateInvite() {
    if (!owner || !profile?.stable_id || !session) return
    setInviteSaving(true)
    setInviteError(null)
    try {
      const created = await createOwnerInvite({
        stableId: profile.stable_id,
        createdBy: session.user.id,
        ownerId: owner.id,
      })
      setInvite(inviteUrl(created.token))
    } catch (err) {
      setInviteError((err as Error).message)
    } finally {
      setInviteSaving(false)
    }
  }

  if (loading)
    return <p className="text-sm text-slate-500">{t('ownerDetail.loading')}</p>
  if (error)
    return (
      <p role="alert" className="text-sm text-red-600">
        {t('ownerDetail.failedToLoad', { error })}
      </p>
    )
  if (!owner)
    return <p className="text-sm text-slate-500">{t('ownerDetail.notFound')}</p>

  const contactFields: [string, string][] = [
    [t('ownerDetail.phone'), owner.phone ?? '—'],
    [t('ownerDetail.email'), owner.email ?? '—'],
    [
      t('ownerDetail.address'),
      [owner.address, owner.postal_code, owner.city]
        .filter(Boolean)
        .join(', ') || '—',
    ],
    [t('ownerDetail.emergencyContact'), owner.emergency_contact ?? '—'],
    [t('ownerDetail.emergencyPhone'), owner.emergency_phone ?? '—'],
  ]

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="text-sm tracking-[0.25em] text-slate-400 uppercase">
            {t('ownerDetail.profile')}
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">
            {owner.full_name}
          </h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to={`/owners/${owner.id}/edit`} className="btn-ghost">
            <Icon name="edit" className="h-4 w-4" />
            {t('ownerDetail.edit')}
          </Link>
          <button
            type="button"
            onClick={handleDelete}
            className="btn-secondary"
          >
            <Icon name="trash" className="h-4 w-4" />
            {t('ownerDetail.deleteOwner')}
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1.4fr]">
        <div className="space-y-6">
          <div className="panel p-5">
            <h2 className="section-title">{t('ownerDetail.contactInfo')}</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              {contactFields.map(([label, value]) => (
                <p key={label}>
                  <span className="font-medium text-slate-800">{label}:</span>{' '}
                  {value}
                </p>
              ))}
            </div>
          </div>
          {owner.notes && (
            <div className="panel p-5">
              <h2 className="section-title">{t('ownerDetail.notes')}</h2>
              <p className="mt-3 text-sm text-slate-600">{owner.notes}</p>
            </div>
          )}

          <div className="panel p-5">
            <h2 className="section-title">{t('ownerDetail.portalAccess')}</h2>
            {owner.user_id ? (
              <p className="mt-3 text-sm text-slate-500">
                {t('ownerDetail.portalLinked')}
              </p>
            ) : invite ? (
              <div className="mt-3 space-y-2">
                <p className="text-sm text-slate-500">
                  {t('ownerDetail.portalInviteReady')}
                </p>
                <input
                  readOnly
                  className="field text-xs"
                  value={invite}
                  onFocus={(e) => e.target.select()}
                />
              </div>
            ) : (
              <>
                <p className="mt-2 text-sm text-slate-500">
                  {t('ownerDetail.portalInviteHint')}
                </p>
                {inviteError && (
                  <p role="alert" className="mt-2 text-sm text-red-600">
                    {inviteError}
                  </p>
                )}
                <button
                  type="button"
                  disabled={inviteSaving}
                  onClick={handleGenerateInvite}
                  className="btn-ghost mt-3"
                >
                  {inviteSaving
                    ? t('common.saving')
                    : t('ownerDetail.generateInvite')}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="panel p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="section-title">{t('ownerDetail.horsesOwned')}</h2>
            <span className="text-sm text-slate-400">
              {t('ownerDetail.horseCount', { count: horses.length })}
            </span>
          </div>
          {horses.length === 0 ? (
            <EmptyState
              title={t('ownerDetail.noHorsesTitle')}
              message={t('ownerDetail.noHorsesMessage')}
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {horses.map((horse) => (
                <Link
                  key={horse.id}
                  to={`/horses/${horse.id}`}
                  className="rounded-2xl border border-slate-100 p-4 hover:bg-slate-50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-slate-900">{horse.name}</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge status={horse.status} />
                      {horse.away && <Badge status="away" />}
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {horse.breed ?? '—'} · {t('horseList.stall')}{' '}
                    {horse.stall?.stall_number ?? '—'}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
