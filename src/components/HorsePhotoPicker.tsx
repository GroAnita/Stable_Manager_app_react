import { useState, type ChangeEvent } from 'react'
import {
  removeHorsePhoto,
  UnsupportedPhotoError,
  uploadHorsePhoto,
} from '../features/horses/api'
import { useConfirm } from '../lib/ConfirmContext'
import { usePreferences } from '../lib/PreferencesContext'
import { HorseAvatar } from './HorseAvatar'
import { Icon } from './Icon'

// The horse's avatar with a camera badge: tap to add or change the photo,
// with a "remove" link underneath when there is one.
export function HorsePhotoPicker({
  horse,
  onChange,
  className = 'h-20 w-20 text-3xl',
}: {
  horse: {
    id: string
    stable_id: string
    name: string
    photo_url: string | null
  }
  onChange: (photoUrl: string | null) => void
  className?: string
}) {
  const { t } = usePreferences()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const label = t(
    horse.photo_url ? 'horseDetail.changePhoto' : 'horseDetail.addPhoto',
  )

  async function run(action: () => Promise<string | null>) {
    setBusy(true)
    setError(null)
    try {
      onChange(await action())
    } catch (err) {
      setError(
        err instanceof UnsupportedPhotoError
          ? t('horseDetail.photoUnsupported')
          : t('horseDetail.photoFailed', { error: (err as Error).message }),
      )
    } finally {
      setBusy(false)
    }
  }

  function handlePicked(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    void run(() =>
      uploadHorsePhoto({ stableId: horse.stable_id, horseId: horse.id, file }),
    )
  }

  async function handleRemove() {
    if (!(await confirm(t('horseDetail.confirmRemovePhoto')))) return
    void run(async () => {
      await removeHorsePhoto({ stableId: horse.stable_id, horseId: horse.id })
      return null
    })
  }

  return (
    <div className="flex max-w-40 shrink-0 flex-col items-center gap-1">
      <label
        className={`group relative block cursor-pointer rounded-2xl focus-within:ring-2 focus-within:ring-forest ${
          busy ? 'pointer-events-none opacity-60' : ''
        }`}
        title={label}
      >
        <HorseAvatar
          name={horse.name}
          photoUrl={horse.photo_url}
          className={className}
        />
        <span className="absolute -right-1.5 -bottom-1.5 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-forest text-white shadow group-hover:bg-forest/90 dark:border-slate-900">
          <Icon name="camera" className="h-4 w-4" />
        </span>
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          aria-label={label}
          disabled={busy}
          onChange={handlePicked}
        />
      </label>
      {busy ? (
        <span className="text-xs text-slate-500">
          {t('horseDetail.uploadingPhoto')}
        </span>
      ) : (
        horse.photo_url && (
          <button
            type="button"
            onClick={handleRemove}
            className="text-xs text-slate-500 hover:text-red-600"
          >
            {t('horseDetail.removePhoto')}
          </button>
        )
      )}
      {error && (
        <p role="alert" className="text-center text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
