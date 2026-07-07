import {
  businessDevelopmentLaborBreakdown,
  businessDevelopmentProgress,
  businessDevelopmentShortfall,
  type BusinessDevelopmentProject,
} from '../../game/businessDevelopment'
import { formatMoney } from '../../game/engine'
import { RESOURCE_KINDS, RESOURCE_META } from '../../game/resources'

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

export function businessInteriorAssetView(project: BusinessDevelopmentProject) {
  const progress = businessDevelopmentProgress(project)
  const missing = businessDevelopmentShortfall(project)
  const labor = businessDevelopmentLaborBreakdown(project)
  const missingText = missingResourceText(missing)
  const activeWorkers = (project.workerContracts ?? []).filter((contract) => contract.workedMinutes < contract.paidMinutes)
  return {
    progress,
    missingText,
    labor,
    activeWorkerCount: activeWorkers.length,
    title: `${project.businessName} interior`,
    levelText: `L${project.levelFrom} to L${project.levelTo}`,
    incomeText: `+${formatMoney(project.incomeDelta)}/day when finished`,
    materialText: progress.resourcesComplete ? 'materials ready' : `missing ${missingText}`,
    budgetText: project.budgetPaid ? 'budget paid' : `${formatMoney(project.budgetCost)} budget`,
    laborText: `${formatMinutes(labor.remainingMinutes)} labor left`,
    workerText: activeWorkers.length > 0 ? `${activeWorkers.length} worker active` : null,
    percentText: `${progress.percent}% ready`,
  }
}
