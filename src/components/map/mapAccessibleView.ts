import { constructionPhaseSummary } from './worldMapMarkers'
import { constructionProgress, type ConstructionProject } from '../../game/construction'
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
