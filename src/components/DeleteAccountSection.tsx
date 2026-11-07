import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { deleteMyAccount } from '../features/settings/api'
import { usePreferences } from '../lib/PreferencesContext'
import { supabase } from '../lib/supabaseClient'

const CONFIRM_WORD = 'SLETT'

// Required by the App Store: every user can delete their own account in the app.
export function DeleteAccountSection({ ownsStable }: { ownsStable: boolean }) {
  const { t } = usePreferences()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    try {
      const result = await deleteMyAccount()
      // The user is gone or blocked, so only this device's session is left to clear.
      await supabase.auth.signOut({ scope: 'local' })
      navigate(
        `/auth?deleted=${result === 'stable_closed' ? 'stable' : 'account'}`,
        { replace: true },
      )
    } catch (err) {
      setError(
        (err as Error).message === 'stripe_unavailable'
          ? t('deleteAccount.errorStripe')
          : t('deleteAccount.errorGeneric'),
      )
      setDeleting(false)
    }
  }

  return (
    <div className="panel p-5">
      <h2 className="section-title">{t('deleteAccount.title')}</h2>
      <p className="mt-2 text-sm text-slate-600">
        {ownsStable
          ? t('deleteAccount.ownerBody')
          : t('deleteAccount.memberBody')}
      </p>
      {!open ? (
        <button
          type="button"
          className="btn-secondary mt-4"
          onClick={() => setOpen(true)}
        >
          {t('deleteAccount.start')}
        </button>
      ) : (
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="field-label">
              {t('deleteAccount.typeToConfirm', { word: CONFIRM_WORD })}
            </span>
            <input
              className="field"
              value={typed}
              autoCapitalize="characters"
              autoComplete="off"
              onChange={(e) => setTyped(e.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              disabled={deleting || typed.trim().toUpperCase() !== CONFIRM_WORD}
              onClick={handleDelete}
            >
              {deleting
                ? t('deleteAccount.deleting')
                : ownsStable
                  ? t('deleteAccount.buttonOwner')
                  : t('deleteAccount.button')}
            </button>
            <button
              type="button"
              className="btn-ghost"
              disabled={deleting}
              onClick={() => {
                setOpen(false)
                setTyped('')
                setError(null)
              }}
            >
              {t('deleteAccount.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
