import { useEffect } from 'react'
import { useGame } from '../../store/gameStore'

const TOAST_MS = 3600

/** Feedback bursts: money, levels, life events — the game answering back */
export default function Toasts() {
  const toasts = useGame((s) => s.toasts)
  const popToast = useGame((s) => s.popToast)

  useEffect(() => {
    if (toasts.length === 0) return
    const oldest = toasts[0]
    const timer = setTimeout(() => popToast(oldest.id), TOAST_MS)
    return () => clearTimeout(timer)
  }, [toasts, popToast])

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
