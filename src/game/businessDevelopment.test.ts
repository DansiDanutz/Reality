import { describe, expect, test } from 'vitest'
import {
  addBusinessDevelopmentLabor,
  advanceBusinessDevelopmentWorkerContracts,
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
    const hired = hireBusinessDevelopmentWorker(paid, 'helper', 100, 1, 1_000)
    expect(hired.hired).toBe(true)
    expect(hired.money).toBe(84)
    expect(hired.project.laborDoneMinutes).toBe(0)
    expect(hired.project.hiredLaborMinutes).toBe(0)
    expect(hired.project.workerContracts).toHaveLength(1)
    expect(hired.project.workerContracts[0]).toMatchObject({
      source: 'workers-hall',
      workerId: 'helper',
      paidMinutes: 60,
      workedMinutes: 0,
    })
  })

  test('worker contracts advance interior labor over elapsed paid minutes', () => {
    const project = createBusinessDevelopmentProject(business(), 1_000)!
    const deposited = depositBusinessDevelopmentResources(project, freshResources(project.required)).project
    const paid = payBusinessDevelopmentBudget(deposited, project.budgetCost).project
    const hired = hireBusinessDevelopmentWorker(paid, 'helper', 100, 1, 1_000)

    const halfHour = advanceBusinessDevelopmentWorkerContracts(hired.project, 1_000 + 30 * 60_000)
    expect(halfHour.laborMinutes).toBe(30)
    expect(halfHour.project.laborDoneMinutes).toBe(30)
    expect(halfHour.project.hiredLaborMinutes).toBe(30)
    expect(halfHour.project.workerContracts[0].workedMinutes).toBe(30)

    const finishedContract = advanceBusinessDevelopmentWorkerContracts(halfHour.project, 1_000 + 60 * 60_000)
    expect(finishedContract.laborMinutes).toBe(30)
    expect(finishedContract.project.laborDoneMinutes).toBe(60)
    expect(finishedContract.project.hiredLaborMinutes).toBe(60)
    expect(finishedContract.project.workerContracts[0].workedMinutes).toBe(60)
  })

  test('worker contracts honor selected hours and upfront interior cost', () => {
    const project = createBusinessDevelopmentProject(business(), 1_000)!
    const deposited = depositBusinessDevelopmentResources(project, freshResources(project.required)).project
    const paid = payBusinessDevelopmentBudget(deposited, project.budgetCost).project

    const estimate = estimateBusinessDevelopmentWorkerHire(paid, 'helper', 2)
    expect(estimate).toMatchObject({
      hours: 2,
      cost: 32,
      laborMinutes: 120,
      blockedBy: null,
    })

    const hired = hireBusinessDevelopmentWorker(paid, 'helper', 100, 2, 1_000)
    expect(hired.hired).toBe(true)
    expect(hired.money).toBe(68)
    expect(hired.project.laborDoneMinutes).toBe(0)
    expect(hired.contract).toMatchObject({
      paidUntil: 7_201_000,
      paidMinutes: 120,
      cost: 32,
    })

    const finishedContract = advanceBusinessDevelopmentWorkerContracts(hired.project, 7_201_000)
    expect(finishedContract.laborMinutes).toBe(120)
    expect(finishedContract.project.laborDoneMinutes).toBe(120)
    expect(finishedContract.project.workerContracts[0].workedMinutes).toBe(120)
  })
})
