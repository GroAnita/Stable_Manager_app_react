import { useEffect, useState, type FormEvent } from 'react'
import { Icon } from '../../components/Icon'
import { Modal } from '../../components/Modal'
import {
  createStaffInvite,
  getActiveStaffInvite,
  inviteUrl,
} from '../../features/invites/api'
import {
  createStaff,
  listStaff,
  removeStaff,
  setStaffRole,
  type Staff,
  type StaffRole,
} from '../../features/staff/api'
import { usePreferences } from '../../lib/PreferencesContext'

type AddForm = {
  fullName: string
  phone: string
  email: string
  role: StaffRole
}

function emptyForm(): AddForm {
  return { fullName: '', phone: '', email: '', role: 'stable_employee' }
}

export function StaffAccessPanel({
  stableId,
  createdBy,
}: {
  stableId: string
  createdBy: string
}) {
  const { t } = usePreferences()
  const [staff, setStaff] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState<AddForm>(emptyForm())
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [addedInvite, setAddedInvite] = useState<{
    name: string
    link: string
  } | null>(null)

  const [inviteLinks, setInviteLinks] = useState<Record<string, string>>({})
  const [inviteLoadingId, setInviteLoadingId] = useState<string | null>(null)

  function refetch() {
    listStaff()
      .then(setStaff)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(refetch, [])

  function openAdd() {
    setAddForm(emptyForm())
    setAddError(null)
    setAddedInvite(null)
    setAddOpen(true)
  }

  function updateAddField<K extends keyof AddForm>(
    key: K,
    value: AddForm[K],
  ) {
    setAddForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleAddSubmit(event: FormEvent) {
    event.preventDefault()
    setAddSaving(true)
    setAddError(null)
    try {
      const created = await createStaff({
        stableId,
        fullName: addForm.fullName,
        phone: addForm.phone,
        email: addForm.email,
        role: addForm.role,
      })
      const invite = await createStaffInvite({
        stableId,
        createdBy,
        staffId: created.id,
      })
      setAddedInvite({
        name: created.full_name,
        link: inviteUrl(invite.token),
      })
      refetch()
    } catch (err) {
      setAddError((err as Error).message)
    } finally {
      setAddSaving(false)
    }
  }

  async function handleRoleChange(member: Staff, role: StaffRole) {
    setError(null)
    try {
      await setStaffRole(member.id, role)
      refetch()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function handleRemove(member: Staff) {
    const confirmKey = member.user_id
      ? 'settings.staffRemoveConfirm'
      : 'settings.staffRemoveConfirmPending'
    if (!window.confirm(t(confirmKey, { name: member.full_name }))) return
    setError(null)
    try {
      await removeStaff(member)
      refetch()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function handleShowInvite(member: Staff) {
    setInviteLoadingId(member.id)
    setError(null)
    try {
      let invite = await getActiveStaffInvite(member.id)
      if (!invite) {
        invite = await createStaffInvite({
          stableId,
          createdBy,
          staffId: member.id,
        })
      }
      setInviteLinks((prev) => ({
        ...prev,
        [member.id]: inviteUrl(invite!.token),
      }))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setInviteLoadingId(null)
    }
  }

  return (
    <div className="panel p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="section-title">{t('settings.navStaffAccess')}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {t('settings.staffInviteHint')}
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={openAdd}>
          <Icon name="plus" className="h-4 w-4" />
          {t('settings.staffAddButton')}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-4 text-sm text-slate-500">{t('common.loading')}</p>
      ) : staff.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          {t('settings.staffEmpty')}
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {staff.map((member) => (
            <div key={member.id} className="rounded-2xl bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">
                    {member.full_name}
                  </p>
                  <p className="text-sm text-slate-500">
                    {[member.phone, member.email].filter(Boolean).join(' · ') ||
                      '—'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      member.user_id
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {member.user_id
                      ? t('settings.staffStatusActive')
                      : t('settings.staffStatusPending')}
                  </span>
                  <select
                    className="field"
                    value={member.role}
                    onChange={(e) =>
                      handleRoleChange(member, e.target.value as StaffRole)
                    }
                  >
                    <option value="stable_owner">
                      {t('settings.staffRoleAdmin')}
                    </option>
                    <option value="stable_employee">
                      {t('settings.staffRoleEmployee')}
                    </option>
                  </select>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => handleRemove(member)}
                  >
                    {t('common.remove')}
                  </button>
                </div>
              </div>

              {!member.user_id && (
                <div className="mt-3">
                  {inviteLinks[member.id] ? (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-slate-600">
                        {t('settings.staffInviteReady', {
                          name: member.full_name,
                        })}
                      </p>
                      <input
                        readOnly
                        className="field text-xs"
                        value={inviteLinks[member.id]}
                        onFocus={(e) => e.target.select()}
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn-ghost"
                      disabled={inviteLoadingId === member.id}
                      onClick={() => handleShowInvite(member)}
                    >
                      {inviteLoadingId === member.id
                        ? t('common.saving')
                        : t('settings.staffGenerateInvite')}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={t('settings.staffAddButton')}
      >
        {addedInvite ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              {t('settings.staffInviteReady', { name: addedInvite.name })}
            </p>
            <input
              readOnly
              className="field text-xs"
              value={addedInvite.link}
              onFocus={(e) => e.target.select()}
            />
            <button
              type="button"
              className="btn-primary w-full"
              onClick={() => setAddOpen(false)}
            >
              {t('common.close')}
            </button>
          </div>
        ) : (
          <form onSubmit={handleAddSubmit} className="grid gap-4">
            {addError && (
              <p role="alert" className="text-sm text-red-600">
                {addError}
              </p>
            )}
            <label>
              <span className="field-label">
                {t('settings.staffFullName')}
              </span>
              <input
                required
                className="field"
                value={addForm.fullName}
                onChange={(e) => updateAddField('fullName', e.target.value)}
              />
            </label>
            <label>
              <span className="field-label">{t('settings.phone')}</span>
              <input
                type="tel"
                className="field"
                value={addForm.phone}
                onChange={(e) => updateAddField('phone', e.target.value)}
              />
            </label>
            <label>
              <span className="field-label">{t('settings.email')}</span>
              <input
                type="email"
                className="field"
                value={addForm.email}
                onChange={(e) => updateAddField('email', e.target.value)}
              />
            </label>
            <label>
              <span className="field-label">{t('settings.staffRole')}</span>
              <select
                className="field"
                value={addForm.role}
                onChange={(e) =>
                  updateAddField('role', e.target.value as StaffRole)
                }
              >
                <option value="stable_employee">
                  {t('settings.staffRoleEmployee')}
                </option>
                <option value="stable_owner">
                  {t('settings.staffRoleAdmin')}
                </option>
              </select>
            </label>
            <button type="submit" disabled={addSaving} className="btn-primary">
              {addSaving ? t('common.saving') : t('settings.staffAddButton')}
            </button>
          </form>
        )}
      </Modal>
    </div>
  )
}
