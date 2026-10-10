import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { signOut, updatePassword } from '../lib/authService'
import { useAuth } from '../lib/AuthContext'
import { usePreferences } from '../lib/PreferencesContext'

export default function ResetPassword() {
  const navigate = useNavigate()
  const { session, loading } = useAuth()
  const { t } = usePreferences()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (password !== confirmPassword) {
      setError(t('auth.passwordsDontMatch'))
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await updatePassword(password)
      await signOut()
      setDone(true)
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
            {t('auth.setNewPasswordTitle')}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {t('auth.setNewPasswordSubtitle')}
          </p>
        </div>

        {loading ? (
          <p className="text-center text-sm text-slate-500">
            {t('auth.pleaseWait')}
          </p>
        ) : done ? (
          <div className="panel space-y-4 p-6 text-center">
            <p className="text-sm text-emerald-700">
              {t('auth.passwordUpdated')}
            </p>
            <button
              type="button"
              className="btn-primary w-full"
              onClick={() => navigate('/auth', { replace: true })}
            >
              {t('auth.backToSignIn')}
            </button>
          </div>
        ) : !session ? (
          <div className="panel space-y-4 p-6 text-center">
            <p className="text-sm text-red-600">{t('auth.invalidResetLink')}</p>
            <button
              type="button"
              className="btn-primary w-full"
              onClick={() => navigate('/auth', { replace: true })}
            >
              {t('auth.backToSignIn')}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="panel space-y-4 p-6">
            <label>
              <span className="field-label">{t('auth.newPassword')}</span>
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
            <label>
              <span className="field-label">{t('auth.confirmPassword')}</span>
              <input
                required
                type={showPassword ? 'text' : 'password'}
                minLength={6}
                className="field"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </label>
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
              {submitting ? t('auth.pleaseWait') : t('auth.savePassword')}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
