export type ResourceKind = 'wood' | 'stone' | 'metal' | 'glass'

export type ResourceInventory = Record<ResourceKind, number>

export interface ResourceNode {
  id: string
  kind: ResourceKind
  label: string
  lat: number
  lng: number
  source: 'osm' | 'fallback'
  yieldAmount: number
  gatherMinutes: number
  energyCost: number
}

export const RESOURCE_KINDS: ResourceKind[] = ['wood', 'stone', 'metal', 'glass']

export const EMPTY_RESOURCES: ResourceInventory = {
  wood: 0,
  stone: 0,
  metal: 0,
  glass: 0,
}

export const RESOURCE_META: Record<ResourceKind, {
  label: string
  icon: string
  gatherMinutes: number
  yieldAmount: number
  energyCost: number
}> = {
  wood: { label: 'Wood', icon: 'W', gatherMinutes: 5, yieldAmount: 25, energyCost: 8 },
  stone: { label: 'Stone', icon: 'S', gatherMinutes: 7, yieldAmount: 15, energyCost: 10 },
  metal: { label: 'Metal', icon: 'M', gatherMinutes: 10, yieldAmount: 8, energyCost: 12 },
  glass: { label: 'Glass', icon: 'G', gatherMinutes: 8, yieldAmount: 5, energyCost: 8 },
}

export function freshResources(overrides: Partial<ResourceInventory> = {}): ResourceInventory {
  return { ...EMPTY_RESOURCES, ...overrides }
}

export function addResources(
  inventory: ResourceInventory,
  kind: ResourceKind,
  amount: number,
): ResourceInventory {
  return {
    ...freshResources(inventory),
    [kind]: Math.max(0, Math.floor((inventory[kind] ?? 0) + amount)),
  }
}

export function subtractResources(
  inventory: ResourceInventory,
  cost: ResourceInventory,
): ResourceInventory {
  const current = freshResources(inventory)
  return {
    wood: Math.max(0, current.wood - cost.wood),
    stone: Math.max(0, current.stone - cost.stone),
    metal: Math.max(0, current.metal - cost.metal),
    glass: Math.max(0, current.glass - cost.glass),
  }
}

export function resourceShortfall(have: ResourceInventory, required: ResourceInventory): ResourceInventory {
  const current = freshResources(have)
  return {
    wood: Math.max(0, required.wood - current.wood),
    stone: Math.max(0, required.stone - current.stone),
    metal: Math.max(0, required.metal - current.metal),
    glass: Math.max(0, required.glass - current.glass),
  }
}

export function hasAllResources(have: ResourceInventory, required: ResourceInventory): boolean {
  const missing = resourceShortfall(have, required)
  return RESOURCE_KINDS.every((kind) => missing[kind] <= 0)
}

export function formatResourceList(resources: ResourceInventory): string {
  return RESOURCE_KINDS
    .filter((kind) => resources[kind] > 0)
    .map((kind) => `${resources[kind]} ${RESOURCE_META[kind].label.toLowerCase()}`)
    .join(', ')
}

function resourceNode(
  kind: ResourceKind,
  lat: number,
  lng: number,
  source: ResourceNode['source'],
  label?: string,
  idSalt = '',
): ResourceNode {
  const meta = RESOURCE_META[kind]
  return {
    id: `${source}-${kind}-${lat.toFixed(4)}-${lng.toFixed(4)}${idSalt}`,
    kind,
    label: label ?? meta.label,
    lat,
    lng,
    source,
    yieldAmount: meta.yieldAmount,
    gatherMinutes: meta.gatherMinutes,
    energyCost: meta.energyCost,
  }
}

export function createResourceNode(
  kind: ResourceKind,
  lat: number,
  lng: number,
  label: string,
  source: ResourceNode['source'] = 'osm',
): ResourceNode {
  return resourceNode(kind, lat, lng, source, label)
}

export function fallbackResourceNodes(lat: number, lng: number): ResourceNode[] {
  const offsets: Record<ResourceKind, { km: number; bearingDeg: number; label: string }> = {
    wood: { km: 0.65, bearingDeg: 35, label: 'Local timber lot' },
    stone: { km: 0.9, bearingDeg: 135, label: 'Town stone yard' },
    metal: { km: 1.15, bearingDeg: 230, label: 'Industrial scrap yard' },
    glass: { km: 1.0, bearingDeg: 300, label: 'Hardware supply depot' },
  }
  return RESOURCE_KINDS.map((kind) => {
    const { km, bearingDeg, label } = offsets[kind]
    const point = offsetLatLng(lat, lng, km, bearingDeg)
    return resourceNode(kind, point.lat, point.lng, 'fallback', label)
  })
}

export function ensureResourceCoverage(
  nodes: ResourceNode[],
  anchorLat: number,
  anchorLng: number,
): ResourceNode[] {
  const seen = new Set(nodes.map((node) => node.kind))
  const fallbacks = fallbackResourceNodes(anchorLat, anchorLng).filter((node) => !seen.has(node.kind))
  return [...nodes, ...fallbacks]
}

function offsetLatLng(lat: number, lng: number, km: number, bearingDeg: number): { lat: number; lng: number } {
  const earthKm = 6_371
  const bearing = (bearingDeg * Math.PI) / 180
  const distance = km / earthKm
  const lat1 = (lat * Math.PI) / 180
  const lng1 = (lng * Math.PI) / 180
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(distance) +
      Math.cos(lat1) * Math.sin(distance) * Math.cos(bearing),
  )
  const lng2 = lng1 + Math.atan2(
    Math.sin(bearing) * Math.sin(distance) * Math.cos(lat1),
    Math.cos(distance) - Math.sin(lat1) * Math.sin(lat2),
  )
  return {
    lat: (lat2 * 180) / Math.PI,
    lng: (((lng2 * 180) / Math.PI + 540) % 360) - 180,
  }
}
