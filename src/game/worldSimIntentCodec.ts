import {
  DEFAULT_BUSINESS_BLUEPRINTS,
  MAX_FOUNDER_AREA_RADIUS_KM,
  MIN_FOUNDER_AREA_RADIUS_KM,
  type AreaClaimSource,
  type FounderCovenantManualActionKind,
  type FounderCovenantManualEvidenceKind,
  type WorldBusinessKind,
  type WorldAreaClaim,
  type WorldIntent,
} from './worldSim'

export type DecodeClientWorldIntentError =
  | 'invalid_payload'
  | 'invalid_actor_identity'
  | 'client_controlled_server_field'
  | 'invalid_intent_type'
  | 'invalid_business_kind'
  | 'invalid_business_id'
  | 'invalid_business_name'
  | 'invalid_worker_id'
  | 'invalid_insurance_business_id'
  | 'invalid_debt_id'
  | 'invalid_amount'

export type DecodeClientWorldIntentResult =
  | { ok: true; intent: WorldIntent }
  | { ok: false; error: DecodeClientWorldIntentError }

export type DecodeClientWorldAreaClaimError =
  | 'invalid_payload'
  | 'invalid_actor_identity'
  | 'client_controlled_server_field'
  | 'invalid_claim_label'
  | 'invalid_claim_source'
  | 'invalid_claim_time'
  | 'invalid_location'
  | 'invalid_area_radius'

export type DecodeClientWorldAreaClaimResult =
  | { ok: true; claim: WorldAreaClaim; areaName: string }
  | { ok: false; error: DecodeClientWorldAreaClaimError }

export type DecodeClientFounderCovenantReviewError =
  | 'invalid_payload'
  | 'client_controlled_server_field'
  | 'invalid_review_action'
  | 'invalid_review_note'
  | 'invalid_review_evidence'

export interface DecodedClientFounderCovenantReviewPayload {
  type: 'recordCovenantReview'
  actionKind: FounderCovenantManualActionKind
  note?: string
  evidenceKinds?: readonly FounderCovenantManualEvidenceKind[]
}

export type DecodeClientFounderCovenantReviewResult =
  | { ok: true; review: DecodedClientFounderCovenantReviewPayload }
  | { ok: false; error: DecodeClientFounderCovenantReviewError }

const BUSINESS_KINDS: WorldBusinessKind[] = ['water', 'food', 'housing', 'clinic', 'insurance']
const CLIENT_INTENT_TYPES = [
  'buildBusiness',
  'buyWater',
  'buyFood',
  'buyHousing',
  'visitClinic',
  'hireWorker',
  'buyInsurance',
  'repayDebt',
] as const
const COVENANT_REVIEW_ACTION_KINDS: FounderCovenantManualActionKind[] = [
  'record_review',
  'send_warning',
  'start_probation',
  'recommend_replacement',
]
const COVENANT_MANUAL_EVIDENCE_KINDS: readonly FounderCovenantManualEvidenceKind[] = [
  'population_growth',
  'external_contribution',
  'ideas_feedback',
]

const FORBIDDEN_CLIENT_FIELDS = new Set([
  'actorCitizenId',
  'authenticatedCitizenId',
  'authenticatedFounderId',
  'areaId',
  'now',
  'founder',
  'simCitizens',
  'claim',
  'blueprint',
  'money',
  'cash',
  'debt',
  'debts',
  'needs',
  'health',
  'state',
  'jobBusinessId',
  'homeBusinessId',
  'insurancePaidUntil',
  'heirCitizenId',
  'citizens',
  'businesses',
  'transactions',
])

const CLAIM_FORBIDDEN_CLIENT_FIELDS = new Set([
  'founderCitizenId',
  'authenticatedCitizenId',
  'authenticatedFounderId',
  'claimedAt',
  'source',
  'now',
  'founder',
  'simCitizens',
  'claim',
  'money',
  'cash',
  'citizens',
  'businesses',
  'transactions',
])

const REVIEW_FORBIDDEN_CLIENT_FIELDS = new Set([
  'actorCitizenId',
  'authenticatedCitizenId',
  'authenticatedFounderId',
  'areaId',
  'now',
  'founder',
  'simCitizens',
  'claim',
  'reviewerId',
  'authorityGate',
  'reviewedAt',
  'evidenceOnly',
  'approvedById',
  'approvedAt',
  'founderCitizenId',
  'decision',
  'status',
  'nextAction',
  'manualReviewRequired',
  'activityReview',
  'reviewQueue',
  'reviewInputs',
  'stages',
  'stage',
  'requiresMainFounderApproval',
  'manualOnly',
  'reviewChecklist',
  'manualActions',
  'approvalRequests',
  'approvalEnabled',
  'executionEnabled',
  'notificationDraftId',
  'blockers',
  'clientPayload',
  'reviewSchedule',
  'checkedAt',
  'score',
  'replacementEnabled',
  'waitlistHandoffEnabled',
  'automationEnabled',
  'signals',
  'summary',
  'money',
  'cash',
  'citizens',
  'businesses',
  'transactions',
  'areaEvents',
  'founderReviewHistory',
])

