import { describe, expect, test } from 'vitest'
import { createBusinessDevelopmentProject, depositBusinessDevelopmentResources, payBusinessDevelopmentBudget } from '../../game/businessDevelopment'
import { createConstructionProject, STARTER_HOUSE_RECIPE } from '../../game/construction'
import {
  businessDevelopmentDayForecast,
  constructionDayForecast,
  type LifePlanRoute,
} from '../../game/lifeLadder'
import { millionairePathOf, type MillionairePathInput } from '../../game/millionairePath'
import { freshResources } from '../../game/resources'
import type { Needs } from '../../game/types'
import type { PlacedAsset } from '../../game/types'
import {
  buildEtaSummary,
  formatPlanMinutes,
  interiorEtaSummary,
  millionaireEtaSummary,
  roadmapPreviewHeading,
  roadmapPreviewSummary,
  routineShortLabel,
} from './goalsCardView'

const goodNeeds: Needs = { hunger: 80, hydration: 80, energy: 80, hygiene: 80, fun: 80 }

function path(overrides: Partial<MillionairePathInput> = {}) {
  return millionairePathOf({
    money: 500,
    inventory: {},
    assets: [],
    needs: goodNeeds,
    health: 100,
    level: 1,
    jobWage: 15,
    shiftsWorked: 0,
    educationActions: 0,
    communityRespect: 0,
    communityFriendship: 0,
    communityTrust: 0,
    ...overrides,
  })
}

const routineBlock = (
  route: LifePlanRoute,
  id = 'free-time-block',
  value = 'capital',
) => ({ id, value, route })

const business = (): PlacedAsset => ({
  id: 'foodcart-1',
  itemId: 'foodcart',
  kind: 'business',
  name: 'Food Cart',
  lat: 45,
  lng: 21,
  incomePerDay: 240,
  pendingIncome: 0,
  placedAtMinute: 0,
  level: 1,
})

describe('formatPlanMinutes', () => {
  test('keeps daily routine durations compact', () => {
    expect(formatPlanMinutes(0)).toBe('now')
    expect(formatPlanMinutes(45)).toBe('45m')
    expect(formatPlanMinutes(60)).toBe('1h')
    expect(formatPlanMinutes(75)).toBe('1h 15m')
  })
})

describe('roadmapPreviewSummary', () => {
  test('summarizes the next-day forecast in one readable line', () => {
    expect(roadmapPreviewSummary('Day 2', 'Study Course', 60)).toBe('Day 2: Study Course (1h)')
  })
})

describe('roadmapPreviewHeading', () => {
  test('labels the number of upcoming days clearly', () => {
    expect(roadmapPreviewHeading(1)).toBe('Next day')
    expect(roadmapPreviewHeading(2)).toBe('Next 2 days')
  })
})

describe('routineShortLabel', () => {
  test('names fixed daily anchors clearly', () => {
    expect(routineShortLabel(routineBlock({ kind: 'survival-action', action: 'sleep' }, 'sleep-block', 'body'))).toBe('Sleep')
    expect(routineShortLabel(routineBlock({ kind: 'survival-action', action: 'drink-water' }, 'body-block', 'body'))).toBe('Body')
    expect(routineShortLabel(routineBlock({ kind: 'work-action', action: 'shift' }, 'work-block', 'work'))).toBe('Work')
    expect(routineShortLabel(routineBlock({ kind: 'market', focus: 'education' }, 'growth-block', 'school'))).toBe('School')
    expect(routineShortLabel(routineBlock({ kind: 'community-action', actionId: 'check-neighbor' }, 'growth-block', 'friendship'))).toBe('Friends')
    expect(routineShortLabel(routineBlock({ kind: 'community-action', actionId: 'help-errand' }, 'growth-block', 'community'))).toBe('Help')
  })

  test('names active construction work by the exact next action', () => {
    expect(routineShortLabel(routineBlock({ kind: 'panel', panel: 'construction' }))).toBe('Build')
    expect(routineShortLabel(routineBlock({ kind: 'gather', resourceKind: 'wood' }))).toBe('Gather')
    expect(routineShortLabel(routineBlock({ kind: 'construction-action', projectId: 'house-1', action: 'deposit' }))).toBe('Deposit')
    expect(routineShortLabel(routineBlock({ kind: 'construction-action', projectId: 'house-1', action: 'permit' }))).toBe('Permit')
    expect(routineShortLabel(routineBlock({ kind: 'construction-action', projectId: 'house-1', action: 'hire-helper', hours: 2 }))).toBe('Hire')
    expect(routineShortLabel(routineBlock({ kind: 'construction-action', projectId: 'house-1', action: 'work' }))).toBe('Build')
    expect(routineShortLabel(routineBlock({ kind: 'construction-action', projectId: 'house-1', action: 'complete' }))).toBe('Finish')
    expect(routineShortLabel(routineBlock({ kind: 'construction-action', projectId: 'house-1', action: 'complete', resultKind: 'home' }))).toBe('Enter')
    expect(routineShortLabel(routineBlock({ kind: 'construction-action', projectId: 'biz-1', action: 'complete', resultKind: 'business' }))).toBe('Open')
  })

  test('names active business interior work by the exact next action', () => {
    expect(routineShortLabel(routineBlock({ kind: 'panel', panel: 'business' }))).toBe('Biz')
    expect(routineShortLabel(routineBlock({ kind: 'business-development-action', projectId: 'biz-1', action: 'deposit' }))).toBe('Deposit')
    expect(routineShortLabel(routineBlock({ kind: 'business-development-action', projectId: 'biz-1', action: 'budget' }))).toBe('Budget')
    expect(routineShortLabel(routineBlock({ kind: 'business-development-action', projectId: 'biz-1', action: 'hire-helper', hours: 2 }))).toBe('Hire')
    expect(routineShortLabel(routineBlock({ kind: 'business-development-action', projectId: 'biz-1', action: 'work' }))).toBe('Work')
    expect(routineShortLabel(routineBlock({ kind: 'business-development-action', projectId: 'biz-1', action: 'complete' }))).toBe('Finish')
  })
})

