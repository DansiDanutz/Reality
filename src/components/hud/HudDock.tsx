import { useState } from 'react'
import { useGame } from '../../store/gameStore'
import { CARD_DEFAULTS, CARD_META, type CardId } from './HudWindow'

const SLOTS = 6

/**
 * The player's dock: minimized cards become icons in slots. Click to
 * restore; drag between slots to arrange your own menu.
 */
export default function HudDock() {
  const hudLayout = useGame((s) => s.hudLayout)
  const order = useGame((s) => s.hudDockOrder)
  const setDockOrder = useGame((s) => s.setDockOrder)
  const patchCard = useGame((s) => s.patchCard)
  const [dragId, setDragId] = useState<string | null>(null)

  // Saved orders may predate newer cards — append any the player hasn't met yet
  const fullOrder = [...order, ...Object.keys(CARD_META).filter((id) => !order.includes(id))]
  const minimized = fullOrder.filter((id) => hudLayout[id]?.min ?? CARD_DEFAULTS[id as CardId]?.min)
  if (minimized.length === 0) return null

  const dropOn = (slotIndex: number) => {
    if (!dragId) return
    const next = fullOrder.filter((id) => id !== dragId)
    // Position among minimized icons: insert before whichever id sits in that slot
    const target = minimized.filter((id) => id !== dragId)[slotIndex]
    const at = target ? next.indexOf(target) : next.length
    next.splice(at, 0, dragId)
    setDockOrder(next)
    setDragId(null)
  }

  return (
    <div className="hud-dock" aria-label="Minimized cards">
      {Array.from({ length: SLOTS }, (_, i) => {
        const id = minimized[i] as CardId | undefined
        return (
          <div
            key={i}
            className={`dock-slot${id ? ' filled' : ''}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => dropOn(i)}
          >
            {id && (
              <button
                className="dock-icon"
                draggable
                onDragStart={() => setDragId(id)}
                onDragEnd={() => setDragId(null)}
                onClick={() => patchCard(id, { min: false })}
                title={`${CARD_META[id].title} — click to restore, drag to arrange`}
              >
                <span aria-hidden>{CARD_META[id].icon}</span>
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
