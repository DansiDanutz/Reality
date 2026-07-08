import type { BusinessDevelopmentDayForecast, ConstructionDayForecast, ResourceTripForecast } from '../../game/lifeLadder'
import { formatMoney } from '../../game/engine'
import { RESOURCE_META } from '../../game/resources'
import type { AssetKind } from '../../game/types'

export interface ForecastCardView {
  label: string
  value: string
  detail: string
  tone?: 'gold' | 'ok'
}

export function constructionFinalStageView(
  planKind: AssetKind,
  activeProjectComplete: boolean,
  hasStarterHome: boolean,
): { className: string; label: string } {
  const ready = activeProjectComplete || (planKind === 'home' && hasStarterHome)
  return {
    className: ready ? 'chip gold' : 'chip',
    label: planKind === 'business' ? 'open' : 'inside',
  }
}

export function constructionCompletionActionLabel(planKind: AssetKind, complete: boolean): string {
  if (!complete) return 'Complete'
  return planKind === 'business' ? 'Open business' : 'Enter house'
}

export function constructionForecastCards(forecast: ConstructionDayForecast): ForecastCardView[] {
  const cards: ForecastCardView[] = []
  if (forecast.upfrontCostRemaining > 0) {
    cards.push({
      label: 'Shell',
      value: forecast.upfrontAffordableToday ? 'ready' : formatMoney(forecast.upfrontCashNeeded),
      detail: forecast.upfrontAffordableToday
        ? `${formatMoney(forecast.upfrontCostRemaining)} foundation can be placed today.`
        : `Save this much above the cash floor before buying the shell.`,
      tone: forecast.upfrontAffordableToday ? 'ok' : undefined,
    })
  }
  cards.push({
    label: 'Materials',
    value: forecast.totalGatherMinutes > 0 ? formatForecastMinutes(forecast.totalGatherMinutes) : 'ready',
    detail: forecast.totalGatherMinutes > 0
      ? resourceTripDetail(forecast.resourceTrips)
      : 'All required ingredients are covered.',
    tone: forecast.totalGatherMinutes > 0 ? undefined : 'ok',
  })
  cards.push({
    label: 'Permit',
    value: forecast.permitRemaining > 0 ? formatMoney(forecast.permitRemaining) : 'paid',
    detail: forecast.permitRemaining > 0
      ? forecast.permitAffordableToday
        ? 'Cash floor stays safe; permit can be paid today.'
        : `Save ${formatMoney(forecast.permitCashNeeded)} above the cash floor.`
      : 'Legal gate is complete.',
    tone: forecast.permitRemaining > 0 ? undefined : 'ok',
  })
  cards.push(laborForecastCard(
    forecast.remainingLaborMinutes,
    forecast.playerOnlyDaysAtOneHour,
    forecast.playerOnlyDaysAtTwoHours,
  ))
  cards.push(workerForecastCard({
    remainingLaborMinutes: forecast.remainingLaborMinutes,
    activeWorkerCount: forecast.activeWorkerCount,
    activeWorkerPaidMinutesRemaining: forecast.activeWorkerPaidMinutesRemaining,
    activeWorkerLaborMinutesRemaining: forecast.activeWorkerLaborMinutesRemaining,
    helperTwoHourDays: forecast.helperTwoHourDays,
    helperTwoHourLaborMinutes: forecast.helperTwoHourLaborMinutes,
    helperTwoHourCost: forecast.helperTwoHourCost,
    helperTwoHourAffordableToday: forecast.helperTwoHourAffordableToday,
    helperTwoHourCashNeeded: forecast.helperTwoHourCashNeeded,
    idleLabel: 'no helper needed',
  }))
  cards.push(completionForecastCard({
    remainingLaborMinutes: forecast.remainingLaborMinutes,
    playerOnlyCompletionLifeDay: forecast.playerOnlyCompletionLifeDay,
    helperTwoHourCompletionLifeDay: forecast.helperTwoHourCompletionLifeDay,
    helperTwoHourDays: forecast.helperTwoHourDays,
    helperTwoHourAffordableToday: forecast.helperTwoHourAffordableToday,
    playerOnlyDaysAtOneHour: forecast.playerOnlyDaysAtOneHour,
    activeWorkerCount: forecast.activeWorkerCount,
    activeWorkerCompletionLifeDay: forecast.activeWorkerCompletionLifeDay,
    completeDetail: 'All build gates are ready.',
    setupReady: forecast.upfrontCostRemaining <= 0 && forecast.totalGatherMinutes <= 0 && forecast.permitRemaining <= 0,
    subject: 'build',
  }))
  return cards
}

