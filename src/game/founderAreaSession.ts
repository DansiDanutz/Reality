import type { Citizen } from './types'
import { type MemoryWorldAreaRepository, createMemoryWorldAreaRepository } from './worldSimRepository'
import { WORLD_SIM_HOUR_MS, type AreaClaimSource, type WorldClientIntentPayload } from './worldSim'
import { runWorldServerCommand, type WorldServerCommandResult } from './worldSimServer'

export interface FounderAreaProfile {
  founderId: string
  founderName: string
  areaId: string
  areaLabel: string
  centerLat: number
  centerLng: number
  radiusKm: number
  claimSource: AreaClaimSource
}

export interface FounderAreaSession {
  profile: FounderAreaProfile
  repo: MemoryWorldAreaRepository
}

const DEFAULT_CENTER = {
  lat: 44.45,
  lng: 26.08,
}

export function founderAreaProfileFromCitizen(citizen: Pick<Citizen, 'citizenId' | 'name' | 'homeCity' | 'spawnLat' | 'spawnLng'>): FounderAreaProfile {
  const founderId = cleanClientId(citizen.citizenId ?? citizen.name, 'founder')
  const areaPlace = citizen.homeCity?.trim() || 'Founder'
  const centerLat = finiteCoordinate(citizen.spawnLat, DEFAULT_CENTER.lat)
  const centerLng = finiteCoordinate(citizen.spawnLng, DEFAULT_CENTER.lng)
  return {
    founderId,
    founderName: citizen.name.trim() || 'Founder',
    areaId: `area:${founderId}`,
    areaLabel: `${areaPlace} Founder Area`,
    centerLat,
    centerLng,
    radiusKm: 1,
    claimSource: citizen.spawnLat !== undefined && citizen.spawnLng !== undefined ? 'geolocation' : 'manual',
  }
}

export function createFounderAreaSession(profile: FounderAreaProfile): FounderAreaSession {
  return {
    profile,
    repo: createMemoryWorldAreaRepository(),
  }
}

export async function claimFounderArea(session: FounderAreaSession, now: number): Promise<WorldServerCommandResult> {
  const { profile } = session
  return runWorldServerCommand(session.repo, {
    type: 'createClientClaimedArea',
    areaId: profile.areaId,
    now,
    authenticatedFounderId: profile.founderId,
    authenticatedFounderName: profile.founderName,
    claimSource: profile.claimSource,
    payload: {
      label: profile.areaLabel,
      centerLat: profile.centerLat,
      centerLng: profile.centerLng,
      radiusKm: profile.radiusKm,
    },
  })
}

export async function applyFounderAreaPayload(
  session: FounderAreaSession,
  now: number,
  payload: WorldClientIntentPayload,
): Promise<WorldServerCommandResult> {
  return runWorldServerCommand(session.repo, {
    type: 'applyClientFounderIntent',
    authenticatedFounderId: session.profile.founderId,
    now,
    payload,
  })
}

export async function advanceFounderArea(
  session: FounderAreaSession,
  now: number,
  hours = 1,
): Promise<WorldServerCommandResult> {
  return runWorldServerCommand(session.repo, {
    type: 'readFounderArea',
    authenticatedFounderId: session.profile.founderId,
    now: now + hours * WORLD_SIM_HOUR_MS,
  })
}

function cleanClientId(value: string, fallback: string): string {
  const cleaned = value
    .trim()
    .replace(/[^A-Za-z0-9:_-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 64)
  return cleaned || fallback
}

function finiteCoordinate(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}
