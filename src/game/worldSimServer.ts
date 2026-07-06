import {
  advanceWorldArea,
  applyWorldIntent,
  areaNeedsDashboard,
  claimWorldArea,
  FOUNDER_STARTING_BALANCE,
  SIM_CITIZEN_STARTING_BALANCE,
  recordFounderCovenantReview,
  type AdvanceWorldAreaResult,
  type AreaNeedsDashboard,
  type AreaClaimSource,
  type ClaimWorldAreaError,
  type FounderCovenantManualActionKind,
  type FounderCovenantManualEvidenceKind,
  type RecordFounderCovenantReviewError,
  type WorldArea,
  type WorldAreaClaim,
  type WorldCitizen,
  type WorldIntent,
  type WorldIntentError,
  type WorldTransaction,
} from './worldSim'
import {
  decodeClientFounderCovenantReviewPayload,
  decodeClientWorldAreaClaimPayload,
  decodeClientWorldIntentPayload,
  type DecodeClientFounderCovenantReviewError,
  type DecodeClientWorldAreaClaimError,
  type DecodeClientWorldIntentError,
} from './worldSimIntentCodec'
import type { Needs } from './types'

export interface WorldAreaRepository {
  loadArea: (areaId: string) => Promise<WorldArea | null>
  loadAreaRecord?: (areaId: string) => Promise<WorldAreaRecord | null>
  loadAreaByFounder: (founderCitizenId: string) => Promise<WorldAreaRecord | null>
  saveArea: (area: WorldArea, options?: SaveWorldAreaOptions) => Promise<void | SaveWorldAreaResult>
}

export interface WorldAreaRecord {
  area: WorldArea
  revision?: string
}

export interface SaveWorldAreaOptions {
  expectedRevision?: string | null
  expectedFounderAreaEmpty?: string
}

export type SaveWorldAreaResult =
  | { ok: true; revision?: string }
  | { ok: false; error: 'write_conflict' }

export type WorldServerCommand =
  | {
    type: 'createClaimedArea'
    areaId: string
    name: string
    now: number
    authenticatedFounderId: string
    founder: WorldCitizen
    simCitizens?: WorldCitizen[]
    claim: WorldAreaClaim
  }
  | {
    type: 'createClientClaimedArea'
    areaId: string
    now: number
    authenticatedFounderId: string
    authenticatedFounderName: string
    claimSource: AreaClaimSource
    payload: unknown
    simCitizens?: WorldCitizen[]
  }
  | {
    type: 'advance'
    areaId: string
    now: number
  }
  | {
    type: 'readFounderArea'
    authenticatedFounderId: string
    now: number
  }
  | {
    type: 'applyIntent'
    areaId: string
    now: number
    authenticatedCitizenId: string
    intent: WorldIntent
  }
  | {
    type: 'applyFounderIntent'
    authenticatedFounderId: string
    now: number
    intent: WorldIntent
  }
  | {
    type: 'applyClientFounderIntent'
    authenticatedFounderId: string
    now: number
    payload: unknown
  }
  | {
    type: 'recordFounderCovenantReview'
    areaId: string
    now: number
    reviewerId: string
    actionKind: FounderCovenantManualActionKind
    note?: string
    evidenceKinds?: readonly FounderCovenantManualEvidenceKind[]
  }
  | {
    type: 'recordClientFounderCovenantReview'
    areaId: string
    now: number
    authenticatedReviewerId: string
    payload: unknown
  }

export type WorldServerCommandError =
  | 'area_exists'
  | 'area_not_found'
  | 'founder_area_exists'
  | 'invalid_area_identity'
  | 'invalid_command_time'
  | 'invalid_founder_profile'
  | 'invalid_sim_citizen_seed'
  | 'founder_mismatch'
  | 'actor_mismatch'
  | 'time_moved_backward'
  | 'write_conflict'
  | DecodeClientWorldAreaClaimError
  | DecodeClientWorldIntentError
  | DecodeClientFounderCovenantReviewError
  | ClaimWorldAreaError
  | WorldIntentError
  | RecordFounderCovenantReviewError

export type WorldServerCommandResult =
  | {
    ok: true
    area: WorldArea
    dashboard: AreaNeedsDashboard
    transactions: WorldTransaction[]
    summary?: AdvanceWorldAreaResult['summary']
  }
  | {
    ok: false
    error: WorldServerCommandError
    area?: WorldArea
    dashboard?: AreaNeedsDashboard
    transactions?: WorldTransaction[]
    summary?: AdvanceWorldAreaResult['summary']
  }

