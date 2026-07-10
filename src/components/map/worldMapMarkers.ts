import type { AssetKind } from '../../game/types'
import { constructionSiteSVG, type ConstructionPhase } from './buildings/sprites'

/**
 * Pure view-models for WorldMap DOM markers (issue #1005) — kept free of
 * MapLibre and the store so the marker HTML/labels are unit-testable.
 */

export interface ConstructionMarkerProgress {
  percent: number
  resourcesComplete: boolean
  permitComplete: boolean
  /** laborDoneMinutes / laborRequiredMinutes, 0..1 */
  laborRatio: number
}

const PHASE_LABEL: Record<ConstructionPhase, string> = {
  materials: 'gathering materials',
  permit: 'awaiting permit',
  labor: 'under construction',
}

function phaseOf(progress: Pick<ConstructionMarkerProgress, 'resourcesComplete' | 'permitComplete'>): ConstructionPhase {
  if (!progress.resourcesComplete) return 'materials'
  if (!progress.permitComplete) return 'permit'
  return 'labor'
}

export function constructionMarkerView(name: string, resultKind: AssetKind, progress: ConstructionMarkerProgress) {
  const phase = phaseOf(progress)
  const clampedProgress = Math.max(0, Math.min(100, progress.percent))
  const kindText = resultKind === 'business' ? 'business construction site' : 'home construction site'
  return {
    className: `map-construction-site ${resultKind} phase-${phase}`,
    html: constructionSiteSVG(resultKind, phase, progress.laborRatio),
    title: `${name} ${kindText} — ${PHASE_LABEL[phase]}, ${clampedProgress}% complete`,
    ariaLabel: `${name} ${kindText}, ${PHASE_LABEL[phase]}, ${clampedProgress}% complete`,
  }
}

/**
 * The buildings that were not on the map in the previous sync — each gets a
 * one-shot reveal animation. A null known-set means the first sync after
 * mount: everything already existed, and nothing should reveal.
 */
export function newlyBuiltAssetIds(known: ReadonlySet<string> | null, assets: Array<{ id: string }>): string[] {
  if (!known) return []
  return assets.filter((asset) => !known.has(asset.id)).map((asset) => asset.id)
}
