import { Icon } from '../Icon'
import { LESSON_COLORS } from '../../features/lessons/colors'
import { usePreferences } from '../../lib/PreferencesContext'

// A row of colour swatches. Null is the standard colour, shown first.
export function ColorPicker({
  value,
  onChange,
  standardColor,
}: {
  value: string | null
  onChange: (color: string | null) => void
  standardColor: string
}) {
  const { t } = usePreferences()
  const options: { hex: string | null; label: string; swatch: string }[] = [
    { hex: null, label: t('lessonColors.standard'), swatch: standardColor },
    ...LESSON_COLORS.map((color) => ({
      hex: color.hex,
      label: t(`lessonColors.${color.key}`),
      swatch: color.hex,
    })),
  ]
  return (
    <div role="radiogroup" aria-label={t('lessonColors.label')}>
      <span className="field-label">{t('lessonColors.label')}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected =
            (option.hex ?? '').toLowerCase() === (value ?? '').toLowerCase()
          return (
            <button
              key={option.label}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={option.label}
              title={option.label}
              onClick={() => onChange(option.hex)}
              className={`flex h-8 w-8 items-center justify-center rounded-full text-white ring-offset-2 ring-offset-card ${
                selected ? 'ring-2 ring-ink' : 'hover:scale-110'
              } ${option.hex === null ? 'border-2 border-dashed border-white/70' : ''}`}
              style={{ background: option.swatch }}
            >
              {selected && <Icon name="check" className="h-4 w-4" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