export async function runWorldServerCommand(
  repo: WorldAreaRepository,
  command: WorldServerCommand,
): Promise<WorldServerCommandResult> {
  switch (command.type) {
    case 'createClaimedArea':
      return createClaimedArea(repo, command)
    case 'createClientClaimedArea':
      return createClientClaimedArea(repo, command)
    case 'advance':
      return advanceStoredArea(repo, command.areaId, command.now)
    case 'readFounderArea':
      return readFounderArea(repo, command.authenticatedFounderId, command.now)
    case 'applyIntent':
      return applyIntentToStoredArea(repo, command.areaId, command.now, command.authenticatedCitizenId, command.intent)
    case 'applyFounderIntent':
      return applyFounderIntentToStoredArea(repo, command.authenticatedFounderId, command.now, command.intent)
    case 'applyClientFounderIntent':
      return applyClientFounderIntentToStoredArea(repo, command.authenticatedFounderId, command.now, command.payload)
    case 'recordFounderCovenantReview':
      return recordFounderCovenantReviewForStoredArea(repo, command)
    case 'recordClientFounderCovenantReview':
      return recordClientFounderCovenantReviewForStoredArea(repo, command)
  }
}

async function createClaimedArea(
  repo: WorldAreaRepository,
  command: Extract<WorldServerCommand, { type: 'createClaimedArea' }>,
): Promise<WorldServerCommandResult> {
  if (
    !command.authenticatedFounderId.trim() ||
    !command.founder.id.trim() ||
    !command.claim.founderCitizenId.trim()
  ) {
    return { ok: false, error: 'founder_not_found' }
  }
  if (!isValidFounderProfile(command.founder)) return { ok: false, error: 'invalid_founder_profile' }
  if (
    command.founder.id !== command.authenticatedFounderId ||
    command.claim.founderCitizenId !== command.authenticatedFounderId
  ) {
    return { ok: false, error: 'founder_mismatch' }
  }
  const areaId = command.areaId.trim()
  const name = command.name.trim()
  if (!areaId || !name) return { ok: false, error: 'invalid_area_identity' }
  if (!isValidCommandTime(command.now)) return { ok: false, error: 'invalid_command_time' }
  const simSeeds = command.simCitizens ?? defaultSimCitizenSeeds(areaId)
  const simCitizens = normalizeSimCitizenSeeds(simSeeds, command.founder.id)
  if (!simCitizens) return { ok: false, error: 'invalid_sim_citizen_seed' }

  if (await loadStoredArea(repo, areaId)) return { ok: false, error: 'area_exists' }
  const founderArea = await repo.loadAreaByFounder(command.authenticatedFounderId)
  if (founderArea) {
    return {
      ok: false,
      error: 'founder_area_exists',
      area: founderArea.area,
      dashboard: areaNeedsDashboard(founderArea.area),
    }
  }

  const seed: WorldArea = {
    id: areaId,
    name,
    now: command.now,
    citizens: [newAreaFounder(command.founder), ...simCitizens],
    businesses: [],
    transactions: [],
  }
  const claimed = claimWorldArea(seed, command.claim)
  if (!claimed.ok) return { ok: false, error: claimed.error, area: claimed.area, dashboard: areaNeedsDashboard(claimed.area) }
  claimed.area.transactions.push(founderCreditTransaction(areaId, command.now, command.founder))
  claimed.area.transactions.push(
    ...simCitizens.map((citizen, index) => simCitizenCreditTransaction(areaId, command.now, index + 2, citizen)),
  )

  const saved = await saveStoredArea(repo, claimed.area, {
    expectedRevision: null,
    expectedFounderAreaEmpty: command.authenticatedFounderId,
  })
  if (!saved.ok) return { ok: false, error: saved.error }
  return {
    ok: true,
    area: claimed.area,
    dashboard: areaNeedsDashboard(claimed.area),
    transactions: transactionDelta(claimed.area, 0),
  }
}

async function createClientClaimedArea(
  repo: WorldAreaRepository,
  command: Extract<WorldServerCommand, { type: 'createClientClaimedArea' }>,
): Promise<WorldServerCommandResult> {
  const decoded = decodeClientWorldAreaClaimPayload(
    command.payload,
    command.authenticatedFounderId,
    command.now,
    command.claimSource,
  )
  if (!decoded.ok) return { ok: false, error: decoded.error }

  return createClaimedArea(repo, {
    type: 'createClaimedArea',
    areaId: command.areaId,
    name: decoded.areaName,
    now: command.now,
    authenticatedFounderId: decoded.claim.founderCitizenId,
    founder: newAuthenticatedFounderProfile(decoded.claim.founderCitizenId, command.authenticatedFounderName),
    simCitizens: command.simCitizens,
    claim: decoded.claim,
  })
}