describe('buildEtaSummary', () => {
  test('summarizes construction ingredients, permit, and labor in the Today forecast', () => {
    const forecast = constructionDayForecast(
      createConstructionProject('starter-house', 45, 21, 1),
      freshResources(),
      1_000,
      100,
      15_000,
      8,
    )

    expect(buildEtaSummary(forecast)).toContain('Build ETA:')
    expect(buildEtaSummary(forecast)).toContain('foundation')
    expect(buildEtaSummary(forecast)).toContain('save')
  })

  test('shows place today when the first foundation cost is already affordable', () => {
    const forecast = constructionDayForecast(
      createConstructionProject('starter-house', 45, 21, 1),
      freshResources(),
      20_000,
      100,
      15_000,
      8,
    )

    expect(buildEtaSummary(forecast)).toContain('foundation')
    expect(buildEtaSummary(forecast)).toContain('place today')
  })

  test('does not treat active paid worker labor as a repeating daily forecast', () => {
    const project = createConstructionProject('starter-house', 45, 21, 1)
    const forecast = constructionDayForecast(
      {
        ...project,
        deposited: freshResources(project.required),
        permitFeePaid: true,
        laborDoneMinutes: 120,
        hiredLaborMinutes: 60,
        workerContracts: [{
          id: 'worker-1',
          source: 'workers-hall' as const,
          workerId: 'builder' as const,
          workerName: 'Skilled builder',
          hiredAt: 1,
          paidUntil: 3_600_001,
          paidMinutes: 60,
          workedMinutes: 20,
          laborMultiplier: 1.5,
          ratePerHour: 28,
          cost: 28,
        }],
      },
      freshResources(),
      500,
    )

    expect(forecast.activeWorkerLaborMinutesRemaining).toBe(60)
    expect(buildEtaSummary(forecast)).toContain('finish day 5')
  })

  test('shows community helper credit in the compact build ETA', () => {
    const project = {
      ...createConstructionProject('starter-house', 45, 21, 1),
      deposited: freshResources(STARTER_HOUSE_RECIPE.required),
      permitFeePaid: true,
      laborDoneMinutes: 120,
    }
    const forecast = constructionDayForecast(project, freshResources(), 124, undefined, undefined, 1, 30)

    expect(buildEtaSummary(forecast)).toContain('community -$8')
  })
})

describe('interiorEtaSummary', () => {
  test('summarizes business interior budget and worker path in the Today forecast', () => {
    const project = createBusinessDevelopmentProject(business(), 1)
    if (!project) throw new Error('business development fixture failed')
    const forecast = businessDevelopmentDayForecast(
      { ...project, deposited: freshResources(project.required), budgetPaid: true },
      freshResources(),
      1_000,
      100,
      15,
    )

    expect(interiorEtaSummary(forecast)).toContain('Interior ETA:')
    expect(interiorEtaSummary(forecast)).toContain('d solo')
    expect(interiorEtaSummary(forecast)).toContain('with helper')
  })

  test('shows community helper credit in the compact interior ETA', () => {
    const project = createBusinessDevelopmentProject(business(), 1)
    if (!project) throw new Error('business development fixture failed')
    const deposited = depositBusinessDevelopmentResources(project, freshResources(project.required)).project
    const paid = payBusinessDevelopmentBudget(deposited, project.budgetCost).project
    const forecast = businessDevelopmentDayForecast(paid, freshResources(), 124, undefined, 1, 30)

    expect(interiorEtaSummary(forecast)).toContain('community -$8')
  })
})

describe('millionaireEtaSummary', () => {
  test('keeps the path forecast clean before community backing exists', () => {
    const summary = millionaireEtaSummary(path())

    expect(summary).toContain('Path to $1M')
    expect(summary).toContain('at current pace')
    expect(summary).not.toContain('+/day')
  })

  test('surfaces practical community advantage in the daily forecast', () => {
    const summary = millionaireEtaSummary(path({
      money: 50_000,
      level: 2,
      educationActions: 1,
      shiftsWorked: 8,
      communityRespect: 8,
      communityFriendship: 12,
      communityTrust: 8,
    }))

    expect(summary).toContain('Community backed +$45/day')
  })

  test('keeps the millionaire completion line simple', () => {
    expect(millionaireEtaSummary(path({ money: 1_000_000 }))).toBe('Path to $1M: reached · keep reinvesting')
  })
})
