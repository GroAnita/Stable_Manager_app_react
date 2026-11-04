function focusedNumberInput(
  target: EventTarget | null,
): HTMLInputElement | null {
  return target instanceof HTMLInputElement &&
    target.type === 'number' &&
    target === document.activeElement
    ? target
    : null
}

// Numbers should only change when someone types them, so an accidental scroll
// can't alter an amount. The arrows are hidden in index.css; this covers the
// mouse wheel and the up/down keys, across every number field in the app.
export function disableNumberInputStepping() {
  document.addEventListener(
    'wheel',
    (event) => {
      // Dropping focus stops the value changing and lets the page keep scrolling.
      focusedNumberInput(event.target)?.blur()
    },
    { capture: true, passive: true },
  )
  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
      if (focusedNumberInput(event.target)) event.preventDefault()
    },
    { capture: true },
  )
}
