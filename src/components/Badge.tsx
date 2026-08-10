import { getStatusColor } from '../lib/statusColor'
import { usePreferences } from '../lib/PreferencesContext'

function capitalize(str: string): string {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : ''
}

export function Badge({ status, label }: { status: string; label?: string }) {
  const { t } = usePreferences()
  const statusKey = `status.${status}`
  const translated = t(statusKey)
  const display =
    label ||
    (translated === statusKey
      ? capitalize(status.replace(/_/g, ' '))
      : translated)
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getStatusColor(status)}`}
    >
      {display}
    </span>
  )
}
