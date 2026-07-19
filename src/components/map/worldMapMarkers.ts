import type { AssetKind } from '../../game/types'
import { constructionSiteSVG, type ConstructionPhase } from './buildings/sprites'
import { colorForCitizen } from './ownerColor'

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

/** "gathering materials, 42% complete" — shared by the marker title and the
 *  quick-info inspect card so the two never drift. */
export function constructionPhaseSummary(progress: ConstructionMarkerProgress): string {
  const clamped = Math.max(0, Math.min(100, progress.percent))
  return `${PHASE_LABEL[phaseOf(progress)]}, ${clamped}% complete`
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

/**
 * Resource-marker clustering. OSM discovery frequently returns many nodes of
 * the same kind meters apart (a forest = a pile of Wood points), which
 * rendered as an unreadable stack of identical markers. Group same-kind
 * nodes within `radiusMeters` of a cluster's centroid into one marker with
 * a count; tapping gathers from the cluster's first node (same kind, same
 * spot — the distinction was never meaningful to the player).
 */
export interface ClusterableNode {
  id: string
  kind: string
  lat: number
  lng: number
}

export interface ResourceCluster<T extends ClusterableNode> {
  kind: string
  /** Centroid of the clustered nodes — where the single marker renders. */
  lat: number
  lng: number
  nodes: T[]
}

const METERS_PER_DEG_LAT = 111_320

/** Equirectangular approximation — exact enough at neighborhood scale. */
function metersBetween(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = (bLat - aLat) * METERS_PER_DEG_LAT
  const dLng = (bLng - aLng) * METERS_PER_DEG_LAT * Math.cos(((aLat + bLat) / 2) * (Math.PI / 180))
  return Math.hypot(dLat, dLng)
}

/**
 * Other players' placed buildings → a GeoJSON FeatureCollection for the
 * clustered `world-properties` layer, each point stamped with its owner's
 * stable color (P6). Your own assets (matching `myCid`) are filtered out —
 * they render as gold-glow DOM markers you can step into. Pure and
 * MapLibre-free: the layer just consumes the data.
 */
export interface WorldPropertyInput {
  cid: string
  kind: string
  lat: number
  lng: number
  name?: string | null
}

export function worldPropertyFeatures(world: readonly WorldPropertyInput[], myCid: string | undefined) {
  const features = world
    .filter((w) => w.cid !== myCid)
    .map((w) => ({
      type: 'Feature' as const,
      // name rides along for the inspect card (P6); '' when unknown so the
      // MapLibre feature-properties round-trip has no null to trip on.
      properties: { kind: w.kind, color: colorForCitizen(w.cid), name: w.name ?? '' },
      geometry: { type: 'Point' as const, coordinates: [w.lng, w.lat] as [number, number] },
    }))
  return { type: 'FeatureCollection' as const, features }
}

export function clusterResourceNodes<T extends ClusterableNode>(
  nodes: readonly T[],
  radiusMeters = 120,
): ResourceCluster<T>[] {
  const clusters: ResourceCluster<T>[] = []
  for (const node of nodes) {
    const home = clusters.find(
      (c) => c.kind === node.kind && metersBetween(c.lat, c.lng, node.lat, node.lng) <= radiusMeters,
    )
    if (home) {
      home.nodes.push(node)
      // Running centroid — keeps the marker over the middle of the group.
      home.lat = home.nodes.reduce((sum, n) => sum + n.lat, 0) / home.nodes.length
      home.lng = home.nodes.reduce((sum, n) => sum + n.lng, 0) / home.nodes.length
    } else {
      clusters.push({ kind: node.kind, lat: node.lat, lng: node.lng, nodes: [node] })
    }
  }
  return clusters
}
