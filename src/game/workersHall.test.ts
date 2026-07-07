import { describe, expect, test } from 'vitest'
import { DEFAULT_MAP_ANCHOR } from './mapAnchor'
import { workersHallFor, workersHallPanelFor } from './workersHall'
import type { Citizen, PlacedAsset } from './types'

const citizen: Citizen = {
  name: 'Ada',
  founderNumber: 1,
  createdAt: 1,
  spawnLat: 45.7489,
  spawnLng: 21.2087,
}

const home: PlacedAsset = {
  id: 'home-1',
  itemId: 'microstudio',
  kind: 'home',
  name: 'Starter House',
  lat: 46,
  lng: 22,
  incomePerDay: 0,
  pendingIncome: 0,
  placedAtMinute: 0,
}

describe('workersHallFor', () => {
  test('does not show a civic worker building before a citizen exists', () => {
    expect(workersHallFor(null, [])).toBeNull()
  })

  test('places the hall near the citizen spawn before they own a home', () => {
    const hall = workersHallFor(citizen, [])!

    expect(hall).toMatchObject({ id: 'workers-hall', name: 'Workers Hall' })
    expect(hall.lat).not.toBe(citizen.spawnLat)
    expect(hall.lng).not.toBe(citizen.spawnLng)
    expect(Math.abs(hall.lat - citizen.spawnLat!)).toBeLessThan(0.01)
    expect(Math.abs(hall.lng - citizen.spawnLng!)).toBeLessThan(0.01)
  })

  test('moves the hall near the owned home anchor once home exists', () => {
    const hall = workersHallFor(citizen, [home])!

    expect(Math.abs(hall.lat - home.lat)).toBeLessThan(0.01)
    expect(Math.abs(hall.lng - home.lng)).toBeLessThan(0.01)
  })

  test('falls back to the default playable map anchor for citizens without coordinates', () => {
    const hall = workersHallFor({ ...citizen, spawnLat: undefined, spawnLng: undefined }, [])!

    expect(Math.abs(hall.lat - DEFAULT_MAP_ANCHOR.lat)).toBeLessThan(0.01)
    expect(Math.abs(hall.lng - DEFAULT_MAP_ANCHOR.lng)).toBeLessThan(0.01)
  })
})

describe('workersHallPanelFor', () => {
  test('opens construction when no active interior project exists', () => {
    expect(workersHallPanelFor({ constructionProjects: [], businessDevelopmentProjects: [] })).toBe('construction')
  })

  test('opens construction when a construction site is active', () => {
    expect(workersHallPanelFor({
      constructionProjects: [{ id: 'house-build' }],
      businessDevelopmentProjects: [{ id: 'foodcart-interior' }],
    })).toBe('construction')
  })

  test('opens business when the only active worker need is an interior project', () => {
    expect(workersHallPanelFor({
      constructionProjects: [],
      businessDevelopmentProjects: [{ id: 'foodcart-interior' }],
    })).toBe('business')
  })
})
