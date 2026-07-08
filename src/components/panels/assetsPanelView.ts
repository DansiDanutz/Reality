import {
  businessDevelopmentLaborBreakdown,
  businessDevelopmentProgress,
  businessDevelopmentShortfall,
  type BusinessDevelopmentProject,
} from '../../game/businessDevelopment'
import {
  constructionLaborBreakdown,
  constructionProgress,
  constructionShortfall,
  type ConstructionProject,
} from '../../game/construction'
import { formatMoney } from '../../game/engine'
import { RESOURCE_KINDS, RESOURCE_META } from '../../game/resources'
import type { PlacedAsset } from '../../game/types'
import type { MapTarget, PanelId } from '../../store/gameStore'
import { activeWorkerContractViews, activeWorkerSummaryText } from './workerContractView'

export interface AssetMenuAction {
  label: string
  target: MapTarget
  panel: PanelId
}

export interface AssetMenuNavigation {
  primary: AssetMenuAction
  map: AssetMenuAction
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h <= 0) return `${m}m`
  if (m <= 0) return `${h}h`
  return `${h}h ${m}m`
}

function missingResourceText(missing: Record<string, number>): string {
  return RESOURCE_KINDS.filter((kind) => missing[kind] > 0)
    .map((kind) => `${missing[kind]} ${RESOURCE_META[kind].label.toLowerCase()}`)
    .join(', ')
}

function activeWorkerText(count: number): string | null {
  if (count <= 0) return null
  return `${count} worker${count === 1 ? '' : 's'} active`
}

export function constructionAssetView(project: ConstructionProject, now = Date.now()) {
  const progress = constructionProgress(project)
  const missing = constructionShortfall(project)
  const labor = constructionLaborBreakdown(project)
  const missingText = missingResourceText(missing)
  const workerViews = activeWorkerContractViews(project.workerContracts, now)
  return {
    progress,
    missingText,
    labor,
    activeWorkerCount: workerViews.length,
    workerViews,
    materialText: progress.resourcesComplete ? 'materials ready' : `missing ${missingText}`,
    permitText: project.permitFeePaid ? 'permit paid' : `${formatMoney(project.permitFee)} permit`,
    laborText: `${formatMinutes(labor.remainingMinutes)} labor left`,
    workerText: activeWorkerText(workerViews.length),
    workerEtaText: activeWorkerSummaryText(project.workerContracts, now),
    percentText: `${progress.percent}% built`,
    completionText: project.resultKind === 'business' ? 'open' : 'home',
  }
}

export function constructionAssetNavigation(project: Pick<ConstructionProject, 'id'>): AssetMenuNavigation {
  const target: MapTarget = { kind: 'construction', id: project.id }
  return {
    primary: { label: 'Build plan', target, panel: 'construction' },
    map: { label: 'Show map', target, panel: null },
  }
}

export function businessInteriorAssetView(project: BusinessDevelopmentProject, now = Date.now()) {
  const progress = businessDevelopmentProgress(project)
  const missing = businessDevelopmentShortfall(project)
  const labor = businessDevelopmentLaborBreakdown(project)
  const missingText = missingResourceText(missing)
  const workerViews = activeWorkerContractViews(project.workerContracts, now)
  return {
    progress,
    missingText,
    labor,
    activeWorkerCount: workerViews.length,
    workerViews,
    title: `${project.businessName} interior`,
    levelText: `L${project.levelFrom} to L${project.levelTo}`,
    incomeText: `+${formatMoney(project.incomeDelta)}/day when finished`,
    materialText: progress.resourcesComplete ? 'materials ready' : `missing ${missingText}`,
    budgetText: project.budgetPaid ? 'budget paid' : `${formatMoney(project.budgetCost)} budget`,
    laborText: `${formatMinutes(labor.remainingMinutes)} labor left`,
    workerText: activeWorkerText(workerViews.length),
    workerEtaText: activeWorkerSummaryText(project.workerContracts, now),
    percentText: `${progress.percent}% ready`,
  }
}

export function businessInteriorAssetNavigation(project: Pick<BusinessDevelopmentProject, 'businessId'>): AssetMenuNavigation {
  const target: MapTarget = { kind: 'asset', id: project.businessId }
  return {
    primary: { label: 'Open plan', target, panel: 'business' },
    map: { label: 'Show map', target, panel: null },
  }
}

export function completedAssetNavigation(asset: Pick<PlacedAsset, 'id' | 'kind'>): AssetMenuNavigation {
  const target: MapTarget = { kind: 'asset', id: asset.id }
  return {
    primary: { label: 'Enter', target, panel: asset.kind === 'home' ? 'home' : 'business' },
    map: { label: 'Show map', target, panel: null },
  }
}
