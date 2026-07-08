import { describe, expect, test } from 'vitest'
import {
  addResourceInventories,
  emptyResourceInventory,
  hasEnoughResources,
  missingResources,
  resourceInventory,
  subtractResourceInventories,
  totalResourceUnits,
} from './resources'

describe('resource inventory helpers', () => {
  test('normalizes resource inventories to whole non-negative units', () => {
    expect(emptyResourceInventory()).toEqual({ wood: 0, stone: 0, metal: 0, glass: 0 })
    expect(resourceInventory({
      wood: 10.9,
      stone: -2,
      metal: Number.NaN,
      glass: 3,
    })).toEqual({
      wood: 10,
      stone: 0,
      metal: 0,
      glass: 3,
    })
  })

  test('adds and subtracts inventories without going below zero', () => {
    expect(addResourceInventories(
      { wood: 12, stone: 4 },
      { wood: 3, metal: 2, glass: 1 },
    )).toEqual({
      wood: 15,
      stone: 4,
      metal: 2,
      glass: 1,
    })

    expect(subtractResourceInventories(
      { wood: 12, stone: 4, glass: 1 },
      { wood: 5, stone: 9, metal: 2 },
    )).toEqual({
      wood: 7,
      stone: 0,
      metal: 0,
      glass: 1,
    })
  })

  test('reports affordability, missing units, and total units', () => {
    const inventory = resourceInventory({ wood: 100, stone: 60, metal: 12 })
    const required = resourceInventory({ wood: 120, stone: 60, metal: 20, glass: 10 })

    expect(hasEnoughResources(inventory, required)).toBe(false)
    expect(missingResources(inventory, required)).toEqual({
      wood: 20,
      stone: 0,
      metal: 8,
      glass: 10,
    })
    expect(totalResourceUnits(required)).toBe(210)
  })
})
