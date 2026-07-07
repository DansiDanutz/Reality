import { describe, expect, test } from 'vitest'
import {
  addBusinessDevelopmentLabor,
  businessDevelopmentProgress,
  businessDevelopmentShortfall,
  completeBusinessDevelopmentProject,
  createBusinessDevelopmentProject,
  depositBusinessDevelopmentResources,
  estimateBusinessDevelopmentWorkerHire,
  hireBusinessDevelopmentWorker,
  payBusinessDevelopmentBudget,
} from './businessDevelopment'
import { freshResources } from './resources'
import type { PlacedAsset } from './types'

const business = (overrides: Partial<PlacedAsset> = {}): PlacedAsset => ({
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
  ...overrides,
})

describe('business development projects', () => {
  test('creates a persistent interior plan from the next upgrade', () => {
    const project = createBusinessDevelopmentProject(business(), 1_000)!

    expect(project).toMatchObject({
      businessId: 'foodcart-1',
      businessName: 'Food Cart',
      levelFrom: 1,
      levelTo: 2,
      incomeBefore: 240,
      incomeAfter: 480,
      incomeDelta: 240,
      budgetCost: 960,
      budgetPaid: false,
      laborDoneMinutes: 0,
    })
    expect(project.required.metal).toBeGreaterThan(0)
    expect(project.laborRequiredMinutes).toBeGreaterThan(60)
  })

  test('requires resources, budget, and labor before the business upgrades', () => {
    const project = createBusinessDevelopmentProject(business(), 1_000)!
    const resources = freshResources(project.required)
    const deposited = depositBusinessDevelopmentResources(project, resources)
    const paid = payBusinessDevelopmentBudget(deposited.project, project.budgetCost)
    const worked = addBusinessDevelopmentLabor(paid.project, project.laborRequiredMinutes)

    expect(businessDevelopmentProgress(project).complete).toBe(false)
    expect(businessDevelopmentShortfall(deposited.project)).toEqual({ wood: 0, stone: 0, metal: 0, glass: 0 })
    expect(paid.money).toBe(0)
    expect(businessDevelopmentProgress(worked).complete).toBe(true)
    expect(completeBusinessDevelopmentProject(worked, business())).toMatchObject({
      id: 'foodcart-1',
      level: 2,
      incomePerDay: 480,
    })
  })

  test('workers are blocked until materials and budget are ready', () => {
    const project = createBusinessDevelopmentProject(business(), 1_000)!
    const blockedMaterials = estimateBusinessDevelopmentWorkerHire(project, 'helper', 1)
    expect(blockedMaterials?.blockedBy).toBe('materials')

    const deposited = depositBusinessDevelopmentResources(project, freshResources(project.required)).project
    const blockedBudget = estimateBusinessDevelopmentWorkerHire(deposited, 'helper', 1)
    expect(blockedBudget?.blockedBy).toBe('budget')

    const paid = payBusinessDevelopmentBudget(deposited, project.budgetCost).project
    const hired = hireBusinessDevelopmentWorker(paid, 'helper', 100, 1)
    expect(hired.hired).toBe(true)
    expect(hired.money).toBe(84)
    expect(hired.project.hiredLaborMinutes).toBe(60)
  })
})
