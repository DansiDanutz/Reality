import { useRef, type ReactNode } from 'react'
import { useGame } from '../../store/gameStore'

/**
 * The player owns their screen: every HUD card is a draggable, resizable,
 * minimizable window. Positions are stored as viewport percentages so a
 * layout survives any device; minimized cards live as icons in the HudDock.
 */

export type CardId = 'objectives' | 'citizen' | 'vitals' | 'guide' | 'finance'

export const CARD_DEFAULTS: Record<CardId, { x: number; y: number; w: number; min?: boolean }> = {
  objectives: { x: 1.8, y: 8.5, w: 264 },
  citizen: { x: 1.8, y: 56, w: 264 },
  vitals: { x: 1.8, y: 76, w: 380 },
  guide: { x: 84, y: 34, w: 176 },
  // Starts in the dock — one click away, zero clutter for new players
  finance: { x: 68, y: 8.5, w: 250, min: true },
}

export const CARD_META: Record<CardId, { title: string; icon: string }> = {
  objectives: { title: 'Objectives', icon: '🎯' },
  citizen: { title: 'Citizen', icon: '🪪' },
  vitals: { title: 'Vitals', icon: '❤️' },
  guide: { title: 'Guide', icon: '🧭' },
  finance: { title: 'Finance', icon: '💰' },
}

const MIN_W = 150
const MAX_W = 520

interface HudWindowProps {
  id: CardId
  children: ReactNode
}

export default function HudWindow({ id, children }: HudWindowProps) {
  const layout = useGame((s) => s.hudLayout[id])
  const patchCard = useGame((s) => s.patchCard)
  const ref = useRef<HTMLDivElement>(null)

  const def = CARD_DEFAULTS[id]
  const pos = { min: false, ...def, ...layout }
  if (pos.min) return null

  const beginDrag = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault()
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const offsetX = e.clientX - rect.left
    const offsetY = e.clientY - rect.top
    el.classList.add('dragging')
    const onMove = (ev: PointerEvent) => {
      const x = Math.min(Math.max(ev.clientX - offsetX, 2), window.innerWidth - 70)
      const y = Math.min(Math.max(ev.clientY - offsetY, 2), window.innerHeight - 40)
      el.style.left = `${x}px`
      el.style.top = `${y}px`
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      el.classList.remove('dragging')
      const r = el.getBoundingClientRect()
      patchCard(id, {
        x: Math.min(Math.max((r.left / window.innerWidth) * 100, 0), 96),
        y: Math.min(Math.max((r.top / window.innerHeight) * 100, 0), 95),
      })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const beginResize = (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const el = ref.current
    if (!el) return
    const startX = e.clientX
    const startW = el.getBoundingClientRect().width
    const onMove = (ev: PointerEvent) => {
      const w = Math.min(Math.max(startW + (ev.clientX - startX), MIN_W), MAX_W)
      el.style.width = `${w}px`
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      patchCard(id, { w: Math.round(el.getBoundingClientRect().width) })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div
      ref={ref}
      className="hud-window"
      style={{ left: `${pos.x}%`, top: `${pos.y}%`, width: pos.w }}
      data-card={id}
    >
      <div className="hud-grip" onPointerDown={beginDrag} title="Drag to move">
        <span className="hud-grip-title">
          {CARD_META[id].icon} {CARD_META[id].title}
        </span>
        <button
          className="hud-min"
          aria-label={`Minimize ${CARD_META[id].title}`}
          title="Minimize to the dock"
          onClick={() => patchCard(id, { min: true })}
        >
          —
        </button>
      </div>
      <div className="hud-body">{children}</div>
      <div className="hud-resize" onPointerDown={beginResize} title="Drag to resize" aria-hidden />
    </div>
  )
}
