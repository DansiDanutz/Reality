import { formatMoney } from '../../game/engine'
export { buildEtaSummary, interiorEtaSummary } from '../../game/lifeForecastSummary'
import type { LifePlanRoute } from '../../game/lifeLadder'
import type { MillionairePath } from '../../game/millionairePath'

export function formatPlanMinutes(minutes: number): string {
  if (minutes <= 0) return 'now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`
}

export function routineShortLabel(block: { id: string; value: string; route: LifePlanRoute }): string {
  if (block.id === 'sleep-block') return 'Sleep'
  if (block.id === 'body-block') return 'Body'
  if (block.id === 'work-block') return 'Work'
  if (block.id === 'growth-block') {
    if (block.value === 'school') return 'School'
    if (block.value === 'friendship') return 'Friends'
    if (block.value === 'community') return 'Help'
    return 'Respect'
  }
  if (block.route.kind === 'panel' && block.route.panel === 'business') return 'Biz'
  if (block.route.kind === 'panel' && block.route.panel === 'construction') return 'Build'
  if (block.route.kind === 'gather') return 'Gather'
  if (block.route.kind === 'construction-action') {
    if (block.route.action === 'deposit') return 'Deposit'
    if (block.route.action === 'permit') return 'Permit'
    if (block.route.action === 'hire-helper') return 'Hire'
    if (block.route.action === 'complete') {
      if (block.route.resultKind === 'home') return 'Enter'
      if (block.route.resultKind === 'business') return 'Open'
      return 'Finish'
    }
    return 'Build'
  }
  if (block.route.kind === 'business-development-action') {
    if (block.route.action === 'deposit') return 'Deposit'
    if (block.route.action === 'budget') return 'Budget'
    if (block.route.action === 'hire-helper') return 'Hire'
    if (block.route.action === 'complete') return 'Finish'
    return 'Work'
  }
  if (block.route.kind === 'work-action') return 'Work'
  if (block.route.kind === 'community-action') return block.route.actionId === 'check-neighbor' ? 'Friends' : 'Help'
  if (block.route.kind === 'education-action') return 'School'
  if (block.route.kind === 'consume-action') return 'Eat'
  if (block.route.kind === 'cook-action') return 'Cook'
  if (block.route.kind === 'survival-action') return block.route.action === 'sleep' ? 'Sleep' : 'Drink'
  return 'Own'
}

export function millionaireEtaSummary(path: MillionairePath): string | null {
  if (path.stage === 'millionaire') return 'Path to $1M: reached · keep reinvesting'
  const pace = path.daysToMillionaire === null
    ? 'cashflow blocked'
    : `${path.daysToMillionaire}d at current pace`
  const advantage = path.communityAdvantage.dailyOpportunityValue > 0
    ? ` · ${path.communityAdvantage.label} +${formatMoney(path.communityAdvantage.dailyOpportunityValue)}/day`
    : ''
  return `Path to $1M: ${formatMoney(path.millionaireGap)} left · ${pace}${advantage}`
}