export function businessDevelopmentForecastCards(forecast: BusinessDevelopmentDayForecast): ForecastCardView[] {
  return [
    {
      label: 'Materials',
      value: forecast.totalGatherMinutes > 0 ? formatForecastMinutes(forecast.totalGatherMinutes) : 'ready',
      detail: forecast.totalGatherMinutes > 0
        ? resourceTripDetail(forecast.resourceTrips)
        : 'Interior ingredients are ready to deposit.',
      tone: forecast.totalGatherMinutes > 0 ? undefined : 'ok',
    },
    {
      label: 'Budget',
      value: forecast.budgetRemaining > 0 ? formatMoney(forecast.budgetRemaining) : 'paid',
      detail: forecast.budgetRemaining > 0
        ? forecast.budgetAffordableToday
          ? 'Development budget can be funded today.'
          : `Save ${formatMoney(forecast.budgetCashNeeded)} above the cash floor.`
        : 'Interior budget is funded.',
      tone: forecast.budgetRemaining > 0 ? undefined : 'ok',
    },
    laborForecastCard(
      forecast.remainingLaborMinutes,
      forecast.playerOnlyDaysAtOneHour,
      forecast.playerOnlyDaysAtTwoHours,
    ),
    workerForecastCard({
      remainingLaborMinutes: forecast.remainingLaborMinutes,
      activeWorkerCount: forecast.activeWorkerCount,
      activeWorkerPaidMinutesRemaining: forecast.activeWorkerPaidMinutesRemaining,
      activeWorkerLaborMinutesRemaining: forecast.activeWorkerLaborMinutesRemaining,
      helperTwoHourDays: forecast.helperTwoHourDays,
      helperTwoHourLaborMinutes: forecast.helperTwoHourLaborMinutes,
      helperTwoHourCost: forecast.helperTwoHourCost,
      helperTwoHourAffordableToday: forecast.helperTwoHourAffordableToday,
      helperTwoHourCashNeeded: forecast.helperTwoHourCashNeeded,
      idleLabel: 'no interior help needed',
    }),
    completionForecastCard({
      remainingLaborMinutes: forecast.remainingLaborMinutes,
      playerOnlyCompletionLifeDay: forecast.playerOnlyCompletionLifeDay,
      helperTwoHourCompletionLifeDay: forecast.helperTwoHourCompletionLifeDay,
      helperTwoHourDays: forecast.helperTwoHourDays,
      helperTwoHourAffordableToday: forecast.helperTwoHourAffordableToday,
      playerOnlyDaysAtOneHour: forecast.playerOnlyDaysAtOneHour,
      activeWorkerCount: forecast.activeWorkerCount,
      activeWorkerCompletionLifeDay: forecast.activeWorkerCompletionLifeDay,
      completeDetail: 'Interior labor is ready.',
      setupReady: forecast.totalGatherMinutes <= 0 && forecast.budgetRemaining <= 0,
      subject: 'interior',
    }),
  ]
}

function laborForecastCard(
  remainingLaborMinutes: number,
  playerOnlyDaysAtOneHour: number,
  playerOnlyDaysAtTwoHours: number,
): ForecastCardView {
  if (remainingLaborMinutes <= 0) {
    return {
      label: 'Labor',
      value: 'ready',
      detail: 'All labor is complete.',
      tone: 'ok',
    }
  }
  return {
    label: 'Labor',
    value: formatForecastMinutes(remainingLaborMinutes),
    detail: `${playerOnlyDaysAtOneHour}d at 1h/day or ${playerOnlyDaysAtTwoHours}d at 2h/day.`,
  }
}

