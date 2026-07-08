import { describe, expect, test } from 'vitest'
import {
  STARTER_HOUSE_RECIPE,
  constructionProjectProgress,
  createConstructionProject,
  depositConstructionResources,
  missingConstructionResources,
  payConstructionPermit,
  workConstructionLabor,
} from './construction'

describe('Starter House construction model', () => {
  test('creates a planned Starter House project with the approved recipe', () => {
    const project = createConstructionProject({
      id: ' house-1 ',
      lat: 44.45,
      lng: 26.08,
    })

    expect(project).toMatchObject({
      id: 'house-1',
      recipeId: 'starter-house',
      name: 'Starter House',
      lat: 44.45,
      lng: 26.08,
      required: {
        wood: 120,
        stone: 60,
        metal: 20,
        glass: 10,
      },
      deposited: {
        wood: 0,
        stone: 0,
        metal: 0,
        glass: 0,
      },
      laborRequiredMinutes: 480,
      laborDoneMinutes: 0,
      permitFeePaid: false,
      permitFee: 500,
      permitReceiverId: 'system:building-permits',
      status: 'planned',
    })
    expect(STARTER_HOUSE_RECIPE.required).toEqual({
      wood: 120,
      stone: 60,
      metal: 20,
      glass: 10,
    })
  })

  test('rejects invalid project identity or coordinates', () => {
    expect(createConstructionProject({ id: ' ', lat: 44, lng: 26 })).toBeNull()
    expect(createConstructionProject({ id: 'house', lat: 91, lng: 26 })).toBeNull()
    expect(createConstructionProject({ id: 'house', lat: 44, lng: -181 })).toBeNull()
  })

  test('deposits only useful available resources and returns the remaining inventory', () => {
    const project = createProject()

    const deposited = depositConstructionResources(project, {
      wood: 200,
      stone: 30,
      metal: 8,
      glass: 0,
    })

    expect(deposited.ok).toBe(true)
    if (!deposited.ok) throw new Error('expected deposit to succeed')
    expect(deposited.consumed).toEqual({
      wood: 120,
      stone: 30,
      metal: 8,
      glass: 0,
    })
    expect(deposited.remainingInventory).toEqual({
      wood: 80,
      stone: 0,
      metal: 0,
      glass: 0,
    })
    expect(deposited.project).toMatchObject({
      deposited: {
        wood: 120,
        stone: 30,
        metal: 8,
        glass: 0,
      },
      status: 'building',
    })
    expect(missingConstructionResources(deposited.project)).toEqual({
      wood: 0,
      stone: 30,
      metal: 12,
      glass: 10,
    })
    expect(deposited.progress).toMatchObject({
      resourcesComplete: false,
      resourceUnitsRequired: 210,
      resourceUnitsDeposited: 158,
      resourcePercent: 75,
    })
  })

  test('rejects empty deposits and deposits after completion', () => {
    const project = createProject()
    const emptyDeposit = depositConstructionResources(project, { wood: 0, stone: 0 })

    expect(emptyDeposit).toMatchObject({
      ok: false,
      error: 'no_resources',
      consumed: {
        wood: 0,
        stone: 0,
        metal: 0,
        glass: 0,
      },
    })

    const complete = completeProject(project)
    const lateDeposit = depositConstructionResources(complete, { wood: 1 })
    expect(lateDeposit).toMatchObject({
      ok: false,
      error: 'project_complete',
      project: { status: 'complete' },
    })
  })

  test('pays a permit with a concrete payer and receiver without minting money', () => {
    const project = createProject()

    const paid = payConstructionPermit(project, {
      payerId: 'founder-1',
      cash: 750,
    })

    expect(paid.ok).toBe(true)
    if (!paid.ok) throw new Error('expected permit to be paid')
    expect(paid.remainingCash).toBe(250)
    expect(paid.project).toMatchObject({
      permitFeePaid: true,
      status: 'building',
    })
    expect(paid.payment).toEqual({
      fromId: 'founder-1',
      toId: 'system:building-permits',
      amount: 500,
      memo: 'Starter House permit fee paid.',
    })

    expect(payConstructionPermit(project, { payerId: '', cash: 750 })).toMatchObject({
      ok: false,
      error: 'invalid_project',
    })
    expect(payConstructionPermit(project, { payerId: 'founder-1', cash: 100 })).toMatchObject({
      ok: false,
      error: 'insufficient_funds',
      remainingCash: 100,
    })
    expect(payConstructionPermit(paid.project, { payerId: 'founder-1', cash: 750 })).toMatchObject({
      ok: false,
      error: 'permit_already_paid',
    })
  })

  test('applies construction labor up to the recipe requirement', () => {
    const project = createProject()

    const worked = workConstructionLabor(project, 125.8)
    expect(worked.ok).toBe(true)
    if (!worked.ok) throw new Error('expected labor to apply')
    expect(worked.laborAppliedMinutes).toBe(125)
    expect(worked.project).toMatchObject({
      laborDoneMinutes: 125,
      status: 'building',
    })
    expect(worked.progress).toMatchObject({
      laborComplete: false,
      laborPercent: 26,
    })

    const finishedLabor = workConstructionLabor(worked.project, 1_000)
    expect(finishedLabor.ok).toBe(true)
    if (!finishedLabor.ok) throw new Error('expected remaining labor to apply')
    expect(finishedLabor.laborAppliedMinutes).toBe(355)
    expect(finishedLabor.project.laborDoneMinutes).toBe(480)
    expect(workConstructionLabor(project, 0)).toMatchObject({ ok: false, error: 'invalid_labor' })
  })

  test('completes only after resources, permit, and labor are all satisfied', () => {
    const project = createProject()
    const deposited = depositConstructionResources(project, {
      wood: 120,
      stone: 60,
      metal: 20,
      glass: 10,
    })
    if (!deposited.ok) throw new Error('expected resources to deposit')

    const paid = payConstructionPermit(deposited.project, { payerId: 'founder-1', cash: 500 })
    if (!paid.ok) throw new Error('expected permit to be paid')
    expect(paid.progress).toMatchObject({
      resourcesComplete: true,
      permitComplete: true,
      laborComplete: false,
      complete: false,
      overallPercent: 67,
    })

    const worked = workConstructionLabor(paid.project, 480)
    if (!worked.ok) throw new Error('expected labor to finish')
    expect(worked.project.status).toBe('complete')
    expect(constructionProjectProgress(worked.project)).toMatchObject({
      resourcesComplete: true,
      permitComplete: true,
      laborComplete: true,
      complete: true,
      resourcePercent: 100,
      laborPercent: 100,
      overallPercent: 100,
      missing: {
        wood: 0,
        stone: 0,
        metal: 0,
        glass: 0,
      },
    })
    expect(workConstructionLabor(worked.project, 1)).toMatchObject({
      ok: false,
      error: 'project_complete',
    })
  })
})

function createProject() {
  const project = createConstructionProject({ id: 'house-1', lat: 44.45, lng: 26.08 })
  if (!project) throw new Error('expected project')
  return project
}

function completeProject(project: ReturnType<typeof createProject>) {
  const deposited = depositConstructionResources(project, {
    wood: 120,
    stone: 60,
    metal: 20,
    glass: 10,
  })
  if (!deposited.ok) throw new Error('expected resources')
  const paid = payConstructionPermit(deposited.project, { payerId: 'founder-1', cash: 500 })
  if (!paid.ok) throw new Error('expected permit')
  const worked = workConstructionLabor(paid.project, 480)
  if (!worked.ok) throw new Error('expected labor')
  return worked.project
}
