import { useEffect, useRef } from 'react'
import { playChime } from '../../lib/sound'
import { useGame } from '../../store/gameStore'

const TOAST_MS = 3600

/** Feedback bursts: money, levels, life events — the game answering back */
export default function Toasts() {
  const toasts = useGame((s) => s.toasts)
  const popToast = useGame((s) => s.popToast)
  const soundOn = useGame((s) => s.soundOn)
  const lastHeard = useRef(0)

  // Each new toast speaks once
  useEffect(() => {
    const newest = toasts[toasts.length - 1]
    if (!newest || newest.id <= lastHeard.current) return
    lastHeard.current = newest.id
    if (soundOn) playChime(newest.tone)
  }, [toasts, soundOn])

  // Keyed on the head toast's id, not the array: new arrivals must not
  // re-arm the timer, or a busy stream keeps the oldest toast alive forever.
  const oldestId = toasts[0]?.id
  useEffect(() => {
    if (oldestId === undefined) return
    const timer = setTimeout(() => popToast(oldestId), TOAST_MS)
    return () => clearTimeout(timer)
  }, [oldestId, popToast])

  if (toasts.length === 0) return null

  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <button key={t.id} className={`toast ${t.tone}`} onClick={() => popToast(t.id)}>
          {t.text}
        </button>
      ))}
    </div>
  )
}
