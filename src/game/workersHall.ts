import { playableMapAnchorFor } from './mapAnchor'
import type { ServicePoi } from './mapDiscovery'
import type { Citizen, PlacedAsset } from './types'

export interface WorkersHall {
  id: string
  name: string
  lat: number
  lng: number
  description: string
  source: 'osm' | 'fallback'
}

export type WorkersHallPanel = 'construction' | 'business'

export type WorkersHallMapTarget =
  | { kind: 'construction'; id: string }
  | { kind: 'asset'; id: string }

export interface WorkersHallAction {
  panel: WorkersHallPanel
  target: WorkersHallMapTarget | null
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

export function workersHallFor(citizen: Citizen | null, assets: PlacedAsset[], servicePois: ServicePoi[] = []): WorkersHall | null {
  const anchor = playableMapAnchorFor(citizen, assets)
  if (!anchor) return null
  const discovered = servicePois
    .filter((poi) => poi.kind === 'workers-hall')
    .sort((a, b) => squaredDistance(a, anchor) - squaredDistance(b, anchor))[0]
  if (discovered) {
    return {
      id: discovered.id,
      name: discovered.label,
      lat: discovered.lat,
      lng: discovered.lng,
      source: discovered.source,
      description: 'Recruit AI workers for construction sites and business interiors from this real local labor building.',
    }
  }
  const point = offsetLatLng(anchor.lat, anchor.lng, 0.42, 72)
  return {
    id: 'workers-hall',
    name: 'Workers Hall',
    lat: point.lat,
    lng: point.lng,
    source: 'fallback',
    description: 'Recruit AI workers for construction sites and business interiors; paid contracts advance over real time.',
  }
}

function squaredDistance(point: { lat: number; lng: number }, anchor: { lat: number; lng: number }): number {
  return (point.lat - anchor.lat) ** 2 + (point.lng - anchor.lng) ** 2
}

export function workersHallPanelFor(snapshot: {
  constructionProjects: readonly { id?: string }[]
  businessDevelopmentProjects: readonly { businessId?: string }[]
}): WorkersHallPanel {
  return workersHallActionFor(snapshot).panel
}

export function workersHallActionFor(snapshot: {
  constructionProjects: readonly { id?: string }[]
  businessDevelopmentProjects: readonly { businessId?: string }[]
}): WorkersHallAction {
  const construction = snapshot.constructionProjects.find((project) => Boolean(project.id))
  if (construction?.id) {
    return {
      panel: 'construction',
      target: { kind: 'construction', id: construction.id },
    }
  }

  const interior = snapshot.businessDevelopmentProjects.find((project) => Boolean(project.businessId))
  if (interior?.businessId) {
    return {
      panel: 'business',
      target: { kind: 'asset', id: interior.businessId },
    }
  }

  if (snapshot.businessDevelopmentProjects.length > 0) {
    return { panel: 'business', target: null }
  }

  return { panel: 'construction', target: null }
}
