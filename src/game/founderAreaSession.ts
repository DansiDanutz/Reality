import type { Citizen } from './types'
import { type MemoryWorldAreaRepository, createMemoryWorldAreaRepository } from './worldSimRepository'
import {
  WORLD_SIM_HOUR_MS,
  type AreaClaimSource,
  type FounderCovenantManualActionClientPayload,
  type WorldClientIntentPayload,
} from './worldSim'
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

export interface FounderAreaCommandClient {
  readonly profile: FounderAreaProfile
  claim: (now: number) => Promise<WorldServerCommandResult>
  read: (now: number) => Promise<WorldServerCommandResult>
  apply: (now: number, payload: WorldClientIntentPayload) => Promise<WorldServerCommandResult>
  review: (now: number, payload: FounderCovenantManualActionClientPayload) => Promise<WorldServerCommandResult>
  advance: (now: number, hours?: number) => Promise<WorldServerCommandResult>
}

export interface MemoryFounderAreaCommandClient extends FounderAreaCommandClient {
  readonly session: FounderAreaSession
}

const DEFAULT_CENTER = {
  lat: 44.45,
  lng: 26.08,
}

export function founderAreaProfileFromCitizen(citizen: Pick<Citizen, 'citizenId' | 'name' | 'homeCity' | 'spawnLat' | 'spawnLng' | 'telegramAccountId'>): FounderAreaProfile {
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
    claimSource: citizen.telegramAccountId
      ? 'telegram'
      : citizen.spawnLat !== undefined && citizen.spawnLng !== undefined
        ? 'geolocation'
        : 'manual',
  }
}

export function createFounderAreaSession(
  profile: FounderAreaProfile,
  repo: MemoryWorldAreaRepository = createMemoryWorldAreaRepository(),
): FounderAreaSession {
  return {
    profile,
    repo,
  }
}

export function createMemoryFounderAreaClient(
  profile: FounderAreaProfile,
  repo?: MemoryWorldAreaRepository,
): MemoryFounderAreaCommandClient {
  const session = createFounderAreaSession(profile, repo)
  return {
    profile,
    session,
    claim: (now: number) => claimFounderArea(session, now),
    read: (now: number) => readFounderArea(session, now),
    apply: (now: number, payload: WorldClientIntentPayload) => applyFounderAreaPayload(session, now, payload),
    review: (now: number, payload: FounderCovenantManualActionClientPayload) =>
      recordFounderCovenantReview(session, now, payload),
    advance: (now: number, hours = 1) => advanceFounderArea(session, now, hours),
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

export async function recordFounderCovenantReview(
  session: FounderAreaSession,
  now: number,
  payload: FounderCovenantManualActionClientPayload,
): Promise<WorldServerCommandResult> {
  return runWorldServerCommand(session.repo, {
    type: 'recordClientFounderCovenantReview',
    areaId: session.profile.areaId,
    now,
    authenticatedReviewerId: session.profile.founderId,
    payload,
  })
}

export async function readFounderArea(
  session: FounderAreaSession,
  now: number,
): Promise<WorldServerCommandResult> {
  return runWorldServerCommand(session.repo, {
    type: 'readFounderArea',
    authenticatedFounderId: session.profile.founderId,
    now,
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
