import { describe, expect, test } from 'vitest'
import { STARTER_HOUSE_RECIPE, createConstructionProject } from './construction'
import { constructionDayForecast, planLifeDay, type LifeLadderSnapshot } from './lifeLadder'
import { freshResources } from './resources'

const goodNeeds = { hunger: 80, hydration: 80, energy: 80, hygiene: 80, fun: 70 }

function snap(overrides: Partial<LifeLadderSnapshot> = {}): LifeLadderSnapshot {
  return {
    lifeDay: 1,
    money: 500,
    needs: goodNeeds,
    health: 100,
    level: 1,
    xp: 0,
    jobId: null,
    shiftsWorked: 0,
    activityKind: null,
    assets: [],
    resources: freshResources(),
    constructionProjects: [],
    educationActions: 0,
    communityActionsThisWeek: 0,
    ...overrides,
  }
}

describe('planLifeDay', () => {
  test('returns exactly one primary action with life values attached', () => {
    const plan = planLifeDay(snap())
    expect(plan.primary).toBeTruthy()
    expect(plan.agenda[0].id).toBe(plan.primary.id)
    expect(plan.agenda.length).toBeLessThanOrEqual(3)
    expect(plan.support.length).toBeGreaterThan(0)
    expect(plan.valuesCovered).toEqual(expect.arrayContaining(['body', 'school', 'work', 'respect', 'friendship', 'community', 'capital']))
  })

  test('puts body recovery before work and construction while preserving the next step', () => {
    const plan = planLifeDay(snap({
      jobId: 'barista',
      shiftsWorked: 1,
      educationActions: 1,
      constructionProjects: [createConstructionProject('starter-house', 1, 1, 1)],
      needs: { ...goodNeeds, hydration: 20 },
    }))

    expect(plan.primary.id).toBe('drink-water')
    expect(plan.primary.value).toBe('body')
    expect(plan.agenda.map((item) => item.id)).toEqual(expect.arrayContaining(['drink-water']))
    expect(plan.agenda.some((item) => item.id.startsWith('gather-') || item.id === 'deposit-house-materials')).toBe(true)
  })

  test('sends an unemployed citizen to find work before capital tasks', () => {
    const plan = planLifeDay(snap({ money: 50 }))

    expect(plan.primary.id).toBe('find-job')
    expect(plan.primary.value).toBe('work')
  })

  test('adds school as the early-life primary once body, work, and cash are safe', () => {
    const plan = planLifeDay(snap({
      lifeDay: 3,
      jobId: 'barista',
      shiftsWorked: 1,
      money: 500,
      educationActions: 0,
      level: 1,
      xp: 0,
    }))

    expect(plan.primary.id).toBe('study-first-course')
    expect(plan.primary.value).toBe('school')
  })

  test('never invents high-income tasks for a player with no business', () => {
    const plan = planLifeDay(snap({ jobId: 'barista', shiftsWorked: 1, money: 150 }))
    const ids = [plan.primary, ...plan.support].map((item) => item.id)

    expect(ids).not.toContain('earn-1000')
    expect(ids).not.toContain('earn-2000')
    expect(plan.primary.title).not.toMatch(/\$1,000|\$2,000/)
  })

  test('routes a house project through materials, permit, then free-time labor', () => {
    const project = createConstructionProject('starter-house', 1, 1, 1)
    const gatherPlan = planLifeDay(snap({ jobId: 'barista', shiftsWorked: 1, educationActions: 1, constructionProjects: [project] }))
    expect(gatherPlan.primary.id).toMatch(/^gather-|deposit-house-materials$/)

    const readyForPermit = {
      ...project,
      deposited: freshResources(project.required),
    }
    const permitPlan = planLifeDay(snap({ jobId: 'barista', shiftsWorked: 1, educationActions: 1, money: 1_000, constructionProjects: [readyForPermit] }))
    expect(permitPlan.primary.id).toBe('pay-house-permit')

    const readyForLabor = {
      ...readyForPermit,
      permitFeePaid: true,
    }
    const laborPlan = planLifeDay(snap({ jobId: 'barista', shiftsWorked: 1, educationActions: 1, constructionProjects: [readyForLabor] }))
    expect(laborPlan.primary.id).toBe('build-house-hour')
    expect(laborPlan.agenda[0].id).toBe('build-house-hour')
    expect(laborPlan.agenda.map((item) => item.id)).toContain('support-body')
  })
})

describe('constructionDayForecast', () => {
  test('matches the mandatory Starter House resource and labor math', () => {
    const forecast = constructionDayForecast()
    const trips = Object.fromEntries(forecast.resourceTrips.map((item) => [item.kind, item.trips]))

    expect(STARTER_HOUSE_RECIPE.required).toEqual({ wood: 120, stone: 60, metal: 20, glass: 10 })
    expect(STARTER_HOUSE_RECIPE.permitFee).toBe(500)
    expect(STARTER_HOUSE_RECIPE.laborRequiredMinutes).toBe(480)
    expect(trips).toEqual({ wood: 5, stone: 4, metal: 3, glass: 2 })
    expect(forecast.totalGatherMinutes).toBe(99)
    expect(forecast.playerOnlyDaysAtOneHour).toBe(8)
    expect(forecast.playerOnlyDaysAtTwoHours).toBe(4)
  })
})
