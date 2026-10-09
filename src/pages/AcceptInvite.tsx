import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { acceptInvite } from '../features/invites/api'
import { useAuth } from '../lib/AuthContext'
import { signOut } from '../lib/authService'
import { usePreferences } from '../lib/PreferencesContext'

export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>()
  const { t } = usePreferences()
  const { session, loading, profile, profileLoading, refreshProfile } =
    useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [accepting, setAccepting] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    if (loading || !token) return
    if (!session) {
      sessionStorage.setItem('pendingInviteToken', token)
      navigate('/auth', { replace: true })
    }
  }, [loading, session, token, navigate])

  async function handleAccept() {
    if (!token) return
    setAccepting(true)
    setError(null)
    try {
      await acceptInvite(token)
      sessionStorage.removeItem('pendingInviteToken')
      await refreshProfile()
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setAccepting(false)
    }
  }

  async function handleUseDifferentAccount() {
    if (!token) return
    setSigningOut(true)
    sessionStorage.setItem('pendingInviteToken', token)
    await signOut()
    navigate('/auth', { replace: true })
  }

  if (loading || !session || profileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream px-4 py-10">
        <div className="panel w-full max-w-md p-6 text-center">
          <h1 className="text-xl font-semibold text-slate-900">
            {t('invite.title')}
          </h1>
          <p className="mt-3 text-sm text-slate-500">{t('invite.loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4 py-10">
      <div className="panel w-full max-w-md p-6 text-center">
        <h1 className="text-xl font-semibold text-slate-900">
          {t('invite.title')}
        </h1>
        <p className="mt-3 text-sm text-slate-500">
          {t('invite.signedInAs', { email: session.user.email ?? '' })}
        </p>
        {profile?.stable_id && (
          <p className="mt-2 text-sm text-amber-700">
            {t('invite.alreadyInStableWarning')}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-600">
            {t('invite.failed', { error })}
          </p>
        )}
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            disabled={accepting || signingOut}
            onClick={handleAccept}
            className="btn-primary w-full"
          >
            {accepting
              ? t('invite.accepting')
              : t('invite.acceptAs', { email: session.user.email ?? '' })}
          </button>
          <button
            type="button"
            disabled={accepting || signingOut}
            onClick={handleUseDifferentAccount}
            className="btn-ghost w-full"
          >
            {t('invite.useDifferentAccount')}
          </button>
        </div>
      </div>
    </div>
  )
}
