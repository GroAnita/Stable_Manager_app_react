import { useRouteError } from 'react-router-dom'
import { usePreferences } from '../lib/PreferencesContext'

export default function RouteError() {
  const error = useRouteError()
  const { t } = usePreferences()

  if (import.meta.env.DEV) console.error(error)

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-cream p-6 text-center">
      <p className="text-lg font-semibold text-slate-900">
        {t('routeError.title')}
      </p>
      <p className="max-w-md text-sm text-slate-500">
        {t('routeError.message')}
      </p>
      <button
        type="button"
        className="btn-primary"
        onClick={() => window.location.reload()}
      >
        {t('routeError.reload')}
      </button>
    </div>
  )
}
