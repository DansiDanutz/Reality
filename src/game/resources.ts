export const RESOURCE_KINDS = ['wood', 'stone', 'metal', 'glass'] as const

export type ResourceKind = typeof RESOURCE_KINDS[number]
export type ResourceInventory = Record<ResourceKind, number>
export type ResourceNodeSource = 'osm' | 'fallback'

export interface ResourceNode {
  id: string
  kind: ResourceKind
  label: string
  lat: number
  lng: number
  source: ResourceNodeSource
  yieldAmount: number
  gatherMinutes: number
}

export function emptyResourceInventory(): ResourceInventory {
  return { wood: 0, stone: 0, metal: 0, glass: 0 }
}

export function resourceInventory(input: Partial<Record<ResourceKind, number>> = {}): ResourceInventory {
  const inventory = emptyResourceInventory()
  for (const kind of RESOURCE_KINDS) {
    inventory[kind] = normalizeResourceAmount(input[kind])
  }
  return inventory
}

export function addResourceInventories(
  left: Partial<Record<ResourceKind, number>>,
  right: Partial<Record<ResourceKind, number>>,
): ResourceInventory {
  const a = resourceInventory(left)
  const b = resourceInventory(right)
  return resourceInventory({
    wood: a.wood + b.wood,
    stone: a.stone + b.stone,
    metal: a.metal + b.metal,
    glass: a.glass + b.glass,
  })
}

export function subtractResourceInventories(
  inventory: Partial<Record<ResourceKind, number>>,
  cost: Partial<Record<ResourceKind, number>>,
): ResourceInventory {
  const current = resourceInventory(inventory)
  const spend = resourceInventory(cost)
  return resourceInventory({
    wood: current.wood - spend.wood,
    stone: current.stone - spend.stone,
    metal: current.metal - spend.metal,
    glass: current.glass - spend.glass,
  })
}

export function hasEnoughResources(
  inventory: Partial<Record<ResourceKind, number>>,
  required: Partial<Record<ResourceKind, number>>,
): boolean {
  const current = resourceInventory(inventory)
  const cost = resourceInventory(required)
  return RESOURCE_KINDS.every((kind) => current[kind] >= cost[kind])
}

export function missingResources(
  inventory: Partial<Record<ResourceKind, number>>,
  required: Partial<Record<ResourceKind, number>>,
): ResourceInventory {
  const current = resourceInventory(inventory)
  const cost = resourceInventory(required)
  return resourceInventory({
    wood: Math.max(0, cost.wood - current.wood),
    stone: Math.max(0, cost.stone - current.stone),
    metal: Math.max(0, cost.metal - current.metal),
    glass: Math.max(0, cost.glass - current.glass),
  })
}

export function totalResourceUnits(inventory: Partial<Record<ResourceKind, number>>): number {
  const normalized = resourceInventory(inventory)
  return RESOURCE_KINDS.reduce((total, kind) => total + normalized[kind], 0)
}

function normalizeResourceAmount(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 0
  return Math.floor(value)
}