async function advanceStoredArea(
  repo: WorldAreaRepository,
  areaId: string,
  now: number,
): Promise<WorldServerCommandResult> {
  const normalizedAreaId = areaId.trim()
  if (!normalizedAreaId) return { ok: false, error: 'invalid_area_identity' }
  if (!isValidCommandTime(now)) return { ok: false, error: 'invalid_command_time' }

  const loaded = await loadStoredArea(repo, normalizedAreaId)
  if (!loaded) return { ok: false, error: 'area_not_found' }
  const { area } = loaded
  if (now < area.now) return { ok: false, error: 'time_moved_backward', area, dashboard: areaNeedsDashboard(area) }

  const advanced = advanceWorldArea(area, now)
  const saved = await saveStoredArea(repo, advanced.area, { expectedRevision: loaded.revision })
  if (!saved.ok) return { ok: false, error: saved.error, area, dashboard: areaNeedsDashboard(area) }
  return {
    ok: true,
    area: advanced.area,
    dashboard: areaNeedsDashboard(advanced.area),
    transactions: transactionDelta(advanced.area, area.transactions.length),
    summary: advanced.summary,
  }
}

async function readFounderArea(
  repo: WorldAreaRepository,
  authenticatedFounderId: string,
  now: number,
): Promise<WorldServerCommandResult> {
  const founderId = authenticatedFounderId.trim()
  if (!founderId) return { ok: false, error: 'founder_not_found' }
  if (!isValidCommandTime(now)) return { ok: false, error: 'invalid_command_time' }

  const loaded = await repo.loadAreaByFounder(founderId)
  if (!loaded) return { ok: false, error: 'area_not_found' }
  const { area } = loaded
  if (now < area.now) return { ok: false, error: 'time_moved_backward', area, dashboard: areaNeedsDashboard(area) }
  if (now === area.now) return { ok: true, area, dashboard: areaNeedsDashboard(area), transactions: [] }

  const advanced = advanceWorldArea(area, now)
  const saved = await saveStoredArea(repo, advanced.area, { expectedRevision: loaded.revision })
  if (!saved.ok) return { ok: false, error: saved.error, area, dashboard: areaNeedsDashboard(area) }
  return {
    ok: true,
    area: advanced.area,
    dashboard: areaNeedsDashboard(advanced.area),
    transactions: transactionDelta(advanced.area, area.transactions.length),
    summary: advanced.summary,
  }
}

async function loadStoredArea(repo: WorldAreaRepository, areaId: string): Promise<WorldAreaRecord | null> {
  if (repo.loadAreaRecord) return repo.loadAreaRecord(areaId)
  const area = await repo.loadArea(areaId)
  return area ? { area } : null
}

async function saveStoredArea(
  repo: WorldAreaRepository,
  area: WorldArea,
  options?: SaveWorldAreaOptions,
): Promise<SaveWorldAreaResult> {
  const result = await repo.saveArea(area, options)
  if (result && !result.ok) return result
  return result ?? { ok: true }
}

function transactionDelta(area: WorldArea, fromIndex: number): WorldTransaction[] {
  return area.transactions.slice(fromIndex).map((transaction) => ({ ...transaction }))
}

function isValidCommandTime(now: number): boolean {
  return Number.isFinite(now) && now >= 0
}

function isValidFounderProfile(founder: WorldCitizen): boolean {
  return founder.kind === 'real' &&
    Boolean(founder.name.trim()) &&
    isPercentage(founder.health) &&
    isValidNeeds(founder.needs)
}

function normalizeSimCitizenSeeds(citizens: WorldCitizen[], founderId: string): WorldCitizen[] | null {
  const ids = new Set<string>([founderId])
  const normalized: WorldCitizen[] = []
  for (const citizen of citizens) {
    if (
      citizen.kind !== 'sim' ||
      !citizen.id.trim() ||
      !citizen.name.trim() ||
      ids.has(citizen.id) ||
      !isPercentage(citizen.health) ||
      !isValidNeeds(citizen.needs)
    ) {
      return null
    }
    ids.add(citizen.id)
    normalized.push(newAreaSimCitizen(citizen))
  }
  return normalized
}

function defaultSimCitizenSeeds(areaId: string): WorldCitizen[] {
  return [
    simCitizenSeed(`${areaId}:sim-water`, 'Demo Water Resident', { hydration: 42 }),
    simCitizenSeed(`${areaId}:sim-food`, 'Demo Food Resident', { hunger: 44 }),
    simCitizenSeed(`${areaId}:sim-housing`, 'Demo Housing Resident', { energy: 32 }),
  ]
}

