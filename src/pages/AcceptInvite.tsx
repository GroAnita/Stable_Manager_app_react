import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { acceptInvite } from '../features/invites/api'
import { useAuth } from '../lib/AuthContext'
import { usePreferences } from '../lib/PreferencesContext'

export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>()
  const { t } = usePreferences()
  const { session, loading, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const attempted = useRef(false)

  useEffect(() => {
    if (loading || !token) return
    if (!session) {
      sessionStorage.setItem('pendingInviteToken', token)
      navigate('/auth', { replace: true })
      return
    }
    if (attempted.current) return
    attempted.current = true
    acceptInvite(token)
      .then(() => {
        sessionStorage.removeItem('pendingInviteToken')
        return refreshProfile()
      })
      .then(() => {
        navigate('/dashboard', { replace: true })
      })
      .catch((err: Error) => {
        setError(err.message)
      })
  }, [loading, session, token, navigate, refreshProfile])

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4 py-10">
      <div className="panel w-full max-w-md p-6 text-center">
        <h1 className="text-xl font-semibold text-slate-900">
          {t('invite.title')}
        </h1>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-red-600">
            {t('invite.failed', { error })}
          </p>
        ) : (
          <p className="mt-3 text-sm text-slate-500">{t('invite.accepting')}</p>
        )}
      </div>
    </div>
  )
}
