import {
  DEFAULT_BUSINESS_BLUEPRINTS,
  type WorldBusinessKind,
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
  'citizens',
  'businesses',
  'transactions',
])

const MAX_CLIENT_ID_LENGTH = 96
const MAX_BUSINESS_NAME_LENGTH = 80
const CLIENT_ID_PATTERN = /^[A-Za-z0-9:_-]+$/

export function decodeClientWorldIntentPayload(
  payload: unknown,
  authenticatedCitizenId: string,
): DecodeClientWorldIntentResult {
  const actorCitizenId = readClientId(authenticatedCitizenId)
  if (!actorCitizenId) return { ok: false, error: 'invalid_actor_identity' }
  if (!isRecord(payload)) return { ok: false, error: 'invalid_payload' }
  if (hasForbiddenClientField(payload)) return { ok: false, error: 'client_controlled_server_field' }

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
  return { ok: true, intent: { type: 'repayDebt', actorCitizenId, debtId, amount: roundMoney(payload.amount) } }
}

function hasForbiddenClientField(payload: Record<string, unknown>): boolean {
  return Object.keys(payload).some((key) => FORBIDDEN_CLIENT_FIELDS.has(key))
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

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}