function simCitizenSeed(id: string, name: string, needs: Partial<Needs>): WorldCitizen {
  return {
    id,
    name,
    kind: 'sim',
    money: 0,
    debt: 0,
    needs: {
      hunger: 88,
      hydration: 88,
      energy: 82,
      hygiene: 80,
      fun: 70,
      ...needs,
    },
    health: 96,
    state: { kind: 'active' },
  }
}

function isValidNeeds(needs: Needs): boolean {
  return isPercentage(needs.hunger) &&
    isPercentage(needs.hydration) &&
    isPercentage(needs.energy) &&
    isPercentage(needs.hygiene) &&
    isPercentage(needs.fun)
}

function isPercentage(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 100
}

function newAuthenticatedFounderProfile(founderCitizenId: string, name: string): WorldCitizen {
  return {
    id: founderCitizenId,
    name: name.trim(),
    kind: 'real',
    money: 0,
    debt: 0,
    needs: {
      hunger: 90,
      hydration: 90,
      energy: 90,
      hygiene: 90,
      fun: 90,
    },
    health: 100,
    state: { kind: 'active' },
  }
}

function founderCreditTransaction(areaId: string, at: number, founder: WorldCitizen): WorldTransaction {
  return {
    id: `${areaId}:${at}:1:founder_credit`,
    at,
    kind: 'founder_credit',
    payoutEligibility: 'game_only',
    fromId: 'system:founder-credit',
    toId: founder.id,
    amount: FOUNDER_STARTING_BALANCE,
    memo: `${founder.name} received founder starting game credit.`,
  }
}

function simCitizenCreditTransaction(
  areaId: string,
  at: number,
  sequence: number,
  citizen: WorldCitizen,
): WorldTransaction {
  return {
    id: `${areaId}:${at}:${sequence}:sim_citizen_credit`,
    at,
    kind: 'sim_citizen_credit',
    payoutEligibility: 'game_only',
    fromId: 'system:sim-credit',
    toId: citizen.id,
    amount: SIM_CITIZEN_STARTING_BALANCE,
    memo: `${citizen.name} received simulated resident game credit.`,
  }
}

function newAreaFounder(founder: WorldCitizen): WorldCitizen {
  return {
    id: founder.id,
    name: founder.name,
    kind: founder.kind,
    money: FOUNDER_STARTING_BALANCE,
    debt: 0,
    needs: { ...founder.needs },
    health: founder.health,
    state: { kind: 'active' },
  }
}

function newAreaSimCitizen(citizen: WorldCitizen): WorldCitizen {
  return {
    id: citizen.id,
    name: citizen.name,
    kind: 'sim',
    money: SIM_CITIZEN_STARTING_BALANCE,
    debt: 0,
    needs: { ...citizen.needs },
    health: citizen.health,
    state: { kind: 'active' },
  }
}

async function applyIntentToStoredArea(
  repo: WorldAreaRepository,
  areaId: string,
  now: number,
  authenticatedCitizenId: string,
  intent: WorldIntent,
): Promise<WorldServerCommandResult> {
  if (intent.actorCitizenId !== authenticatedCitizenId) {
    return { ok: false, error: 'actor_mismatch' }
  }

  const normalizedAreaId = areaId.trim()
  if (!normalizedAreaId) return { ok: false, error: 'invalid_area_identity' }
  if (!isValidCommandTime(now)) return { ok: false, error: 'invalid_command_time' }

  const loaded = await loadStoredArea(repo, normalizedAreaId)
  if (!loaded) return { ok: false, error: 'area_not_found' }
  return applyIntentToAreaRecord(repo, loaded, now, intent)
}

async function applyFounderIntentToStoredArea(
  repo: WorldAreaRepository,
  authenticatedFounderId: string,
  now: number,
  intent: WorldIntent,
): Promise<WorldServerCommandResult> {
  const founderId = authenticatedFounderId.trim()
  if (!founderId) return { ok: false, error: 'founder_not_found' }
  if (intent.actorCitizenId !== founderId) return { ok: false, error: 'actor_mismatch' }
  if (!isValidCommandTime(now)) return { ok: false, error: 'invalid_command_time' }

  const loaded = await repo.loadAreaByFounder(founderId)
  if (!loaded) return { ok: false, error: 'area_not_found' }
  return applyIntentToAreaRecord(repo, loaded, now, intent)
}

async function applyClientFounderIntentToStoredArea(
  repo: WorldAreaRepository,
  authenticatedFounderId: string,
  now: number,
  payload: unknown,
): Promise<WorldServerCommandResult> {
  const decoded = decodeClientWorldIntentPayload(payload, authenticatedFounderId)
  if (!decoded.ok) return { ok: false, error: decoded.error }
  return applyFounderIntentToStoredArea(repo, authenticatedFounderId, now, decoded.intent)
}

