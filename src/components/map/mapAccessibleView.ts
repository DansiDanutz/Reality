import { constructionPhaseSummary } from './worldMapMarkers'
import { constructionProgress, type ConstructionProject } from '../../game/construction'
import { distanceKm } from '../../game/engine'
import { RESOURCE_META, type ResourceNode } from '../../game/resources'

export interface AccessibleResourceGroup {
  kind: ResourceNode['kind']
  label: string
  nodes: ResourceNode[]
}

export function groupResourceNodesForAccessibility(nodes: readonly ResourceNode[]): AccessibleResourceGroup[] {
  const groups = new Map<ResourceNode['kind'], ResourceNode[]>()
  for (const node of nodes) groups.set(node.kind, [...(groups.get(node.kind) ?? []), node])
  return [...groups.entries()].map(([kind, grouped]) => ({
    kind,
    label: `${RESOURCE_META[kind].label} resources (${grouped.length})`,
    nodes: grouped,
  }))
}

export function resourceAccessibleLabel(node: Pick<ResourceNode, 'label' | 'kind' | 'source' | 'yieldAmount' | 'gatherMinutes' | 'energyCost'>): string {
  return `${node.label}, ${RESOURCE_META[node.kind].label}. Gather ${node.yieldAmount} ${node.kind} in ${node.gatherMinutes} minutes, costing ${node.energyCost} energy${node.source === 'fallback' ? ', local fallback node' : ''}.`
}

/**
 * Other players' buildings (P6) live in an aria-hidden MapLibre circle layer,
 * so the click-to-inspect owner card is unreachable by keyboard/screen reader.
 * The semantic holdings list surfaces the nearest few as focusable controls so
 * that owner info is discoverable without a pointer. Nearest-to-anchor and
 * capped, because the world can hold thousands of properties.
 */
export interface ForeignProperty {
  cid: string
  kind: string
  lat: number
  lng: number
  name?: string | null
}

export function nearestForeignProperties<T extends ForeignProperty>(
  world: readonly T[],
  myCid: string | undefined,
  anchor: { lat: number; lng: number } | null,
  limit = 24,
): T[] {
  const foreign = world.filter((w) => w.cid !== myCid)
  if (!anchor) return foreign.slice(0, limit)
  return [...foreign]
    .sort((a, b) => distanceKm(anchor.lat, anchor.lng, a.lat, a.lng) - distanceKm(anchor.lat, anchor.lng, b.lat, b.lng))
    .slice(0, limit)
}

export function ownerAccessibleLabel(name: string | null | undefined, kind: string): string {
  const who = name && name.trim() ? name.trim() : 'A fellow founder'
  const what = kind === 'business' ? 'business' : 'home'
  return `${who}'s ${what}, another founder. Activate to locate it on the map.`
}

export function constructionAccessibleLabel(project: ConstructionProject): string {
  const progress = constructionProgress(project)
  const laborRatio = project.laborRequiredMinutes <= 0 ? 1 : Math.min(1, project.laborDoneMinutes / project.laborRequiredMinutes)
  return `${project.name}, ${project.resultKind === 'business' ? 'business' : 'home'} construction site. ${constructionPhaseSummary({
    percent: progress.percent,
    resourcesComplete: progress.resourcesComplete,
    permitComplete: progress.permitComplete,
    laborRatio,
  })}. Open Build to continue.`
}
