import { useState } from 'react'
import { Toggle } from '../../components/Toggle'
import { updateStable, type Stable } from '../../features/settings/api'
import { ALL_FEATURES, isFeatureEnabled } from '../../lib/features'
import { usePreferences } from '../../lib/PreferencesContext'

export function FeaturesPanel({
  stable,
  canEdit,
  onUpdate,
}: {
  stable: Stable
  canEdit: boolean
  onUpdate: (stable: Stable) => void
}) {
  const { t } = usePreferences()
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleToggle(key: string, checked: boolean) {
    setSavingKey(key)
    setError(null)
    try {
      const nextFeatures = {
        ...(stable.enabled_features as Record<string, boolean>),
        [key]: checked,
      }
      const updated = await updateStable(stable.id, {
        enabled_features: nextFeatures,
      })
      onUpdate(updated)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSavingKey(null)
    }
  }

  return (
    <div className="panel p-6">
      <h2 className="section-title">{t('settings.featuresTitle')}</h2>
      <p className="mt-2 text-sm text-slate-500">
        {t('settings.featuresSubtitle')}
      </p>
      {!canEdit && (
        <p className="mt-2 text-sm text-slate-500">
          {t('settings.onlyOwnerCanEdit')}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="mt-4 flex flex-col gap-3">
        {ALL_FEATURES.map((feature) => (
          <Toggle
            key={feature.key}
            label={t(feature.labelKey)}
            checked={isFeatureEnabled(stable.enabled_features, feature.key)}
            onChange={(checked) => {
              if (!canEdit || savingKey) return
              void handleToggle(feature.key, checked)
            }}
          />
        ))}
      </div>
    </div>
  )
}
