import { describe, expect, test } from 'vitest'
import { createBusinessDevelopmentProject } from './businessDevelopment'
import { createConstructionProject } from './construction'
import { planLifeRoadmap } from './lifeRoadmap'
import type { LifeLadderSnapshot } from './lifeLadder'
import { freshResources } from './resources'
import type { Needs, PlacedAsset } from './types'

const goodNeeds: Needs = { hunger: 80, hydration: 80, energy: 80, hygiene: 80, fun: 70 }

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
    inventory: {},
    resources: freshResources(),
    constructionProjects: [],
    businessDevelopmentProjects: [],
    educationActions: 0,
    educationProgress: [],
    communityActionsThisWeek: 0,
    communityActionsToday: 0,
    communityRespect: 0,
    communityTrust: 0,
    ...overrides,
  }
}

const home = (): PlacedAsset => ({
  id: 'home-1',
  itemId: 'microstudio',
  kind: 'home',
  name: 'Starter House',
  lat: 45,
  lng: 21,
  incomePerDay: 0,
  pendingIncome: 0,
  placedAtMinute: 0,
})

const business = (): PlacedAsset => ({
  id: 'foodcart-1',
  itemId: 'foodcart',
  kind: 'business',
  name: 'Food Cart',
  lat: 45,
  lng: 21,
  incomePerDay: 200,
  pendingIncome: 0,
  placedAtMinute: 0,
  level: 1,
})

describe('planLifeRoadmap', () => {
  test('projects the first eight days from work to school to the starter house build', () => {
    const roadmap = planLifeRoadmap(snap(), 8)

    expect(roadmap.horizonDays).toBe(8)
    expect(roadmap.days).toHaveLength(8)
    expect(roadmap.days[0].primary.id).toBe('find-job')
    expect(roadmap.days[1].primary.id).toBe('first-shift')
    expect(roadmap.days[2].primary.id).toBe('study-first-course')
    expect(roadmap.days[3].primary.id).toBe('place-home-foundation')
    expect(roadmap.days.some((day) => day.primary.id.startsWith('gather-'))).toBe(true)
    expect(roadmap.valuesCovered).toEqual(expect.arrayContaining(['body', 'work', 'school', 'capital']))
    expect(roadmap.finalSnapshot.jobId).toBe('barista')
    expect(roadmap.finalSnapshot.educationActions).toBeGreaterThan(0)
    expect(roadmap.finalSnapshot.constructionProjects.length).toBe(1)
  })

  test('projects Workers Hall helper labor into a completed house asset', () => {
    const project = createConstructionProject('starter-house', 1, 1, 1)
    const readyForFinalHour = {
      ...project,
      deposited: freshResources(project.required),
      permitFeePaid: true,
      laborDoneMinutes: project.laborRequiredMinutes - 60,
    }

    const roadmap = planLifeRoadmap(snap({
      lifeDay: 10,
      money: 1_000,
      jobId: 'barista',
      shiftsWorked: 5,
      educationActions: 1,
      constructionProjects: [readyForFinalHour],
    }), 1)

    expect(roadmap.days[0].primary.id).toBe('hire-house-worker-hour')
    expect(roadmap.finalSnapshot.constructionProjects).toHaveLength(0)
    expect(roadmap.finalSnapshot.assets.some((asset) => asset.kind === 'home')).toBe(true)
  })

  test('projects business interior labor into an upgraded earning asset', () => {
    const asset = business()
    const project = createBusinessDevelopmentProject(asset, 1)
    if (!project) throw new Error('business development fixture failed')
    const readyForFinalHour = {
      ...project,
      deposited: freshResources(project.required),
      budgetPaid: true,
      laborDoneMinutes: project.laborRequiredMinutes - 60,
    }

    const roadmap = planLifeRoadmap(snap({
      lifeDay: 20,
      money: 2_000,
      jobId: 'barista',
      shiftsWorked: 10,
      educationActions: 1,
      communityActionsThisWeek: 1,
      assets: [home(), asset],
      businessDevelopmentProjects: [readyForFinalHour],
    }), 1)

    expect(roadmap.days[0].primary.id).toBe('develop-business-hour')
    expect(roadmap.finalSnapshot.businessDevelopmentProjects).toHaveLength(0)
    expect(roadmap.finalSnapshot.assets.find((candidate) => candidate.id === asset.id)).toMatchObject({
      level: readyForFinalHour.levelTo,
      incomePerDay: readyForFinalHour.incomeAfter,
    })
  })
})
