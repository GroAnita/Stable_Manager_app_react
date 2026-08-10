import { Link } from 'react-router-dom'
import { usePreferences } from '../lib/PreferencesContext'

export default function NotFound() {
  const { t } = usePreferences()
  return (
    <div>
      <h2 className="text-2xl font-semibold text-ink">{t('notFound.title')}</h2>
      <Link
        to="/dashboard"
        className="mt-2 inline-block text-forest hover:underline"
      >
        {t('notFound.backToDashboard')}
      </Link>
    </div>
  )
}
