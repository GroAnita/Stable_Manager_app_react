import { useEffect, useState } from 'react'
import { usePreferences } from '../lib/PreferencesContext'

const EMOJIS = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🙂',
  '😉', '😊', '😇', '🥰', '😍', '😘', '😋', '😜',
  '🤗', '🤔', '😐', '😴', '🥳', '😢', '😭', '😡',
  '😱', '👍', '👎', '👏', '🙌', '🙏', '💪', '❤️',
  '🎉', '✅', '⚠️', '☀️', '🌧️', '❄️', '🐴', '🐎',
  '🐾', '🌾',
]

export function EmojiPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
  const { t } = usePreferences()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open])

  return (
    <div className="relative inline-block">
      <button
        type="button"
        aria-label={t('common.insertEmoji')}
        aria-haspopup="true"
        aria-expanded={open}
        className="rounded-md px-1.5 py-0.5 text-base hover:bg-slate-200"
        onClick={() => setOpen((prev) => !prev)}
      >
        🙂
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute z-50 mt-1 grid w-64 grid-cols-8 gap-1 rounded-2xl border border-slate-200 bg-card p-3 shadow-card">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="rounded-md p-1 text-lg hover:bg-slate-100"
                onClick={() => {
                  onSelect(emoji)
                  setOpen(false)
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
