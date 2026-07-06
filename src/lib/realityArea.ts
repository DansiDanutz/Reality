import type { Citizen } from '../game/types'
import type { FounderAreaProfile } from '../game/founderAreaSession'
import type {
  WorldArea,
  WorldBusiness,
  WorldBusinessKind,
  WorldCitizen,
  WorldClientIntentPayload,
  WorldDebt,
  WorldTransaction,
} from '../game/worldSim'

export type RealityAreaClaimSource = 'manual' | 'ip' | 'geolocation' | 'telegram'

export interface RealityAreaNeeds {
  hunger: number
  hydration: number
  energy: number
  hygiene: number
  fun: number
}

export interface RealityAreaDebt {
  id: string
  kind: 'medical'
  creditorId: string
  amount: number
  issuedAt: string
  memo: string
}

export interface RealityAreaCitizen {
  id: string
  name: string
  kind: 'real' | 'sim'
  money: number
  debt: number
  debts?: RealityAreaDebt[]
  needs: RealityAreaNeeds
  health: number
  state: { kind: 'active' } | { kind: 'hospitalized'; until: string }
  homeBusinessId?: string
  jobBusinessId?: string
  insuranceBusinessId?: string
  insurancePaidUntil?: string
}

export interface RealityAreaBusiness {
  id: string
  name: string
  kind: WorldBusinessKind
  ownerId: string
  cash: number
  price: number
  wagePerHour: number
  quality: number
  staffCitizenIds: string[]
  createdAt: string
  createdBy: string
}

export interface RealityAreaTransaction {
  id: string
  at: string
  kind: WorldTransaction['kind']
  fromId: string
  toId: string
  amount: number
  memo: string
}

export type RealityAreaCovenantStatus = 'active' | 'watch' | 'manual_review'
export type RealityAreaCovenantNextAction = 'none' | 'warn_founder' | 'manual_review'
export type RealityAreaCovenantSignalSeverity = 'info' | 'warning' | 'critical'
export type RealityAreaCovenantSignalKind =
  | 'founder_unavailable'
  | 'no_business_built'
  | 'understaffed_businesses'
  | 'essential_shortage'
  | 'founder_debt'

export interface RealityAreaCovenantSignal {
  kind: RealityAreaCovenantSignalKind
  severity: RealityAreaCovenantSignalSeverity
  message: string
  businessIds?: string[]
  businessKinds?: WorldBusinessKind[]
  amount?: number
}

export interface RealityAreaCovenantReview {
  founderCitizenId: string
  status: RealityAreaCovenantStatus
  nextAction: RealityAreaCovenantNextAction
  reviewCadence: 'weekly_monthly_manual'
  manualReviewRequired: boolean
  replacementEnabled: false
  waitlistHandoffEnabled: false
  activityReview: {
    checkedAt: string
    active: boolean
    useful: boolean
    building: boolean
    staffed: boolean
    indebted: boolean
    hospitalized: boolean
    atRisk: boolean
    score: number
  }
  signals: RealityAreaCovenantSignal[]
}

export interface RealityAreaState {
  version: 1
  areaId: string
  founderCitizenId: string
  founderNumber: number
  balance: number
  claim: {
    founderCitizenId: string
    founderNumber: number
    label: string
    centerLat: number
    centerLng: number
    radiusKm: number
    claimedAt: string
    source: RealityAreaClaimSource
  }
  businesses: RealityAreaBusiness[]
  citizens: RealityAreaCitizen[]
  transactions: RealityAreaTransaction[]
  founderCovenant: RealityAreaCovenantReview
  updatedAt: string
}

export type RealityAreaClaimResult =
  | { ok: true; state: RealityAreaState; restoredExisting: boolean }
  | { ok: false; reason: 'missing_identity' | 'not_founder' | 'request_failed' | 'server_rejected'; error: string; code?: string }

export type RealityAreaServerIntentType =
  | 'buildBusiness'
  | 'buyWater'
  | 'buyFood'
  | 'buyHousing'
  | 'visitClinic'
  | 'hireWorker'
  | 'repayDebt'
  | 'buyInsurance'
export type RealityAreaServerPayload = Extract<WorldClientIntentPayload, { type: RealityAreaServerIntentType }>

export interface RealityAreaAdvanceHourPayload {
  type: 'advanceHour'
}

