import { describe, expect, test, vi } from 'vitest'
import {
  STARTER_HOUSE_RECIPE,
  addConstructionLabor,
  completeConstructionProject,
  constructionProgress,
  createConstructionProject,
  depositResources,
  payPermit,
} from './construction'
import { freshResources } from './resources'

describe('construction', () => {
  test('creates a Starter House project from the recipe', () => {
    const project = createConstructionProject('starter-house', 45.7, 21.2, 123)
    expect(project.required).toEqual(STARTER_HOUSE_RECIPE.required)
    expect(project.laborRequiredMinutes).toBe(480)
    expect(project.permitFee).toBe(500)
    expect(project.status).toBe('planned')
  })

  test('deposits only what the construction site still needs', () => {
    const project = createConstructionProject('starter-house', 45.7, 21.2, 123)
    const out = depositResources(project, freshResources({ wood: 150, stone: 10 }))
    expect(out.project.deposited.wood).toBe(120)
    expect(out.project.deposited.stone).toBe(10)
    expect(out.inventory.wood).toBe(30)
    expect(out.deposited.wood).toBe(120)
    expect(out.project.status).toBe('building')
  })

  test('permit payment is idempotent and requires enough money', () => {
    const project = createConstructionProject('starter-house', 45.7, 21.2, 123)
    expect(payPermit(project, 100).paid).toBe(false)
    const paid = payPermit(project, 600)
    expect(paid.paid).toBe(true)
    expect(paid.money).toBe(100)
    expect(payPermit(paid.project, paid.money).paid).toBe(false)
  })

  test('completes and converts a finished project into a home asset', () => {
    vi.spyOn(Date, 'now').mockReturnValue(999)
    const project = {
      ...createConstructionProject('starter-house', 45.7, 21.2, 123),
      deposited: freshResources(STARTER_HOUSE_RECIPE.required),
      laborDoneMinutes: STARTER_HOUSE_RECIPE.laborRequiredMinutes,
      permitFeePaid: true,
    }
    expect(constructionProgress(project).complete).toBe(true)
    const out = completeConstructionProject(project)
    expect(out.project.status).toBe('complete')
    expect(out.asset).toMatchObject({
      id: 'starter-house-home-999',
      itemId: 'microstudio',
      kind: 'home',
      name: 'Starter House',
      lat: 45.7,
      lng: 21.2,
    })
  })

  test('labor progress caps at the recipe requirement', () => {
    const project = createConstructionProject('starter-house', 45.7, 21.2, 123)
    const out = addConstructionLabor(project, 999)
    expect(out.laborDoneMinutes).toBe(STARTER_HOUSE_RECIPE.laborRequiredMinutes)
  })
})
