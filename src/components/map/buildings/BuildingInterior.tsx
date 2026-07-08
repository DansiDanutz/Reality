import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { PlacedAsset } from '../../../game/types'
import { itemById } from '../../../game/catalog'
import { formatMoney } from '../../../game/engine'
import { useFocusTrap } from '../../../lib/useFocusTrap'
import { useGame } from '../../../store/gameStore'
import { BUILDING_REGISTRY, resolveArchetype } from './registry'
import { buildingSpriteSVG } from './sprites'
import './buildings.css'

interface BuildingInteriorProps {
  asset: PlacedAsset
  onClose: () => void
}

/**
 * The interior of a clicked map building — a HoMM-style "enter the building"
 * overlay. Renders purely from the archetype registry: header (name, larger
 * sprite, level, income) plus a rooms grid whose actions call EXISTING store
 * actions only. Where a full panel exists (Kitchen, Work, Assets) the room
 * navigates there instead of duplicating UI.
 *
 * Accessibility mirrors ConfirmDialog: focus trap, Escape closes (capture so
 * the app-level Escape doesn't also fire), click-outside closes, and the
 * entrance animation respects prefers-reduced-motion (buildings.css).
 */
export default function BuildingInterior({ asset, onClose }: BuildingInteriorProps) {
  const dialogRef = useFocusTrap<HTMLDivElement>(true)
  // Subscribe so room availability (pending income, activity) stays live.
  const activity = useGame((s) => s.activity)
  const assets = useGame((s) => s.assets)
  const live = assets.find((a) => a.id === asset.id) ?? asset

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const item = itemById(live.itemId)
  const archetype = resolveArchetype(live, item)
  const def = BUILDING_REGISTRY[archetype]
  const level = live.level ?? 1
  const store = useGame.getState()

  return createPortal(
    <div
      className="building-overlay"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="building-interior"
        role="dialog"
        aria-modal="true"
        aria-label={`${live.name} — ${def.displayName}`}
        ref={dialogRef}
      >
        <header className="building-header">
          <div
            className="building-portrait"
            aria-hidden
            // Sprites are code-generated SVG strings from sprites.ts — no
            // user input ever flows in, so this is not an XSS surface.
            dangerouslySetInnerHTML={{ __html: buildingSpriteSVG(archetype, { level }) }}
          />
          <div className="building-title-block">
            <h3 className="building-name">{live.name}</h3>
            <p className="building-sub">
              {def.displayName} · {live.kind === 'home' ? 'Home' : `Business · L${level}`}
            </p>
            {live.kind === 'business' && (
              <p className="building-sub building-income">
                {formatMoney(live.incomePerDay)}/day
                {live.pendingIncome >= 1 && (
                  <span className="building-pending"> · {formatMoney(Math.floor(live.pendingIncome))} in the till</span>
                )}
              </p>
            )}
          </div>
          <button className="building-close" onClick={onClose} aria-label="Leave building">
            ✕
          </button>
        </header>

        <div className="building-rooms" role="list">
          {def.interior.rooms.map((room) => {
            const available = room.availableWhen
              ? room.availableWhen({ ...store, activity, assets }, live)
              : true
            return (
              <button
                key={room.id}
                role="listitem"
                className="building-room"
                disabled={!available}
                onClick={() => {
                  room.onEnter(useGame.getState(), live)
                  onClose()
                }}
              >
                <span className="building-room-icon" aria-hidden>{room.icon}</span>
                <span className="building-room-label">{room.label}</span>
                <span className="building-room-desc">{room.description}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>,
    document.body,
  )
}
