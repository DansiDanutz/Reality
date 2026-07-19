import { constructionPhaseSummary } from './worldMapMarkers'
import { constructionProgress, type ConstructionProject } from '../../game/construction'
import { RESOURCE_META, type ResourceNode } from '../../game/resources'

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
