import { useEffect, useState } from 'react'
import { usePreferences } from '../lib/PreferencesContext'

const EMOJIS: { char: string; labelKey: string }[] = [
  { char: '😀', labelKey: 'emojiPicker.grinningFace' },
  { char: '😃', labelKey: 'emojiPicker.grinningFaceBigEyes' },
  { char: '😄', labelKey: 'emojiPicker.grinningFaceSmilingEyes' },
  { char: '😁', labelKey: 'emojiPicker.beamingFace' },
  { char: '😆', labelKey: 'emojiPicker.grinningSquintingFace' },
  { char: '😅', labelKey: 'emojiPicker.grinningFaceWithSweat' },
  { char: '😂', labelKey: 'emojiPicker.faceWithTearsOfJoy' },
  { char: '🙂', labelKey: 'emojiPicker.slightlySmilingFace' },
  { char: '😉', labelKey: 'emojiPicker.winkingFace' },
  { char: '😊', labelKey: 'emojiPicker.smilingFaceSmilingEyes' },
  { char: '😇', labelKey: 'emojiPicker.smilingFaceWithHalo' },
  { char: '🥰', labelKey: 'emojiPicker.smilingFaceWithHearts' },
  { char: '😍', labelKey: 'emojiPicker.heartEyes' },
  { char: '😘', labelKey: 'emojiPicker.faceBlowingKiss' },
  { char: '😋', labelKey: 'emojiPicker.faceSavoringFood' },
  { char: '😜', labelKey: 'emojiPicker.winkingFaceWithTongue' },
  { char: '🤗', labelKey: 'emojiPicker.huggingFace' },
  { char: '🤔', labelKey: 'emojiPicker.thinkingFace' },
  { char: '😐', labelKey: 'emojiPicker.neutralFace' },
  { char: '😴', labelKey: 'emojiPicker.sleepingFace' },
  { char: '🥳', labelKey: 'emojiPicker.partyingFace' },
  { char: '😢', labelKey: 'emojiPicker.cryingFace' },
  { char: '😭', labelKey: 'emojiPicker.loudlyCryingFace' },
  { char: '😡', labelKey: 'emojiPicker.poutingFace' },
  { char: '😱', labelKey: 'emojiPicker.faceScreamingInFear' },
  { char: '👍', labelKey: 'emojiPicker.thumbsUp' },
  { char: '👎', labelKey: 'emojiPicker.thumbsDown' },
  { char: '👏', labelKey: 'emojiPicker.clappingHands' },
  { char: '🙌', labelKey: 'emojiPicker.raisingHands' },
  { char: '🙏', labelKey: 'emojiPicker.foldedHands' },
  { char: '💪', labelKey: 'emojiPicker.flexedBiceps' },
  { char: '❤️', labelKey: 'emojiPicker.redHeart' },
  { char: '🎉', labelKey: 'emojiPicker.partyPopper' },
  { char: '✅', labelKey: 'emojiPicker.checkMark' },
  { char: '⚠️', labelKey: 'emojiPicker.warning' },
  { char: '☀️', labelKey: 'emojiPicker.sun' },
  { char: '🌧️', labelKey: 'emojiPicker.rainCloud' },
  { char: '❄️', labelKey: 'emojiPicker.snowflake' },
  { char: '🐴', labelKey: 'emojiPicker.horseFace' },
  { char: '🐎', labelKey: 'emojiPicker.runningHorse' },
  { char: '🐾', labelKey: 'emojiPicker.pawPrints' },
  { char: '🌾', labelKey: 'emojiPicker.sheafOfRice' },
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
            {EMOJIS.map(({ char, labelKey }) => (
              <button
                key={char}
                type="button"
                aria-label={t(labelKey)}
                className="rounded-md p-1 text-lg hover:bg-slate-100"
                onClick={() => {
                  onSelect(char)
                  setOpen(false)
                }}
              >
                {char}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
