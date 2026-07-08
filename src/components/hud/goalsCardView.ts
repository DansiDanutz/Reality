import { formatMoney } from '../../game/engine'
import type {
  BusinessDevelopmentDayForecast,
  ConstructionDayForecast,
  LifePlanRoute,
} from '../../game/lifeLadder'
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

export function buildEtaSummary(forecast: ConstructionDayForecast | null): string | null {
  if (!forecast) return null
  const parts: string[] = []
  if (forecast.upfrontCostRemaining > 0) {
    parts.push(`${formatMoney(forecast.upfrontCostRemaining)} shell`)
    parts.push(forecast.upfrontAffordableToday ? 'place today' : `save ${formatMoney(forecast.upfrontCashNeeded)}`)
  }
  if (forecast.upfrontCostRemaining > 0 && !forecast.upfrontAffordableToday) {
    return `Build ETA: ${parts.join(' · ')}`
  }
  if (forecast.totalGatherMinutes > 0) {
    parts.push(`${formatPlanMinutes(forecast.totalGatherMinutes)} gather`)
    if (forecast.permitRemaining > 0) {
      parts.push(`${formatMoney(forecast.permitRemaining)} permit`)
      parts.push(forecast.permitAffordableToday ? 'permit ready' : `save ${formatMoney(forecast.permitCashNeeded)}`)
    }
    return `Build ETA: ${parts.join(' · ')}`
  }
  if (forecast.permitRemaining > 0 && forecast.upfrontAffordableToday) {
    parts.push(`${formatMoney(forecast.permitRemaining)} permit`)
    parts.push(forecast.permitAffordableToday ? 'permit ready' : `save ${formatMoney(forecast.permitCashNeeded)}`)
    if (!forecast.permitAffordableToday) return `Build ETA: ${parts.join(' · ')}`
  }
  if (forecast.remainingLaborMinutes > 0) {
    parts.push(`${forecast.playerOnlyDaysAtOneHour}d solo`)
    if (forecast.activeWorkerCount > 0) {
      parts.push(`${forecast.activeWorkerCount} worker active`)
      parts.push(`${formatPlanMinutes(Math.round(forecast.activeWorkerLaborMinutesRemaining))} paid help left`)
      if (forecast.activeWorkerCompletionLifeDay > 0) parts.push(`finish day ${forecast.activeWorkerCompletionLifeDay}`)
    } else if (forecast.helperTwoHourDays < forecast.playerOnlyDaysAtOneHour && forecast.helperTwoHourAffordableToday) {
      parts.push(`${forecast.helperTwoHourDays}d with helper`)
      parts.push(`finish day ${forecast.helperTwoHourCompletionLifeDay}`)
      parts.push(`${formatMoney(forecast.helperTwoHourCost)}/helper day`)
      parts.push('hire today')
    } else if (forecast.helperTwoHourDays < forecast.playerOnlyDaysAtOneHour) {
      parts.push(`finish day ${forecast.playerOnlyCompletionLifeDay} solo`)
      parts.push(`${forecast.helperTwoHourDays}d with helper after saving`)
      parts.push(`save ${formatMoney(forecast.helperTwoHourCashNeeded)}`)
    } else {
      parts.push(`finish day ${forecast.playerOnlyCompletionLifeDay}`)
    }
  }
  if (parts.length === 0) return 'Build ready to complete'
  return `Build ETA: ${parts.join(' · ')}`
}

export function interiorEtaSummary(forecast: BusinessDevelopmentDayForecast | null): string | null {
  if (!forecast) return null
  const parts: string[] = []
  if (forecast.totalGatherMinutes > 0) parts.push(`${formatPlanMinutes(forecast.totalGatherMinutes)} gather`)
  if (forecast.budgetRemaining > 0) {
    parts.push(`${formatMoney(forecast.budgetRemaining)} budget`)
    parts.push(forecast.budgetAffordableToday ? 'fund today' : `save ${formatMoney(forecast.budgetCashNeeded)}`)
  }
  if (forecast.remainingLaborMinutes > 0) {
    parts.push(`${forecast.playerOnlyDaysAtOneHour}d solo`)
    if (forecast.activeWorkerCount > 0) {
      parts.push(`${forecast.activeWorkerCount} worker active`)
      parts.push(`${formatPlanMinutes(Math.round(forecast.activeWorkerLaborMinutesRemaining))} paid help left`)
      if (forecast.activeWorkerCompletionLifeDay > 0) parts.push(`finish day ${forecast.activeWorkerCompletionLifeDay}`)
    } else if (forecast.helperTwoHourDays < forecast.playerOnlyDaysAtOneHour && forecast.helperTwoHourAffordableToday) {
      parts.push(`${forecast.helperTwoHourDays}d with helper`)
      parts.push(`finish day ${forecast.helperTwoHourCompletionLifeDay}`)
      parts.push(`${formatMoney(forecast.helperTwoHourCost)}/helper day`)
      if (forecast.budgetRemaining <= 0) {
        parts.push('hire today')
      }
    } else if (forecast.helperTwoHourDays < forecast.playerOnlyDaysAtOneHour) {
      parts.push(`finish day ${forecast.playerOnlyCompletionLifeDay} solo`)
      parts.push(`${forecast.helperTwoHourDays}d with helper after saving`)
      if (forecast.budgetRemaining <= 0) parts.push(`save ${formatMoney(forecast.helperTwoHourCashNeeded)}`)
    } else {
      parts.push(`finish day ${forecast.playerOnlyCompletionLifeDay}`)
    }
  }
  if (parts.length === 0) return 'Interior ready to finish'
  return `Interior ETA: ${parts.join(' · ')}`
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