export type RealityAreaApplyResult =
  | { ok: true; state: RealityAreaState }
  | { ok: false; reason: 'missing_identity' | 'not_founder' | 'request_failed' | 'server_rejected'; error: string; code?: string }

type RealityAreaAuthorityPayload = RealityAreaServerPayload | RealityAreaAdvanceHourPayload

export function founderAreaClaimSource(citizen: Pick<Citizen, 'telegramAccountId' | 'spawnLat' | 'spawnLng'>): RealityAreaClaimSource {
  if (citizen.telegramAccountId) return 'telegram'
  return citizen.spawnLat !== undefined && citizen.spawnLng !== undefined ? 'geolocation' : 'manual'
}

export async function claimRealityFounderArea(
  citizen: Pick<Citizen, 'citizenId' | 'token' | 'founderNumber'>,
  profile: FounderAreaProfile,
  fetchImpl: typeof fetch = fetch,
): Promise<RealityAreaClaimResult> {
  const ready = readyFounderCredentials(citizen)
  if (!ready.ok) return ready

  try {
    const response = await fetchImpl('/api/reality-area', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        citizenId: citizen.citizenId,
        token: citizen.token,
        intent: {
          type: 'claimArea',
          label: profile.areaLabel,
          centerLat: profile.centerLat,
          centerLng: profile.centerLng,
          radiusKm: profile.radiusKm,
          source: profile.claimSource,
        },
      }),
    })
    const data = await response.json() as Record<string, unknown>
    const state = isRealityAreaState(data.state) ? data.state : null
    if (response.ok && data.ok === true && state) {
      return { ok: true, state, restoredExisting: false }
    }
    if (response.status === 409 && data.code === 'area_already_claimed' && state) {
      return { ok: true, state, restoredExisting: true }
    }
    return {
      ok: false,
      reason: 'server_rejected',
      error: typeof data.error === 'string' ? data.error : 'Area claim was rejected.',
      code: typeof data.code === 'string' ? data.code : undefined,
    }
  } catch {
    return { ok: false, reason: 'request_failed', error: 'Reality area server is unreachable.' }
  }
}

export async function applyRealityFounderAreaIntent(
  citizen: Pick<Citizen, 'citizenId' | 'token' | 'founderNumber'>,
  payload: RealityAreaServerPayload,
  fetchImpl: typeof fetch = fetch,
): Promise<RealityAreaApplyResult> {
  return applyRealityAreaPayload(citizen, payload, fetchImpl)
}

export async function advanceRealityFounderArea(
  citizen: Pick<Citizen, 'citizenId' | 'token' | 'founderNumber'>,
  fetchImpl: typeof fetch = fetch,
): Promise<RealityAreaApplyResult> {
  return applyRealityAreaPayload(citizen, { type: 'advanceHour' }, fetchImpl)
}

async function applyRealityAreaPayload(
  citizen: Pick<Citizen, 'citizenId' | 'token' | 'founderNumber'>,
  payload: RealityAreaAuthorityPayload,
  fetchImpl: typeof fetch,
): Promise<RealityAreaApplyResult> {
  const ready = readyFounderCredentials(citizen)
  if (!ready.ok) return ready

  try {
    const response = await fetchImpl('/api/reality-area', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        citizenId: citizen.citizenId,
        token: citizen.token,
        intent: payload,
      }),
    })
    const data = await response.json() as Record<string, unknown>
    const state = isRealityAreaState(data.state) ? data.state : null
    if (response.ok && data.ok === true && state) return { ok: true, state }
    return {
      ok: false,
      reason: 'server_rejected',
      error: typeof data.error === 'string' ? data.error : 'Reality area intent was rejected.',
      code: typeof data.code === 'string' ? data.code : undefined,
    }
  } catch {
    return { ok: false, reason: 'request_failed', error: 'Reality area server is unreachable.' }
  }
}

export function isRealityAreaServerPayload(payload: WorldClientIntentPayload): payload is RealityAreaServerPayload {
  return payload.type === 'buildBusiness' ||
    payload.type === 'buyWater' ||
    payload.type === 'buyFood' ||
    payload.type === 'buyHousing' ||
    payload.type === 'visitClinic' ||
    payload.type === 'hireWorker' ||
    payload.type === 'repayDebt' ||
    payload.type === 'buyInsurance'
}