const MAX_CLIENT_ID_LENGTH = 96
const MAX_BUSINESS_NAME_LENGTH = 80
const MAX_AREA_LABEL_LENGTH = 96
const MAX_REVIEW_NOTE_LENGTH = 280
const CLIENT_ID_PATTERN = /^[A-Za-z0-9:_-]+$/
const CLAIM_SOURCES: AreaClaimSource[] = ['manual', 'ip', 'geolocation', 'telegram']

export function decodeClientWorldAreaClaimPayload(
  payload: unknown,
  authenticatedFounderId: string,
  claimedAt: number,
  source: AreaClaimSource,
): DecodeClientWorldAreaClaimResult {
  const founderCitizenId = readClientId(authenticatedFounderId)
  if (!founderCitizenId) return { ok: false, error: 'invalid_actor_identity' }
  if (!isFiniteNonNegativeNumber(claimedAt)) return { ok: false, error: 'invalid_claim_time' }
  if (!isOneOf(source, CLAIM_SOURCES)) return { ok: false, error: 'invalid_claim_source' }
  if (!isRecord(payload)) return { ok: false, error: 'invalid_payload' }
  if (hasForbiddenClientField(payload, CLAIM_FORBIDDEN_CLIENT_FIELDS)) {
    return { ok: false, error: 'client_controlled_server_field' }
  }

  const label = readAreaLabel(payload.label)
  if (!label) return { ok: false, error: 'invalid_claim_label' }
  if (!isLatitude(payload.centerLat) || !isLongitude(payload.centerLng)) {
    return { ok: false, error: 'invalid_location' }
  }
  if (!isFounderAreaRadius(payload.radiusKm)) return { ok: false, error: 'invalid_area_radius' }

  return {
    ok: true,
    areaName: label,
    claim: {
      founderCitizenId,
      label,
      centerLat: payload.centerLat,
      centerLng: payload.centerLng,
      radiusKm: payload.radiusKm,
      claimedAt,
      source,
    },
  }
}

export function decodeClientWorldIntentPayload(
  payload: unknown,
  authenticatedCitizenId: string,
): DecodeClientWorldIntentResult {
  const actorCitizenId = readClientId(authenticatedCitizenId)
  if (!actorCitizenId) return { ok: false, error: 'invalid_actor_identity' }
  if (!isRecord(payload)) return { ok: false, error: 'invalid_payload' }
  if (hasForbiddenClientField(payload, FORBIDDEN_CLIENT_FIELDS)) {
    return { ok: false, error: 'client_controlled_server_field' }
  }

  const { type } = payload
  if (!isOneOf(type, CLIENT_INTENT_TYPES)) return { ok: false, error: 'invalid_intent_type' }

  switch (type) {
    case 'buildBusiness':
      return decodeBuildBusinessIntent(payload, actorCitizenId)
    case 'buyWater':
      return { ok: true, intent: { type, actorCitizenId } }
    case 'buyFood':
      return { ok: true, intent: { type, actorCitizenId } }
    case 'buyHousing':
      return { ok: true, intent: { type, actorCitizenId } }
    case 'visitClinic':
      return { ok: true, intent: { type, actorCitizenId } }
    case 'hireWorker':
      return decodeHireWorkerIntent(payload, actorCitizenId)
    case 'buyInsurance':
      return decodeBuyInsuranceIntent(payload, actorCitizenId)
    case 'repayDebt':
      return decodeRepayDebtIntent(payload, actorCitizenId)
  }
}

export function decodeClientFounderCovenantReviewPayload(
  payload: unknown,
): DecodeClientFounderCovenantReviewResult {
  if (!isRecord(payload)) return { ok: false, error: 'invalid_payload' }
  if (payload.type !== 'recordCovenantReview') return { ok: false, error: 'invalid_payload' }
  if (hasForbiddenClientField(payload, REVIEW_FORBIDDEN_CLIENT_FIELDS)) {
    return { ok: false, error: 'client_controlled_server_field' }
  }

  const actionKind = readReviewActionKind(payload.actionKind)
  if (!actionKind) return { ok: false, error: 'invalid_review_action' }

  const note = readOptionalReviewNote(payload.note)
  if (note === false) return { ok: false, error: 'invalid_review_note' }

  const evidenceKinds = readManualEvidenceKinds(payload.evidenceKinds)
  if (evidenceKinds === false) return { ok: false, error: 'invalid_review_evidence' }

  return {
    ok: true,
    review: {
      type: 'recordCovenantReview',
      actionKind,
      ...(note ? { note } : {}),
      ...(evidenceKinds.length > 0 ? { evidenceKinds } : {}),
    },
  }
}

