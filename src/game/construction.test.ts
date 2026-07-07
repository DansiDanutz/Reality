import { describe, expect, test, vi } from 'vitest'
import {
  STARTER_HOUSE_RECIPE,
  addConstructionLabor,
  businessConstructionRecipe,
  constructionLaborBreakdown,
  completeConstructionProject,
  constructionProgress,
  createConstructionProjectFromRecipe,
  createConstructionProject,
  depositResources,
  estimateConstructionWorkerHire,
  hireConstructionWorker,
  payPermit,
} from './construction'
import { freshResources } from './resources'

describe('construction', () => {
  test('creates a Starter House project from the recipe', () => {
    const project = createConstructionProject('starter-house', 45.7, 21.2, 123)
    expect(project.required).toEqual(STARTER_HOUSE_RECIPE.required)
    expect(project.itemId).toBe('microstudio')
    expect(project.resultKind).toBe('home')
    expect(project.incomePerDay).toBe(0)
    expect(project.laborRequiredMinutes).toBe(480)
    expect(project.hiredLaborMinutes).toBe(0)
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

  test('blocks hired workers until materials and permit are ready', () => {
    const project = createConstructionProject('starter-house', 45.7, 21.2, 123)
    expect(estimateConstructionWorkerHire(project, 'helper')?.blockedBy).toBe('materials')

    const withMaterials = {
      ...project,
      deposited: freshResources(STARTER_HOUSE_RECIPE.required),
    }
    expect(estimateConstructionWorkerHire(withMaterials, 'helper')?.blockedBy).toBe('permit')
  })

  test('hired workers add paid labor to the permanent construction ledger', () => {
    const project = {
      ...createConstructionProject('starter-house', 45.7, 21.2, 123),
      deposited: freshResources(STARTER_HOUSE_RECIPE.required),
      permitFeePaid: true,
    }

    const out = hireConstructionWorker(project, 'builder', 100, 1)
    expect(out.hired).toBe(true)
    expect(out.money).toBe(72)
    expect(out.cost).toBe(28)
    expect(out.laborMinutes).toBe(90)
    expect(out.project.laborDoneMinutes).toBe(90)
    expect(out.project.hiredLaborMinutes).toBe(90)
    expect(constructionLaborBreakdown(out.project)).toMatchObject({
      playerMinutes: 0,
      hiredMinutes: 90,
      remainingMinutes: 390,
    })
  })

  test('worker labor caps at the remaining house work', () => {
    const project = {
      ...createConstructionProject('starter-house', 45.7, 21.2, 123),
      deposited: freshResources(STARTER_HOUSE_RECIPE.required),
      permitFeePaid: true,
      laborDoneMinutes: 420,
    }

    const out = hireConstructionWorker(project, 'crew', 1_000, 8)
    expect(out.hired).toBe(true)
    expect(out.laborMinutes).toBe(60)
    expect(out.project.laborDoneMinutes).toBe(480)
    expect(out.project.hiredLaborMinutes).toBe(60)
    expect(constructionProgress(out.project).complete).toBe(true)
  })

  test('creates a business project from a purchased business recipe', () => {
    const recipe = businessConstructionRecipe({
      id: 'foodcart',
      name: 'Food Cart',
      price: 15_000,
      incomePerDay: 200,
    })
    const project = createConstructionProjectFromRecipe(recipe, 45.7, 21.2, 123)

    expect(project.recipeId).toBe('business:foodcart')
    expect(project.itemId).toBe('foodcart')
    expect(project.resultKind).toBe('business')
    expect(project.name).toBe('Food Cart')
    expect(project.incomePerDay).toBe(200)
    expect(project.required).toEqual({ wood: 45, stone: 30, metal: 25, glass: 10 })
    expect(project.laborRequiredMinutes).toBe(480)
    expect(project.permitFee).toBe(500)
  })

  test('completes a finished business project into an earning business asset', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1001)
    const recipe = businessConstructionRecipe({
      id: 'foodcart',
      name: 'Food Cart',
      price: 15_000,
      incomePerDay: 200,
    })
    const project = {
      ...createConstructionProjectFromRecipe(recipe, 45.7, 21.2, 123),
      deposited: freshResources(recipe.required),
      laborDoneMinutes: recipe.laborRequiredMinutes,
      permitFeePaid: true,
    }

    const out = completeConstructionProject(project)
    expect(out.asset).toMatchObject({
      id: 'business-foodcart-business-1001',
      itemId: 'foodcart',
      kind: 'business',
      name: 'Food Cart',
      incomePerDay: 200,
      pendingIncome: 0,
      lat: 45.7,
      lng: 21.2,
    })
  })
})
