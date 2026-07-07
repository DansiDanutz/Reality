import { describe, expect, test } from 'vitest'
import {
  COURIER_PACKAGES,
  courierPackageForLifePlan,
  courierPackageForDay,
  courierRequirementMet,
  shouldCreateCourierPackage,
} from './courierPackages'
import { STARTER_HOUSE_RECIPE, createConstructionProject } from './construction'
import { EDUCATION_COURSES, createEducationProgress } from './education'
import { freshResources } from './resources'

describe('courierPackages', () => {
  test('defines the first 10 MVP packages in order', () => {
    expect(COURIER_PACKAGES).toHaveLength(10)
    expect(COURIER_PACKAGES.map((pkg) => pkg.day)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  test('returns packages for MVP days only', () => {
    expect(courierPackageForDay(1)?.title).toBe('The first package')
    expect(courierPackageForDay(10)?.title).toBe('A door of your own')
    expect(courierPackageForDay(11)).toBeNull()
  })

  test('enforces once-per-local-day courier creation', () => {
    const first = shouldCreateCourierPackage({
      citizenAgeDay: 1,
      localDay: 20_001,
      courierLastDay: 20_000,
      completedDays: [],
    })
    expect(first?.day).toBe(1)
    expect(shouldCreateCourierPackage({
      citizenAgeDay: 1,
      localDay: 20_001,
      courierLastDay: 20_001,
      completedDays: [],
    })).toBeNull()
  })

  test('does not recreate completed package days', () => {
    expect(shouldCreateCourierPackage({
      citizenAgeDay: 3,
      localDay: 20_003,
      courierLastDay: 20_002,
      completedDays: [3],
    })).toBeNull()
  })

  test('checks resource and construction requirements', () => {
    const woodDay = courierPackageForDay(4)!
    expect(courierRequirementMet(woodDay, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources({ wood: 24 }),
      constructionProjects: [],
      hasHome: false,
    })).toBe(false)
    expect(courierRequirementMet(woodDay, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources({ wood: 25 }),
      constructionProjects: [],
      hasHome: false,
    })).toBe(true)

    const project = {
      ...createConstructionProject('starter-house', 45, 21, 1),
      deposited: freshResources({ wood: 25, stone: 15 }),
      laborDoneMinutes: STARTER_HOUSE_RECIPE.laborRequiredMinutes,
    }
    expect(courierRequirementMet(courierPackageForDay(7)!, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [project],
      hasHome: false,
    })).toBe(true)
  })

  test('checks Life Ladder job, shift, education, and community requirements', () => {
    expect(courierRequirementMet({ ...courierPackageForDay(1)!, requirement: { kind: 'job' } }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      hasHome: false,
      jobId: null,
    })).toBe(false)
    expect(courierRequirementMet({ ...courierPackageForDay(1)!, requirement: { kind: 'job' } }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      hasHome: false,
      jobId: 'barista',
    })).toBe(true)
    expect(courierRequirementMet({ ...courierPackageForDay(1)!, requirement: { kind: 'shift', shiftsWorked: 3 } }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      hasHome: false,
      shiftsWorked: 2,
    })).toBe(false)
    expect(courierRequirementMet({ ...courierPackageForDay(1)!, requirement: { kind: 'education-enrolled', courseId: 'course' } }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      hasHome: false,
      educationProgress: [],
    })).toBe(false)
    expect(courierRequirementMet({ ...courierPackageForDay(1)!, requirement: { kind: 'education-enrolled', courseId: 'course' } }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      hasHome: false,
      educationProgress: [createEducationProgress(EDUCATION_COURSES.course, 1_000)],
    })).toBe(true)
    expect(courierRequirementMet({ ...courierPackageForDay(1)!, requirement: { kind: 'education', educationActions: 1 } }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      hasHome: false,
      educationActions: 1,
    })).toBe(true)
    expect(courierRequirementMet({ ...courierPackageForDay(1)!, requirement: { kind: 'community', actionsThisWeek: 2 } }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      hasHome: false,
      communityActionsThisWeek: 2,
    })).toBe(true)
  })

  test('wraps the current Life Ladder primary task as the courier objective', () => {
    const pkg = courierPackageForLifePlan(2, {
      id: 'first-shift',
      title: 'Work your first shift',
      detail: 'A reliable first shift funds food, water, and the first build.',
      value: 'work',
      minutes: 480,
      route: { kind: 'work-action', action: 'shift' },
    }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      hasHome: false,
      shiftsWorked: 0,
    })

    expect(pkg).toMatchObject({
      day: 2,
      title: 'Work your first shift',
      objective: 'Work your first shift',
      requirement: { kind: 'shift', shiftsWorked: 1 },
    })
    expect(pkg?.story).toContain('Life Ladder')
  })

  test('turns course enrollment tasks into enrollment requirements', () => {
    const pkg = courierPackageForLifePlan(2, {
      id: 'study-first-course',
      title: 'Study one useful skill',
      detail: 'School compounds wages. Do one course while your body and income are safe.',
      value: 'school',
      minutes: 60,
      route: { kind: 'market', focus: 'education' },
    }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      hasHome: false,
      educationActions: 0,
      educationProgress: [],
    })

    expect(pkg).toMatchObject({
      day: 2,
      title: 'Study one useful skill',
      objective: 'Study one useful skill',
      requirement: { kind: 'education-enrolled', courseId: 'course' },
    })
  })

  test('turns study tasks into earned education action requirements', () => {
    const pkg = courierPackageForLifePlan(2, {
      id: 'study-course',
      title: 'Study Online Course',
      detail: '60 minutes remain. Finish the course block before chasing the next credential.',
      value: 'school',
      minutes: 60,
      route: { kind: 'education-action', courseId: 'course' },
    }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      hasHome: false,
      educationActions: 0,
      educationProgress: [createEducationProgress(EDUCATION_COURSES.course, 1_000)],
    })

    expect(pkg).toMatchObject({
      day: 2,
      title: 'Study Online Course',
      objective: 'Study Online Course',
      requirement: { kind: 'education', educationActions: 1 },
    })
  })

  test('turns gather tasks into one concrete resource trip requirement', () => {
    const pkg = courierPackageForLifePlan(4, {
      id: 'gather-wood',
      title: 'Gather wood',
      detail: 'The starter house still needs wood.',
      value: 'capital',
      minutes: 20,
      route: { kind: 'gather', resourceKind: 'wood' },
    }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources({ wood: 10 }),
      constructionProjects: [],
      hasHome: false,
    })

    expect(pkg).toMatchObject({
      targetResource: 'wood',
      requirement: { kind: 'resource', resource: 'wood', amount: 35 },
    })
  })
})
