import { describe, expect, test } from 'vitest'
import { DEFAULT_MAP_ANCHOR } from './mapAnchor'
import { workersHallActionFor, workersHallFor, workersHallPanelFor } from './workersHall'
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

    expect(hall).toMatchObject({ id: 'workers-hall', name: 'Workers Hall', source: 'fallback' })
    expect(hall.lat).not.toBe(citizen.spawnLat)
    expect(hall.lng).not.toBe(citizen.spawnLng)
    expect(Math.abs(hall.lat - citizen.spawnLat!)).toBeLessThan(0.01)
    expect(Math.abs(hall.lng - citizen.spawnLng!)).toBeLessThan(0.01)
  })

  test('prefers a discovered local labor building over the generated fallback', () => {
    const hall = workersHallFor(citizen, [], [{
      id: 'osm-workers-hall-46.7000-22.2000',
      kind: 'workers-hall',
      label: 'Distant Commercial Office',
      lat: 46.7,
      lng: 22.2,
      source: 'osm',
    }, {
      id: 'osm-workers-hall-45.7000-21.2000',
      kind: 'workers-hall',
      label: 'Timisoara Labor Office',
      lat: 45.7,
      lng: 21.2,
      source: 'osm',
    }])!

    expect(hall).toMatchObject({
      id: 'osm-workers-hall-45.7000-21.2000',
      name: 'Timisoara Labor Office',
      lat: 45.7,
      lng: 21.2,
      source: 'osm',
    })
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
      businessDevelopmentProjects: [{ businessId: 'foodcart-1' }],
    })).toBe('construction')
  })

  test('opens business when the only active worker need is an interior project', () => {
    expect(workersHallPanelFor({
      constructionProjects: [],
      businessDevelopmentProjects: [{ businessId: 'foodcart-1' }],
    })).toBe('business')
  })
})

describe('workersHallActionFor', () => {
  test('routes the hall to the active construction site before interior work', () => {
    expect(workersHallActionFor({
      constructionProjects: [{ id: 'house-build' }],
      businessDevelopmentProjects: [{ businessId: 'foodcart-1' }],
    })).toEqual({
      panel: 'construction',
      target: { kind: 'construction', id: 'house-build' },
    })
  })

  test('routes the hall to the business asset when only interior work needs workers', () => {
    expect(workersHallActionFor({
      constructionProjects: [],
      businessDevelopmentProjects: [{ businessId: 'foodcart-1' }],
    })).toEqual({
      panel: 'business',
      target: { kind: 'asset', id: 'foodcart-1' },
    })
  })

  test('keeps the hall usable when there is no active worker target yet', () => {
    expect(workersHallActionFor({
      constructionProjects: [],
      businessDevelopmentProjects: [],
    })).toEqual({
      panel: 'construction',
      target: null,
    })
  })
})
