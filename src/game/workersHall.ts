import { playableMapAnchorFor } from './mapAnchor'
import type { Citizen, PlacedAsset } from './types'

export interface WorkersHall {
  id: 'workers-hall'
  name: 'Workers Hall'
  lat: number
  lng: number
  description: string
}

export type WorkersHallPanel = 'construction' | 'business'

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

export function workersHallFor(citizen: Citizen | null, assets: PlacedAsset[]): WorkersHall | null {
  const anchor = playableMapAnchorFor(citizen, assets)
  if (!anchor) return null
  const point = offsetLatLng(anchor.lat, anchor.lng, 0.42, 72)
  return {
    id: 'workers-hall',
    name: 'Workers Hall',
    lat: point.lat,
    lng: point.lng,
    description: 'Recruit AI workers for construction sites and business interiors; paid contracts advance over real time.',
  }
}

export function workersHallPanelFor(snapshot: {
  constructionProjects: readonly unknown[]
  businessDevelopmentProjects: readonly unknown[]
}): WorkersHallPanel {
  if (snapshot.constructionProjects.length === 0 && snapshot.businessDevelopmentProjects.length > 0) return 'business'
  return 'construction'
}
