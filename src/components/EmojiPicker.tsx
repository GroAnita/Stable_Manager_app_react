import { useState } from 'react'

const EMOJIS = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🙂',
  '😉', '😊', '😇', '🥰', '😍', '😘', '😋', '😜',
  '🤗', '🤔', '😐', '😴', '🥳', '😢', '😭', '😡',
  '😱', '👍', '👎', '👏', '🙌', '🙏', '💪', '❤️',
  '🎉', '✅', '⚠️', '☀️', '🌧️', '❄️', '🐴', '🐎',
  '🐾', '🌾',
]

export function EmojiPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative inline-block">
      <button
        type="button"
        aria-label="Insert emoji"
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
          <div className="absolute z-50 mt-1 grid w-64 grid-cols-8 gap-1 rounded-2xl border border-slate-200 bg-white p-3 shadow-card">
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
