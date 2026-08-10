import { usePreferences } from '../lib/PreferencesContext'

export default function TaskList() {
  const { t } = usePreferences()
  return <h2 className="text-2xl font-semibold text-ink">{t('nav.tasks')}</h2>
}
