import { businessDevelopmentWorkerBlocker, type BusinessDevelopmentProject } from './businessDevelopment'
import { constructionWorkerBlocker, type ConstructionProject } from './construction'
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

type ConstructionWorkerTarget = Pick<ConstructionProject, 'id' | 'required' | 'deposited' | 'permitFeePaid' | 'laborRequiredMinutes' | 'laborDoneMinutes'>
type BusinessWorkerTarget = Pick<BusinessDevelopmentProject, 'businessId' | 'required' | 'deposited' | 'budgetPaid' | 'laborRequiredMinutes' | 'laborDoneMinutes'>

interface WorkersHallConstructionCandidate extends Partial<ConstructionWorkerTarget> {
  id?: string
}

interface WorkersHallBusinessCandidate extends Partial<BusinessWorkerTarget> {
  businessId?: string
}

interface WorkersHallSnapshot {
  constructionProjects: readonly WorkersHallConstructionCandidate[]
  businessDevelopmentProjects: readonly WorkersHallBusinessCandidate[]
}

function hasConstructionWorkerFields(project: WorkersHallConstructionCandidate): project is ConstructionWorkerTarget {
  return Boolean(
    project.id &&
      project.required &&
      project.deposited &&
      typeof project.permitFeePaid === 'boolean' &&
      Number.isFinite(project.laborRequiredMinutes) &&
      Number.isFinite(project.laborDoneMinutes),
  )
}

function hasBusinessWorkerFields(project: WorkersHallBusinessCandidate): project is BusinessWorkerTarget {
  return Boolean(
    project.businessId &&
      project.required &&
      project.deposited &&
      typeof project.budgetPaid === 'boolean' &&
      Number.isFinite(project.laborRequiredMinutes) &&
      Number.isFinite(project.laborDoneMinutes),
  )
}

function hireReadyConstructionProject(projects: readonly WorkersHallConstructionCandidate[]): WorkersHallConstructionCandidate | null {
  return projects.find((project) => (
    hasConstructionWorkerFields(project) &&
    constructionWorkerBlocker(project) === null
  )) ?? null
}

function hireReadyBusinessProject(projects: readonly WorkersHallBusinessCandidate[]): WorkersHallBusinessCandidate | null {
  return projects.find((project) => (
    hasBusinessWorkerFields(project) &&
    businessDevelopmentWorkerBlocker(project) === null
  )) ?? null
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
  constructionProjects: readonly WorkersHallConstructionCandidate[]
  businessDevelopmentProjects: readonly WorkersHallBusinessCandidate[]
}): WorkersHallPanel {
  return workersHallActionFor(snapshot).panel
}

export function workersHallActionFor(snapshot: WorkersHallSnapshot): WorkersHallAction {
  const hireReadyConstruction = hireReadyConstructionProject(snapshot.constructionProjects)
  if (hireReadyConstruction?.id) {
    return {
      panel: 'construction',
      target: { kind: 'construction', id: hireReadyConstruction.id },
    }
  }

  const hireReadyInterior = hireReadyBusinessProject(snapshot.businessDevelopmentProjects)
  if (hireReadyInterior?.businessId) {
    return {
      panel: 'business',
      target: { kind: 'asset', id: hireReadyInterior.businessId },
    }
  }

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
