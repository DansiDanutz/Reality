import { useEffect, useRef } from 'react'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

/**
 * Keep keyboard focus inside a modal dialog for as long as it is open:
 * move focus into it on open, cycle Tab / Shift+Tab within it, and restore
 * focus to whatever opened it on close. One hook so every panel behaves the
 * same for keyboard and screen-reader users. Escape-to-close lives in App.tsx.
 */
export function useFocusTrap<T extends HTMLElement>(active = true) {
  const ref = useRef<T>(null)

  useEffect(() => {
    if (!active) return
    const container = ref.current
    if (!container) return

    const opener = document.activeElement as HTMLElement | null

    const visibleFocusables = (): HTMLElement[] =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      )

    // Move focus into the dialog: first focusable, else the container itself.
    const first = visibleFocusables()[0]
    if (first) {
      first.focus()
    } else {
      container.setAttribute('tabindex', '-1')
      container.focus()
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const items = visibleFocusables()
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const firstEl = items[0]
      const lastEl = items[items.length - 1]
      const focused = document.activeElement
      if (e.shiftKey && (focused === firstEl || !container.contains(focused))) {
        e.preventDefault()
        lastEl.focus()
      } else if (!e.shiftKey && (focused === lastEl || !container.contains(focused))) {
        e.preventDefault()
        firstEl.focus()
      }
    }

    container.addEventListener('keydown', onKeyDown)
    return () => {
      container.removeEventListener('keydown', onKeyDown)
      // Return focus to the opener so keyboard users never lose their place.
      if (opener && document.contains(opener)) opener.focus()
    }
  }, [active])

  return ref
}