function decodeBuildBusinessIntent(
  payload: Record<string, unknown>,
  actorCitizenId: string,
): DecodeClientWorldIntentResult {
  const businessId = readClientId(payload.businessId)
  if (!businessId) return { ok: false, error: 'invalid_business_id' }

  const businessKind = payload.businessKind
  if (!isOneOf(businessKind, BUSINESS_KINDS)) return { ok: false, error: 'invalid_business_kind' }

  const name = readOptionalBusinessName(payload.name)
  if (name === false) return { ok: false, error: 'invalid_business_name' }
  const shopBlueprint = DEFAULT_BUSINESS_BLUEPRINTS[businessKind]

  return {
    ok: true,
    intent: {
      type: 'buildBusiness',
      actorCitizenId,
      businessId,
      blueprint: {
        ...shopBlueprint,
        name: name ?? shopBlueprint.name,
      },
    },
  }
}

function decodeHireWorkerIntent(
  payload: Record<string, unknown>,
  actorCitizenId: string,
): DecodeClientWorldIntentResult {
  const businessId = readClientId(payload.businessId)
  if (!businessId) return { ok: false, error: 'invalid_business_id' }
  const workerCitizenId = readClientId(payload.workerCitizenId)
  if (!workerCitizenId) return { ok: false, error: 'invalid_worker_id' }
  return { ok: true, intent: { type: 'hireWorker', actorCitizenId, businessId, workerCitizenId } }
}

function decodeBuyInsuranceIntent(
  payload: Record<string, unknown>,
  actorCitizenId: string,
): DecodeClientWorldIntentResult {
  const insuranceBusinessId = readClientId(payload.insuranceBusinessId)
  if (!insuranceBusinessId) return { ok: false, error: 'invalid_insurance_business_id' }
  return { ok: true, intent: { type: 'buyInsurance', actorCitizenId, insuranceBusinessId } }
}

function decodeRepayDebtIntent(
  payload: Record<string, unknown>,
  actorCitizenId: string,
): DecodeClientWorldIntentResult {
  const debtId = readClientId(payload.debtId)
  if (!debtId) return { ok: false, error: 'invalid_debt_id' }
  if (!isPositiveMoney(payload.amount)) return { ok: false, error: 'invalid_amount' }
  const amount = roundMoney(payload.amount)
  if (amount <= 0) return { ok: false, error: 'invalid_amount' }
  return { ok: true, intent: { type: 'repayDebt', actorCitizenId, debtId, amount } }
}

function readReviewActionKind(value: unknown): FounderCovenantManualActionKind | null {
  return isOneOf(value, COVENANT_REVIEW_ACTION_KINDS) ? value : null
}

function readOptionalReviewNote(value: unknown): string | null | false {
  if (value === undefined) return null
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (trimmed.length > MAX_REVIEW_NOTE_LENGTH || hasControlCharacter(trimmed)) return false
  return trimmed || null
}

function readManualEvidenceKinds(value: unknown): FounderCovenantManualEvidenceKind[] | false {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > COVENANT_MANUAL_EVIDENCE_KINDS.length) return false
  const evidenceKinds: FounderCovenantManualEvidenceKind[] = []
  for (const item of value) {
    if (!isOneOf(item, COVENANT_MANUAL_EVIDENCE_KINDS)) return false
    if (!evidenceKinds.includes(item)) evidenceKinds.push(item)
  }
  return evidenceKinds
}

function hasForbiddenClientField(payload: Record<string, unknown>, forbiddenFields: Set<string>): boolean {
  return Object.keys(payload).some((key) => forbiddenFields.has(key))
}

function readClientId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > MAX_CLIENT_ID_LENGTH) return null
  if (!CLIENT_ID_PATTERN.test(trimmed)) return null
  return trimmed
}

function readOptionalBusinessName(value: unknown): string | null | false {
  if (value === undefined) return null
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > MAX_BUSINESS_NAME_LENGTH) return false
  if (hasControlCharacter(trimmed)) return false
  return trimmed
}

function readAreaLabel(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > MAX_AREA_LABEL_LENGTH) return null
  if (hasControlCharacter(trimmed)) return null
  return trimmed
}

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code <= 31 || code === 127) return true
  }
  return false
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && allowed.includes(value as T)
}

function isPositiveMoney(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function isFiniteNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function isFounderAreaRadius(value: unknown): value is number {
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= MIN_FOUNDER_AREA_RADIUS_KM &&
    value <= MAX_FOUNDER_AREA_RADIUS_KM
}

function isLatitude(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= -90 && value <= 90
}

function isLongitude(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= -180 && value <= 180
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}
