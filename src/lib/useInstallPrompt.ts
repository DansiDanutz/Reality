import { useEffect, useState } from 'react'

/**
 * PWA install prompt — captured, not auto-shown.
 *
 * Chrome/Edge fires `beforeinstallprompt` when the app is installable. The
 * default behavior is to show a browser-chrome mini-infobar, which players
 * dismiss reflexively. Instead we capture the event, prevent the default,
 * and surface a custom in-app "Install Reality" banner at the RIGHT moment
 * (after the player has engaged for a few minutes, not on first load).
 *
 * Installed PWAs are returned to far more than browser tabs -- this is a
 * retention lever. The banner is dismissible and won't reappear for 7 days
 * after dismissal (stored in localStorage).
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'reality-install-dismissed'
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60_000 // 7 days

/** Has the player dismissed the install prompt recently? */
export function recentlyDismissed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0)
    return Date.now() - at < DISMISS_COOLDOWN_MS
  } catch {
    return false
  }
}

/** Is the app already running as an installed PWA (standalone display)? */
export function isStandalone(): boolean {
  return (
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches ||
      // iOS Safari doesn't support display-mode; falls back to navigator.
      (window.navigator as unknown as { standalone?: boolean }).standalone === true)
  )
}

/**
 * Capture the install event. Returns the deferred prompt (or null) so the
 * UI can show an "Install" button and call `triggerInstall()` on click.
 */
export function useInstallPrompt(): {
  canInstall: boolean
  triggerInstall: () => Promise<boolean>
} {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (isStandalone()) return // already installed; no prompt needed
    const handler = (e: Event) => {
      e.preventDefault() // suppress the browser's mini-infobar
      setDeferred(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    // appinstalled fires if the player installs via browser chrome; clear
    // our deferred so we don't try to prompt again.
    const installed = () => setDeferred(null)
    window.addEventListener('appinstalled', installed)
    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installed)
    }
  }, [])

  const triggerInstall = async (): Promise<boolean> => {
    if (!deferred) return false
    try {
      await deferred.prompt()
      const choice = await deferred.userChoice
      setDeferred(null)
      if (choice.outcome === 'dismissed') {
        try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch { /* ignore */ }
      }
      return choice.outcome === 'accepted'
    } catch {
      return false
    }
  }

  return { canInstall: deferred !== null && !recentlyDismissed(), triggerInstall }
}
