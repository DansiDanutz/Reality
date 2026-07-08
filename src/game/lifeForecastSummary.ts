import { formatMoney } from './engine'
import type { BusinessDevelopmentDayForecast, ConstructionDayForecast } from './lifeLadder'

function formatForecastMinutes(minutes: number): string {
  if (minutes <= 0) return 'now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`
}

function helperCreditSummary(value: number): string | null {
  if (value <= 0) return null
  return `community -${formatMoney(value)}`
}

export function buildEtaSummary(forecast: ConstructionDayForecast | null): string | null {
  if (!forecast) return null
  const parts: string[] = []
  if (forecast.upfrontCostRemaining > 0) {
    parts.push(`${formatMoney(forecast.upfrontCostRemaining)} foundation`)
    parts.push(forecast.upfrontAffordableToday ? 'place today' : `save ${formatMoney(forecast.upfrontCashNeeded)}`)
  }
  if (forecast.upfrontCostRemaining > 0 && !forecast.upfrontAffordableToday) {
    return `Build ETA: ${parts.join(' · ')}`
  }
  if (forecast.totalGatherMinutes > 0) {
    parts.push(`${formatForecastMinutes(forecast.totalGatherMinutes)} gather`)
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
      parts.push(`${formatForecastMinutes(Math.round(forecast.activeWorkerLaborMinutesRemaining))} paid help left`)
      if (forecast.activeWorkerCompletionLifeDay > 0) parts.push(`finish day ${forecast.activeWorkerCompletionLifeDay}`)
    } else if (forecast.helperTwoHourDays < forecast.playerOnlyDaysAtOneHour && forecast.helperTwoHourAffordableToday) {
      parts.push(`${forecast.helperTwoHourDays}d with helper`)
      parts.push(`finish day ${forecast.helperTwoHourCompletionLifeDay}`)
      parts.push(`${formatMoney(forecast.helperTwoHourCost)}/helper day`)
      const credit = helperCreditSummary(forecast.helperTwoHourCommunityCreditValue)
      if (credit) parts.push(credit)
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
  if (forecast.totalGatherMinutes > 0) parts.push(`${formatForecastMinutes(forecast.totalGatherMinutes)} gather`)
  if (forecast.budgetRemaining > 0) {
    parts.push(`${formatMoney(forecast.budgetRemaining)} budget`)
    parts.push(forecast.budgetAffordableToday ? 'fund today' : `save ${formatMoney(forecast.budgetCashNeeded)}`)
  }
  if (forecast.remainingLaborMinutes > 0) {
    parts.push(`${forecast.playerOnlyDaysAtOneHour}d solo`)
    if (forecast.activeWorkerCount > 0) {
      parts.push(`${forecast.activeWorkerCount} worker active`)
      parts.push(`${formatForecastMinutes(Math.round(forecast.activeWorkerLaborMinutesRemaining))} paid help left`)
      if (forecast.activeWorkerCompletionLifeDay > 0) parts.push(`finish day ${forecast.activeWorkerCompletionLifeDay}`)
    } else if (forecast.helperTwoHourDays < forecast.playerOnlyDaysAtOneHour && forecast.helperTwoHourAffordableToday) {
      parts.push(`${forecast.helperTwoHourDays}d with helper`)
      parts.push(`finish day ${forecast.helperTwoHourCompletionLifeDay}`)
      parts.push(`${formatMoney(forecast.helperTwoHourCost)}/helper day`)
      const credit = helperCreditSummary(forecast.helperTwoHourCommunityCreditValue)
      if (credit) parts.push(credit)
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
