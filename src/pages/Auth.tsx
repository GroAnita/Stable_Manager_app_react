import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { signIn, signUp } from '../lib/authService'
import { useAuth } from '../lib/AuthContext'
import { usePreferences } from '../lib/PreferencesContext'

type Mode = 'login' | 'signup'

export default function Auth() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const { t } = usePreferences()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  useEffect(() => {
    if (session) navigate('/dashboard', { replace: true })
  }, [session, navigate])

  function toggleMode() {
    setMode((prev) => (prev === 'login' ? 'signup' : 'login'))
    setError(null)
    setInfo(null)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setInfo(null)
    try {
      if (mode === 'login') {
        await signIn({ email, password })
        navigate('/dashboard')
      } else {
        const result = await signUp({ email, password, fullName })
        if (result.session) {
          navigate('/dashboard')
        } else {
          setInfo(t('auth.confirmEmail'))
          setMode('login')
        }
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold text-forest">
            {mode === 'login' ? t('auth.welcomeBack') : t('auth.createAccount')}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {mode === 'login'
              ? t('auth.signInSubtitle')
              : t('auth.signUpSubtitle')}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="panel space-y-4 p-6">
          {mode === 'signup' && (
            <label>
              <span className="field-label">{t('auth.fullName')}</span>
              <input
                required
                className="field"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </label>
          )}
          <label>
            <span className="field-label">{t('auth.email')}</span>
            <input
              required
              type="email"
              className="field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            <span className="field-label">{t('auth.password')}</span>
            <input
              required
              type="password"
              minLength={6}
              className="field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {info && <p className="text-sm text-emerald-700">{info}</p>}
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full"
          >
            {submitting
              ? t('auth.pleaseWait')
              : mode === 'login'
                ? t('auth.signIn')
                : t('auth.signUp')}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500">
          {mode === 'login' ? t('auth.noAccount') : t('auth.haveAccount')}
          <button
            type="button"
            className="font-medium text-forest hover:underline"
            onClick={toggleMode}
          >
            {mode === 'login' ? t('auth.signUp') : t('auth.signIn')}
          </button>
        </p>
      </div>
    </div>
  )
}