export function founderAreaProfileWithServerClaim(
  profile: FounderAreaProfile,
  state: RealityAreaState,
): FounderAreaProfile {
  return {
    ...profile,
    founderId: state.founderCitizenId,
    areaId: state.areaId,
    areaLabel: state.claim.label,
    centerLat: state.claim.centerLat,
    centerLng: state.claim.centerLng,
    radiusKm: state.claim.radiusKm,
    claimSource: state.claim.source,
  }
}

export function realityAreaStateToWorldArea(state: RealityAreaState): WorldArea {
  return {
    id: state.areaId,
    name: state.claim.label,
    now: parseInstant(state.updatedAt),
    claim: {
      founderCitizenId: state.founderCitizenId,
      label: state.claim.label,
      centerLat: state.claim.centerLat,
      centerLng: state.claim.centerLng,
      radiusKm: state.claim.radiusKm,
      claimedAt: parseInstant(state.claim.claimedAt),
      source: state.claim.source,
    },
    citizens: state.citizens.map(realityCitizenToWorldCitizen),
    businesses: state.businesses.map(realityBusinessToWorldBusiness),
    transactions: state.transactions.map(realityTransactionToWorldTransaction),
  }
}

function isRealityAreaState(value: unknown): value is RealityAreaState {
  if (!isRecord(value) || value.version !== 1) return false
  if (
    typeof value.areaId !== 'string' ||
    typeof value.founderCitizenId !== 'string' ||
    typeof value.founderNumber !== 'number' ||
    typeof value.balance !== 'number' ||
    !isRecord(value.claim) ||
    !Array.isArray(value.businesses) ||
    !Array.isArray(value.citizens) ||
    !isRecord(value.founderCovenant) ||
    !Array.isArray(value.transactions)
  ) {
    return false
  }
  return typeof value.claim.label === 'string' &&
    typeof value.claim.centerLat === 'number' &&
    typeof value.claim.centerLng === 'number' &&
    typeof value.claim.radiusKm === 'number' &&
    typeof value.claim.claimedAt === 'string' &&
    isClaimSource(value.claim.source)
}

function realityCitizenToWorldCitizen(citizen: RealityAreaCitizen): WorldCitizen {
  return {
    id: citizen.id,
    name: citizen.name,
    kind: citizen.kind,
    money: citizen.money,
    debt: citizen.debt,
    debts: citizen.debts?.map(realityDebtToWorldDebt),
    needs: { ...citizen.needs },
    health: citizen.health,
    state: citizen.state.kind === 'hospitalized'
      ? { kind: 'hospitalized', until: parseInstant(citizen.state.until) }
      : { kind: 'active' },
    homeBusinessId: citizen.homeBusinessId,
    jobBusinessId: citizen.jobBusinessId,
    insuranceBusinessId: citizen.insuranceBusinessId,
    insurancePaidUntil: parseOptionalInstant(citizen.insurancePaidUntil),
  }
}

function realityDebtToWorldDebt(debt: RealityAreaDebt): WorldDebt {
  return {
    ...debt,
    issuedAt: parseInstant(debt.issuedAt),
  }
}

function realityBusinessToWorldBusiness(business: RealityAreaBusiness): WorldBusiness {
  return {
    id: business.id,
    name: business.name,
    kind: business.kind,
    ownerId: business.ownerId,
    cash: business.cash,
    staffCitizenIds: [...business.staffCitizenIds],
    price: business.price,
    wagePerHour: business.wagePerHour,
    quality: business.quality,
    createdBy: business.createdBy,
  }
}

function realityTransactionToWorldTransaction(transaction: RealityAreaTransaction): WorldTransaction {
  return {
    ...transaction,
    at: parseInstant(transaction.at),
  }
}

function parseInstant(value: string): number {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function parseOptionalInstant(value: string | undefined): number | undefined {
  if (!value) return undefined
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function isClaimSource(value: unknown): value is RealityAreaClaimSource {
  return value === 'manual' || value === 'ip' || value === 'geolocation' || value === 'telegram'
}

function readyFounderCredentials(
  citizen: Pick<Citizen, 'citizenId' | 'token' | 'founderNumber'>,
): { ok: true } | { ok: false; reason: 'missing_identity' | 'not_founder'; error: string } {
  if (!citizen.citizenId || !citizen.token) {
    return { ok: false, reason: 'missing_identity', error: 'Connect to the world first.' }
  }
  if (citizen.founderNumber <= 0) {
    return { ok: false, reason: 'not_founder', error: 'Founder seat required.' }
  }
  return { ok: true }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