async function applyIntentToAreaRecord(
  repo: WorldAreaRepository,
  loaded: WorldAreaRecord,
  now: number,
  intent: WorldIntent,
): Promise<WorldServerCommandResult> {
  const { area } = loaded
  if (now < area.now) return { ok: false, error: 'time_moved_backward', area, dashboard: areaNeedsDashboard(area) }

  const advanced = advanceWorldArea(area, now)
  const startingTransactionCount = area.transactions.length

  const applied = applyWorldIntent(advanced.area, intent)
  if (!applied.ok) {
    const savedAdvanced = await saveStoredArea(repo, advanced.area, { expectedRevision: loaded.revision })
    if (!savedAdvanced.ok) return { ok: false, error: savedAdvanced.error, area, dashboard: areaNeedsDashboard(area) }
    return {
      ok: false,
      error: applied.error,
      area: advanced.area,
      dashboard: areaNeedsDashboard(advanced.area),
      transactions: transactionDelta(advanced.area, startingTransactionCount),
      summary: advanced.summary,
    }
  }

  const saved = await saveStoredArea(repo, applied.area, { expectedRevision: loaded.revision })
  if (!saved.ok) return { ok: false, error: saved.error, area, dashboard: areaNeedsDashboard(area) }
  return {
    ok: true,
    area: applied.area,
    dashboard: areaNeedsDashboard(applied.area),
    transactions: transactionDelta(applied.area, startingTransactionCount),
    summary: advanced.summary,
  }
}

async function recordFounderCovenantReviewForStoredArea(
  repo: WorldAreaRepository,
  command: Extract<WorldServerCommand, { type: 'recordFounderCovenantReview' }>,
): Promise<WorldServerCommandResult> {
  const normalizedAreaId = command.areaId.trim()
  const reviewerId = command.reviewerId.trim()
  if (!normalizedAreaId) return { ok: false, error: 'invalid_area_identity' }
  if (!isValidCommandTime(command.now)) return { ok: false, error: 'invalid_command_time' }
  if (!reviewerId) return { ok: false, error: 'invalid_reviewer' }
  if (command.actionKind !== 'record_review') return { ok: false, error: 'review_action_disabled' }

  const loaded = await loadStoredArea(repo, normalizedAreaId)
  if (!loaded) return { ok: false, error: 'area_not_found' }
  const { area } = loaded
  if (command.now < area.now) return { ok: false, error: 'time_moved_backward', area, dashboard: areaNeedsDashboard(area) }

  const advanced: AdvanceWorldAreaResult | null = command.now === area.now
    ? null
    : advanceWorldArea(area, command.now)
  const reviewArea = advanced?.area ?? area
  const startingTransactionCount = area.transactions.length
  const recorded = recordFounderCovenantReview(reviewArea, {
    reviewedAt: command.now,
    reviewerId,
    actionKind: command.actionKind,
    note: command.note,
    evidenceKinds: command.evidenceKinds,
  })
  if (!recorded.ok) {
    return {
      ok: false,
      error: recorded.error,
      area: reviewArea,
      dashboard: areaNeedsDashboard(reviewArea),
      transactions: transactionDelta(reviewArea, startingTransactionCount),
      summary: advanced?.summary,
    }
  }

  const saved = await saveStoredArea(repo, recorded.area, { expectedRevision: loaded.revision })
  if (!saved.ok) return { ok: false, error: saved.error, area, dashboard: areaNeedsDashboard(area) }
  return {
    ok: true,
    area: recorded.area,
    dashboard: areaNeedsDashboard(recorded.area),
    transactions: transactionDelta(recorded.area, startingTransactionCount),
    summary: advanced?.summary,
  }
}

async function recordClientFounderCovenantReviewForStoredArea(
  repo: WorldAreaRepository,
  command: Extract<WorldServerCommand, { type: 'recordClientFounderCovenantReview' }>,
): Promise<WorldServerCommandResult> {
  const decoded = decodeClientFounderCovenantReviewPayload(command.payload)
  if (!decoded.ok) return { ok: false, error: decoded.error }
  return recordFounderCovenantReviewForStoredArea(repo, {
    type: 'recordFounderCovenantReview',
    areaId: command.areaId,
    now: command.now,
    reviewerId: command.authenticatedReviewerId,
    actionKind: decoded.review.actionKind,
    note: decoded.review.note,
    evidenceKinds: decoded.review.evidenceKinds,
  })
}
