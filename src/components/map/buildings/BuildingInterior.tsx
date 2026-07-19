import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { PlacedAsset } from '../../../game/types'
import { itemById } from '../../../game/catalog'
import { adviceOf, formatMoney } from '../../../game/engine'
import { planLifeDay } from '../../../game/lifeLadder'
import { prefersReducedMotion } from '../../../lib/motion'
import { playChime, startInteriorAmbience, stopInteriorAmbience } from '../../../lib/sound'
import { useFocusTrap } from '../../../lib/useFocusTrap'
import { useGame } from '../../../store/gameStore'
import AnimatedMoney from '../../hud/AnimatedMoney'
import { runAdviceAction } from '../../hud/adviceActions'
import { guideMessage } from '../../hud/guideVoice'
import { lifeLadderSnapshotOf, runLifePlanRoute } from '../../hud/lifePlanInput'
import { BUILDING_REGISTRY, resolveArchetype } from './registry'
import { HOME_FIXTURES, businessInteriorSVG, homeInteriorSVG, ownedHomeFixtures } from './interiorScene'
import './buildings.css'

interface BuildingInteriorProps {
  asset: PlacedAsset
  onClose: () => void
}

/**
 * The interior of a clicked map building — the HoMM "town screen" moment (P4).
 * Not a stats panel: a PLACE you step into. A wide illustrated scene reflects
 * exactly what you own (furniture at home, fit-out level in a business), a calm
 * ambient loop plays while you're inside, and collecting income happens right
 * here with a satisfying beat — coins leave the till, the balance counts up.
 *
 * State = picture: every upgrade you've paid for shows in the scene. The rooms
 * below are the doors — each calls an EXISTING store action or deep-links to a
 * full panel; the registry never invents a new simulation path. The guide's
 * One Voice follows you inside so "what next?" always has an answer.
 *
 * Accessibility mirrors ConfirmDialog: focus trap, Escape closes (capture so
 * the app-level Escape doesn't also fire), click-outside closes, entrance +
 * collect animations respect prefers-reduced-motion (buildings.css).
 */
