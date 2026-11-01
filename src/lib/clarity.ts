// Loads the Microsoft Clarity tracking snippet, if a project ID is configured.
// See: https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-setup

declare global {
  interface Window {
    clarity?: (...args: unknown[]) => void
  }
}

export function initClarity() {
  const projectId = import.meta.env.VITE_CLARITY_PROJECT_ID
  if (!projectId) return
  if (window.clarity) return

  ;(function (
    w: Window,
    d: Document,
    scriptTag: string,
    queueProp: string,
    id: string,
  ) {
    type ClarityFn = {
      (...args: unknown[]): void
      q?: unknown[]
    }
    const c = (w[queueProp as 'clarity'] = function (
      this: unknown,
      ...args: unknown[]
    ) {
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
