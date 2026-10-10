import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { requestPasswordReset, signIn, signUp } from '../lib/authService'
import { useAuth } from '../lib/AuthContext'
import { usePreferences } from '../lib/PreferencesContext'

type Mode = 'login' | 'signup' | 'forgot'

export default function Auth() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const { t } = usePreferences()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    const pendingToken = sessionStorage.getItem('pendingInviteToken')
    navigate(pendingToken ? `/invite/${pendingToken}` : '/dashboard', {
      replace: true,
    })
  }, [session, navigate])

  function toggleMode() {
    setMode((prev) => (prev === 'login' ? 'signup' : 'login'))
    setError(null)
    setInfo(null)
  }

  function openForgotPassword() {
    setMode('forgot')
    setError(null)
    setInfo(null)
  }

  function backToSignIn() {
    setMode('login')
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
      } else if (mode === 'signup') {
        const result = await signUp({ email, password, fullName })
        if (result.session) {
          navigate('/dashboard')
        } else {
          setInfo(t('auth.confirmEmail'))
          setMode('login')
        }
      } else {
        await requestPasswordReset(email)
        setInfo(t('auth.resetLinkSent'))
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
            {mode === 'login'
              ? t('auth.welcomeBack')
              : mode === 'signup'
                ? t('auth.createAccount')
                : t('auth.resetPasswordTitle')}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {mode === 'login'
              ? t('auth.signInSubtitle')
              : mode === 'signup'
                ? t('auth.signUpSubtitle')
                : t('auth.resetPasswordSubtitle')}
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
          {mode !== 'forgot' && (
            <label>
              <span className="field-label">{t('auth.password')}</span>
              <div className="relative">
                <input
                  required
                  type={showPassword ? 'text' : 'password'}
                  minLength={6}
                  className="field pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={
                    showPassword
                      ? t('auth.hidePassword')
                      : t('auth.showPassword')
                  }
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
                >
                  <Icon
                    name={showPassword ? 'eyeOff' : 'eye'}
                    className="h-4 w-4"
                  />
                </button>
              </div>
            </label>
          )}
          {mode === 'login' && (
            <div className="text-right">
              <button
                type="button"
                className="text-sm font-medium text-forest hover:underline"
                onClick={openForgotPassword}
              >
                {t('auth.forgotPassword')}
              </button>
            </div>
          )}
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
                : mode === 'signup'
                  ? t('auth.signUp')
                  : t('auth.sendResetLink')}
          </button>
        </form>
        {mode === 'forgot' ? (
          <p className="mt-4 text-center text-sm text-slate-500">
            <button
              type="button"
              className="font-medium text-forest hover:underline"
              onClick={backToSignIn}
            >
              {t('auth.backToSignIn')}
            </button>
          </p>
        ) : (
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
        )}
      </div>
    </div>
  )
}