export default function BuildingInterior({ asset, onClose }: BuildingInteriorProps) {
  const dialogRef = useFocusTrap<HTMLDivElement>(true)
  // Subscriptions that keep the scene + rooms live while you're inside.
  const activity = useGame((s) => s.activity)
  const assets = useGame((s) => s.assets)
  const inventory = useGame((s) => s.inventory)
  useGame((s) => s.money) // re-render the guide/collect state as cash moves
  const soundOn = useGame((s) => s.soundOn)
  const live = assets.find((a) => a.id === asset.id) ?? asset

  const [collectedFloat, setCollectedFloat] = useState<number | null>(null)
  const [collecting, setCollecting] = useState(false)

  const item = itemById(live.itemId)
  const archetype = resolveArchetype(live, item)
  const def = BUILDING_REGISTRY[archetype]
  const level = live.level ?? 1
  const isHome = live.kind === 'home'

  // Ambient sound bed: fireplace at home, murmur in a business. Gated by the
  // sound toggle and stopped whenever we leave (or sound is muted mid-visit).
  useEffect(() => {
    if (!soundOn) {
      stopInteriorAmbience()
      return
    }
    startInteriorAmbience(isHome ? 'home' : 'business')
    return () => stopInteriorAmbience()
  }, [soundOn, isHome])

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

  // Collect sweeps pending income across ALL businesses (one till, one tap) —
  // show the true total so the count-up matches what actually lands.
  const totalPending = Math.floor(assets.reduce((sum, a) => sum + (a.kind === 'business' ? a.pendingIncome : 0), 0))
  const canCollect = !isHome && totalPending >= 1

  const collect = () => {
    if (!canCollect) return
    if (soundOn) playChime('gold')
    setCollectedFloat(totalPending)
    if (!prefersReducedMotion()) {
      setCollecting(true)
      setTimeout(() => setCollecting(false), 700)
    }
    useGame.getState().collectIncome()
    setTimeout(() => setCollectedFloat(null), 1200)
  }

  // The scene SVG — the hero. Home reflects the furniture you own; a business
  // reflects its level, with coins in the till when there's income waiting.
  const owned = isHome ? ownedHomeFixtures(inventory) : []
  const pendingCoins = !isHome && live.pendingIncome >= 1
    ? Math.min(6, Math.max(1, Math.round(live.pendingIncome / Math.max(1, live.incomePerDay / 4))))
    : 0
  const sceneSVG = isHome
    ? homeInteriorSVG(archetype, owned)
    : businessInteriorSVG(archetype, level, { pendingCoins })

  // Home "what's inside" caption — names what you own, or nudges the empty room
  // toward the shop. Makes the visible upgrades legible, not just decorative.
  const ownedLabels = HOME_FIXTURES.filter((f) => owned.includes(f.id)).map((f) => f.label)

  // One Voice — the same referee the guide bar uses, so "what next?" is answered
  // the same way inside as out. Read from the live store; it's fresh per render.
  const store = useGame.getState()
  const advice = adviceOf({
    needs: store.needs,
    health: store.health,
    money: store.money,
    jobId: store.jobId,
    activity: store.activity,
    hasHome: store.assets.some((a) => a.kind === 'home'),
    businesses: store.assets.filter((a) => a.kind === 'business').length,
    pendingIncome: store.assets.reduce((sum, a) => sum + a.pendingIncome, 0),
  })
  const snapshot = lifeLadderSnapshotOf(store)
  const guide = guideMessage(advice, snapshot ? planLifeDay(snapshot) : null)
  const runGuide = () => {
    onClose()
    if (guide.kind === 'plan') runLifePlanRoute(guide.task.route)
    else if (guide.action !== 'none') runAdviceAction(guide.action)
  }
  const guideDisabled = guide.kind === 'plan' ? guide.task.route.kind === 'none' : guide.action === 'none' || !guide.cta

  // The rooms grid — the "doors". For a business the till becomes the in-scene
  // collect hero above, so drop the duplicate room here.
  const rooms = def.interior.rooms.filter((room) => !(room.id === 'till'))

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
        aria-label={`Inside ${live.name} — ${def.displayName}`}
        ref={dialogRef}
      >
        <header className="building-header">
          <div className="building-title-block">
            <h3 className="building-name">{live.name}</h3>
            <p className="building-sub">
              {def.displayName} · {isHome ? 'Home' : `Business · L${level}`}
              {!isHome && <> · {formatMoney(live.incomePerDay)}/day</>}
            </p>
          </div>
          <button className="building-close" onClick={onClose} aria-label="Leave building">✕</button>
        </header>

        <div className={`building-scene${collecting ? ' collecting' : ''}`} aria-hidden>
          {/* Scene SVG is code-generated from interiorScene.ts — no user input
              ever flows in, so this is not an XSS surface. */}
          <div className="building-scene-art" dangerouslySetInnerHTML={{ __html: sceneSVG }} />
          {collectedFloat !== null && (
            <span className="collect-float mono">+{formatMoney(collectedFloat)}</span>
          )}
        </div>

        {!isHome && (
          <div className="building-till-bar">
            <span className="building-till-copy">
              {totalPending >= 1
                ? <>In the till: <strong className="mono gold"><AnimatedMoney value={totalPending} /></strong></>
                : <span className="muted">The till is empty — income builds while you're away.</span>}
            </span>
            <button className="btn primary" disabled={!canCollect} onClick={collect}>
              {canCollect ? `Collect ${formatMoney(totalPending)}` : 'Collected'}
            </button>
          </div>
        )}

        {isHome && (
          <p className="building-inside-caption">
            {ownedLabels.length > 0
              ? <>Inside: {ownedLabels.join(' · ')}.</>
              : <>Your home is bare. Buy furniture in the Shop and it appears right here.</>}
          </p>
        )}

        <div className="building-rooms" role="list">
          {rooms.map((room) => {
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

        <div className="building-guide" role="status">
          <span className="building-guide-icon" aria-hidden>🧭</span>
          <span className="building-guide-text">{guide.text}</span>
          {!guideDisabled && (
            <button className="btn small primary" onClick={runGuide}>{guide.cta}</button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
