// Loads the Microsoft Clarity tracking snippet, gated on user consent.
// See: https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-setup

declare global {
  interface Window {
    clarity?: (...args: unknown[]) => void
  }
}

export type AnalyticsConsent = 'accepted' | 'declined'

const CONSENT_KEY = 'stalldrift.analyticsConsent'

export function isClarityConfigured(): boolean {
  return Boolean(import.meta.env.VITE_CLARITY_PROJECT_ID)
}

export function getAnalyticsConsent(): AnalyticsConsent | null {
  try {
    const value = localStorage.getItem(CONSENT_KEY)
    return value === 'accepted' || value === 'declined' ? value : null
  } catch {
    return null
  }
}

export function setAnalyticsConsent(consent: AnalyticsConsent) {
  try {
    localStorage.setItem(CONSENT_KEY, consent)
  } catch {
    // ignore storage errors (e.g. private browsing)
  }
  if (consent === 'accepted') {
    loadClarityScript()
  } else if (window.clarity) {
    // Clarity is already running in this page — a reload is the only
    // reliable way to make it stop recording right away.
    window.location.reload()
  }
}

export function initClarity() {
  if (getAnalyticsConsent() === 'accepted') {
    loadClarityScript()
  }
}

function loadClarityScript() {
  const projectId = import.meta.env.VITE_CLARITY_PROJECT_ID
  if (!projectId || window.clarity) return

  ;(function (
    w: Window,
    d: Document,
    scriptTag: string,
    queueProp: 'clarity',
    id: string,
  ) {
    type ClarityFn = {
      (...args: unknown[]): void
      q?: unknown[]
    }
    const c = (w[queueProp] = function (...args: unknown[]) {
      ;(c as ClarityFn).q = (c as ClarityFn).q || []
      ;(c as ClarityFn).q!.push(args)
    } as ClarityFn)
    const script = d.createElement(scriptTag) as HTMLScriptElement
    script.async = true
    script.src = `https://www.clarity.ms/tag/${id}`
    const firstScript = d.getElementsByTagName(scriptTag)[0]
    firstScript.parentNode?.insertBefore(script, firstScript)
  })(window, document, 'script', 'clarity', projectId)
}