function workerForecastCard(input: {
  remainingLaborMinutes: number
  activeWorkerCount: number
  activeWorkerPaidMinutesRemaining: number
  activeWorkerLaborMinutesRemaining: number
  helperTwoHourDays: number
  helperTwoHourLaborMinutes: number
  helperTwoHourCost: number
  helperTwoHourAffordableToday: boolean
  helperTwoHourCashNeeded: number
  idleLabel: string
}): ForecastCardView {
  if (input.remainingLaborMinutes <= 0) {
    return {
      label: 'Workers',
      value: input.idleLabel,
      detail: 'No more paid help is required for this step.',
      tone: 'ok',
    }
  }
  if (input.activeWorkerCount > 0) {
    return {
      label: 'Workers',
      value: `${input.activeWorkerCount} active`,
      detail: `${formatForecastMinutes(input.activeWorkerPaidMinutesRemaining)} paid time can add ${formatForecastMinutes(Math.round(input.activeWorkerLaborMinutesRemaining))} labor.`,
      tone: 'gold',
    }
  }
  return {
    label: 'Workers',
    value: `${input.helperTwoHourDays}d helper plan`,
    detail: `2h helper adds ${formatForecastMinutes(input.helperTwoHourLaborMinutes)} labor/day for ${formatMoney(input.helperTwoHourCost)}${input.helperTwoHourAffordableToday ? '; affordable today.' : `; save ${formatMoney(input.helperTwoHourCashNeeded)}.`}`,
  }
}

function completionForecastCard(input: {
  remainingLaborMinutes: number
  playerOnlyCompletionLifeDay: number
  helperTwoHourCompletionLifeDay: number
  helperTwoHourDays: number
  helperTwoHourAffordableToday: boolean
  playerOnlyDaysAtOneHour: number
  activeWorkerCount: number
  activeWorkerCompletionLifeDay: number
  completeDetail: string
  setupReady: boolean
  subject: 'build' | 'interior'
}): ForecastCardView {
  if (input.remainingLaborMinutes <= 0) {
    return {
      label: 'Finish',
      value: 'ready',
      detail: input.completeDetail,
      tone: 'ok',
    }
  }
  if (input.activeWorkerCount > 0 && input.activeWorkerCompletionLifeDay > 0) {
    return {
      label: 'Finish',
      value: `day ${input.activeWorkerCompletionLifeDay}`,
      detail: `${input.setupReady ? 'Active paid help plus your free hour' : 'Once gates are ready, active paid help plus your free hour'} can finish the ${input.subject} by then.`,
      tone: 'gold',
    }
  }
  if (input.helperTwoHourDays < input.playerOnlyDaysAtOneHour && input.helperTwoHourAffordableToday) {
    return {
      label: 'Finish',
      value: `day ${input.helperTwoHourCompletionLifeDay}`,
      detail: `${input.setupReady ? '2h helper plan' : 'After setup, a 2h helper plan'} beats solo day ${input.playerOnlyCompletionLifeDay}.`,
      tone: 'gold',
    }
  }
  if (input.helperTwoHourDays < input.playerOnlyDaysAtOneHour) {
    return {
      label: 'Finish',
      value: `day ${input.playerOnlyCompletionLifeDay}`,
      detail: `Solo path; helper can shorten to day ${input.helperTwoHourCompletionLifeDay} after cash is safe.`,
    }
  }
  return {
    label: 'Finish',
    value: `day ${input.playerOnlyCompletionLifeDay}`,
    detail: `${input.setupReady ? 'At' : 'After setup at'} 1h/day after body care and work.`,
  }
}

function resourceTripDetail(trips: ResourceTripForecast[]): string {
  return trips
    .filter((trip) => trip.trips > 0)
    .map((trip) => `${RESOURCE_META[trip.kind].label} ${trip.trips} trip${trip.trips === 1 ? '' : 's'}`)
    .join(' · ')
}

function formatForecastMinutes(minutes: number): string {
  if (minutes <= 0) return 'ready'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`
}
