import { formatMoney } from '../../game/engine'
import type { ResourceNode } from '../../game/resources'
import type { PlacedAsset } from '../../game/types'
import type { ConstructionProject } from '../../game/construction'
import type { ResourceCluster } from './worldMapMarkers'

/**
 * The universal inspect gesture (UX north star P2, straight from HoMM's
 * right-click): hold or right-click anything on the map and a transient card
 * says what it is, what it gives, and what tapping does. This module is the
 * pure half — content builders and the gesture wiring — so the card copy is
 * unit-testable without MapLibre.
 */

export interface QuickInfoContent {
  title: string
  lines: string[]
  /** What the primary tap does — always last, always actionable. */
  hint?: string
}

export interface QuickInfoAt extends QuickInfoContent {
  x: number
  y: number
}

export function assetQuickInfo(a: PlacedAsset): QuickInfoContent {
  if (a.kind === 'business') {
    const ready = Math.floor(a.pendingIncome)
    return {
      title: a.name,
      lines: [
        `Business · Level ${a.level ?? 1}`,
        ready >= 1 ? `${formatMoney(ready)} ready to collect` : 'Earning revenue every real day',
      ],
      hint: 'Tap to step inside',
    }
  }
  return {
    title: a.name,
    lines: ['Home — better sleep, free showers', 'Your citizen lives on this clock'],
    hint: 'Tap to step inside',
  }
}

export function resourceQuickInfo(cluster: ResourceCluster<ResourceNode>): QuickInfoContent {
  const primary = cluster.nodes[0]
  return {
    title: cluster.nodes.length > 1 ? `${primary.label} ×${cluster.nodes.length}` : primary.label,
    lines: [
      `+${primary.yieldAmount} ${primary.kind} per gather`,
      `${primary.gatherMinutes} real min · −${primary.energyCost} energy`,
    ],
    hint: 'Tap to gather',
  }
}

export function constructionQuickInfo(
  project: Pick<ConstructionProject, 'name' | 'resultKind'>,
  phaseSummary: string,
): QuickInfoContent {
  return {
    title: project.name,
    lines: [
      project.resultKind === 'business' ? 'Business under construction' : 'Home under construction',
      phaseSummary,
    ],
    hint: 'Tap to manage the build',
  }
}

/**
 * Tapping another player's building (P6): a look-only card that says who they
 * are and that you share the same real Earth. No hint — foreign property is
 * inspect-only; you can't act on it (never pay-to-win).
 */
export function ownerQuickInfo(name: string | null | undefined, kind: string): QuickInfoContent {
  const who = name && name.trim() ? name.trim() : 'A fellow founder'
  const what = kind === 'business' ? 'business' : 'home'
  return {
    title: who,
    lines: [`Another founder's ${what}`, 'You share the same real Earth'],
  }
}

export function workersHallQuickInfo(): QuickInfoContent {
  return {
    title: 'Workers Hall',
    lines: ['Hire workers for construction and business projects'],
    hint: 'Tap to open',
  }
}

const LONG_PRESS_MS = 420

/**
 * Wire the inspect gesture onto a marker element.
 *
 * Desktop right-click and Android long-press both arrive as `contextmenu`;
 * iOS Safari never fires it, so a touch pointer held LONG_PRESS_MS emulates
 * it. When the card was summoned, the next click on the element is eaten
 * (briefly) so inspecting never accidentally triggers the primary action —
 * HoMM's "asking is always safe" rule.
 */
export function attachQuickInfo(
  el: HTMLElement,
  get: () => QuickInfoContent | null,
  show: (info: QuickInfoAt) => void,
): void {
  const suppressNextClick = () => {
    const eat = (e: Event) => {
      e.stopImmediatePropagation()
      e.preventDefault()
    }
    el.addEventListener('click', eat, { capture: true, once: true })
    // Android long-press often swallows the click natively — don't let the
    // suppressor linger and eat the player's NEXT deliberate tap.
    window.setTimeout(() => el.removeEventListener('click', eat, { capture: true }), 800)
  }
  const showAt = (x: number, y: number) => {
    const content = get()
    if (content) show({ ...content, x, y })
  }

  el.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    e.stopPropagation()
    suppressNextClick()
    showAt(e.clientX, e.clientY)
  })

  let timer = 0
  const cancelHold = () => window.clearTimeout(timer)
  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return
    cancelHold()
    const { clientX, clientY } = e
    timer = window.setTimeout(() => {
      suppressNextClick()
      showAt(clientX, clientY)
    }, LONG_PRESS_MS)
  })
  el.addEventListener('pointerup', cancelHold)
  el.addEventListener('pointercancel', cancelHold)
  el.addEventListener('pointerleave', cancelHold)
}
