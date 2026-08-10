import { usePreferences } from '../lib/PreferencesContext'

export default function CalendarView() {
  const { t } = usePreferences()
  return (
    <h2 className="text-2xl font-semibold text-ink">{t('nav.calendar')}</h2>
  )
}
