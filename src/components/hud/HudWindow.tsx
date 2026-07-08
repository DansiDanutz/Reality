import { useEffect, useRef, type ReactNode } from 'react'
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
// Snap-to-edges: a card dropped within this many px of an edge pulls flush to
// it, and a card whose center is in the snap zone clamps fully on-screen.
const SNAP_PX = 24

// Phones pin HUD cards to fixed slots (see global.css ≤640px). On them the
// desktop drag/resize handlers fight the CSS, so we no-op both below that
// width. Checked at pointer-down time so no re-render/state is involved and
// the persisted desktop layout is untouched when the viewport widens again.
const isDesktop = () =>
  typeof window === 'undefined' || window.matchMedia('(min-width: 641px)').matches

/**
 * Clamp a dropped card so it sits *fully* inside the viewport (top-left AND
 * bottom-right), then snap to the nearest edge if within SNAP_PX. Returns the
 * final pixel {x, y}. The old clamp only kept the top-left corner's *percent*
 * in 0–96, which let a 380px card sit with its right edge off-screen.
 */
function clampAndSnap(left: number, top: number, width: number, height: number) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  // Fully on-screen first: at least 70px of the card must stay visible on each
  // axis even if the viewport is narrower than the card.
  const maxX = Math.max(0, vw - Math.min(width, vw))
  const maxY = Math.max(0, vh - Math.min(height, vh))
  let x = Math.min(Math.max(left, 0), maxX)
  let y = Math.min(Math.max(top, 0), maxY)
  // Snap to edges: if within SNAP_PX, pull flush.
  if (x <= SNAP_PX) x = 0
  else if (x >= maxX - SNAP_PX) x = maxX
  if (y <= SNAP_PX) y = 0
  else if (y >= maxY - SNAP_PX) y = maxY
  return { x, y }
}

interface HudWindowProps {
  id: CardId
  children: ReactNode
}

export default function HudWindow({ id, children }: HudWindowProps) {
  const layout = useGame((s) => s.hudLayout[id])
  const patchCard = useGame((s) => s.patchCard)
  const ref = useRef<HTMLDivElement>(null)
  // Detach any in-flight drag/resize window listeners if the card unmounts
  // mid-gesture (e.g. minimized from elsewhere) — otherwise they'd keep
  // firing against a detached node and persist garbage geometry.
  const gestureCleanupRef = useRef<(() => void) | null>(null)
  useEffect(() => () => {
    gestureCleanupRef.current?.()
    gestureCleanupRef.current = null
  }, [])

  const def = CARD_DEFAULTS[id]
  const pos = { min: false, ...def, ...layout }

  // If the viewport shrank after a card was last positioned (e.g. player saved
  // a layout on desktop, reloaded in a narrow window), its persisted % can now
  // place it fully off-screen. Re-clamp on mount + whenever the window resizes
  // so no card is ever stranded past the edge. (Desktop only — mobile pins to
  // fixed slots via CSS.) Persist once per change so it sticks.
  // Must run before the pos.min early return — hooks can't sit below a
  // conditional return (the hook count would change on minimize/restore).
  useEffect(() => {
    if (pos.min || !isDesktop()) return
    const el = ref.current
    if (!el) return
    const reclamp = () => {
      const r = el.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight
      const maxX = Math.max(0, vw - Math.min(r.width, vw))
      const maxY = Math.max(0, vh - Math.min(r.height, vh))
      const pxLeft = (pos.x / 100) * vw
      const pxTop = (pos.y / 100) * vh
      if (pxLeft > maxX + 1 || pxTop > maxY + 1 || pxLeft < -1 || pxTop < -1) {
        const fixed = clampAndSnap(pxLeft, pxTop, r.width, r.height)
        patchCard(id, {
          x: (fixed.x / vw) * 100,
          y: (fixed.y / vh) * 100,
        })
      }
    }
    reclamp()
    window.addEventListener('resize', reclamp)
    return () => window.removeEventListener('resize', reclamp)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos.x, pos.y, pos.min, id])

  if (pos.min) return null

  const beginDrag = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    if (!isDesktop()) return // mobile: cards are pinned, dragging is off
    e.preventDefault()
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const offsetX = e.clientX - rect.left
    const offsetY = e.clientY - rect.top
    el.classList.add('dragging')
    const onMove = (ev: PointerEvent) => {
      // Live clamp during drag: keep the cursor anchored but never let the
      // card's right/bottom edge leave the viewport.
      const w = el.offsetWidth
      const h = el.offsetHeight
      const x = Math.min(Math.max(ev.clientX - offsetX, 0), Math.max(0, window.innerWidth - w))
      const y = Math.min(Math.max(ev.clientY - offsetY, 0), Math.max(0, window.innerHeight - h))
      el.style.left = `${x}px`
      el.style.top = `${y}px`
    }
    const onUp = () => {
      cleanup()
      el.classList.remove('dragging')
      // A detached node measures 0×0 at 0,0 — persisting that would wreck
      // the saved layout. Bail if the card left the DOM mid-drag.
      if (!el.isConnected) return
      const r = el.getBoundingClientRect()
      // Clamp fully on-screen + snap to the nearest edge, then persist as %.
      const snapped = clampAndSnap(r.left, r.top, r.width, r.height)
      patchCard(id, {
        x: (snapped.x / window.innerWidth) * 100,
        y: (snapped.y / window.innerHeight) * 100,
      })
    }
    const cleanup = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      gestureCleanupRef.current = null
    }
    gestureCleanupRef.current = cleanup
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const beginResize = (e: React.PointerEvent) => {
    if (!isDesktop()) return // mobile: resize handle is hidden + disabled
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
      cleanup()
      // Same guard as drag: a detached node reports width 0 — don't persist it.
      if (!el.isConnected) return
      patchCard(id, { w: Math.round(el.getBoundingClientRect().width) })
    }
    const cleanup = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      gestureCleanupRef.current = null
    }
    gestureCleanupRef.current = cleanup
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
