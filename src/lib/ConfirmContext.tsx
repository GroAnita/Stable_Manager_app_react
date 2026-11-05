import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { usePreferences } from './PreferencesContext'

type ConfirmOptions = { confirmLabel?: string }
type Confirm = (message: string, options?: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<Confirm | null>(null)

// Lets a handler wait for a yes or no from the app's own dialog.
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = usePreferences()
  const [request, setRequest] = useState<
    (ConfirmOptions & { message: string }) | null
  >(null)
  const resolveRef = useRef<((answer: boolean) => void) | null>(null)

  const answer = useCallback((value: boolean) => {
    resolveRef.current?.(value)
    resolveRef.current = null
    setRequest(null)
  }, [])

  const confirm = useCallback<Confirm>((message, options) => {
    resolveRef.current?.(false)
    setRequest({ message, ...options })
    return new Promise((resolve) => {
      resolveRef.current = resolve
    })
  }, [])

  // This dialog can open over a form in a Modal, which closes on Escape too.
  // Catching the key first stops that form closing and losing its changes.
  const open = request !== null
  useEffect(() => {
    if (!open) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      answer(false)
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [open, answer])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        open={open}
        title={t('common.confirmTitle')}
        message={request?.message ?? ''}
        confirmLabel={request?.confirmLabel}
        onConfirm={() => answer(true)}
        onCancel={() => answer(false)}
      />
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext)
  if (!confirm) throw new Error('useConfirm needs a ConfirmProvider')
  return confirm
}
