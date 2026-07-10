import { useSyncExternalStore } from 'react'

// Single source of truth for "phone-sized" — must match the ≤640px media
// query in global.css so the React tree and the stylesheet always agree on
// which shell (floating HUD windows vs. mobile tab bar) is active.
const QUERY = '(max-width: 640px)'

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

const getSnapshot = () => window.matchMedia(QUERY).matches

/** True on phone-sized viewports (≤640px), live across rotations/resizes. */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
