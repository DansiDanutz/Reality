import { createHash } from 'node:crypto'
import { list, put } from '@vercel/blob'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const FOUNDER_STARTER_CREDIT = 200_000
const MIN_FOUNDER_AREA_RADIUS_KM = 0.25
const MAX_FOUNDER_AREA_RADIUS_KM = 5
const PLATFORM_BANK_ID = 'reality-founder-bank'
const BUILDER_RECEIVER_ID = 'system:builders'
const AREA_STATE_VERSION = 1
const CLAIM_SOURCES = ['manual', 'ip', 'geolocation', 'telegram'] as const
const BUSINESS_KINDS = ['water', 'food', 'housing', 'clinic', 'insurance'] as const

type AreaClaimSource = typeof CLAIM_SOURCES[number]
type FounderAreaBusinessKind = typeof BUSINESS_KINDS[number]

interface CitizenAuthRecord {
  citizenId: string
  founderNumber: number
}

interface FounderAreaClaim {
  founderCitizenId: string
  founderNumber: number
  label: string
  centerLat: number
  centerLng: number
  radiusKm: number
  claimedAt: string
  source: AreaClaimSource
}

interface FounderAreaTransaction {
  id: string
  at: string
  kind: 'founder_credit' | 'business_build' | 'customer_purchase' | 'worker_wage'
  fromId: string
  toId: string
  amount: number
  memo: string
}

interface FounderAreaBusiness {
  id: string
  name: string
  kind: FounderAreaBusinessKind
  ownerId: string
  cash: number
  price: number
  wagePerHour: number
  quality: number
  staffCitizenIds: string[]
  createdAt: string
  createdBy: string
}

interface FounderAreaState {
  version: typeof AREA_STATE_VERSION
  areaId: string
  founderCitizenId: string
  founderNumber: number
  balance: number
  claim: FounderAreaClaim
  businesses: FounderAreaBusiness[]
  citizens: []
  transactions: FounderAreaTransaction[]
  updatedAt: string
}

type ClaimAreaIntent =
  | {
    ok: true
    label: string
    centerLat: number
    centerLng: number
    radiusKm: number
    source: AreaClaimSource
  }
  | { ok: false; error: ClaimAreaIntentError }

type ClaimAreaIntentError =
  | 'unsupported_intent'
  | 'invalid_area_label'
  | 'invalid_location'
  | 'area_too_small'
  | 'area_too_large'
  | 'invalid_claim_source'

type BuildBusinessIntent =
  | {
    ok: true
    businessKind: FounderAreaBusinessKind
    businessId: string
    name: string
  }
  | { ok: false; error: BuildBusinessIntentError }

type BuildBusinessIntentError =
  | 'unsupported_intent'
  | 'client_controlled_server_field'
  | 'invalid_business_kind'
  | 'invalid_business_id'
  | 'invalid_business_name'

type ApplyBuildBusinessError =
  | BuildBusinessIntentError
  | 'area_not_claimed'
  | 'business_id_taken'
  | 'business_saturated'
  | 'insufficient_funds'

type ServicePurchaseIntent =
  | {
    ok: true
    type: ServicePurchaseIntentType
    serviceKind: Exclude<FounderAreaBusinessKind, 'insurance'>
  }
  | { ok: false; error: ServicePurchaseIntentError }

type ServicePurchaseIntentType = 'buyWater' | 'buyFood' | 'buyHousing' | 'visitClinic'
type ServicePurchaseIntentError = 'unsupported_intent' | 'client_controlled_server_field'

type ApplyServicePurchaseError =
  | ServicePurchaseIntentError
  | 'area_not_claimed'
  | 'service_not_available'
  | 'insufficient_funds'

type HireWorkerIntent =
  | {
    ok: true
    businessId: string
    workerCitizenId: string
  }
  | { ok: false; error: HireWorkerIntentError }

type HireWorkerIntentError =
  | 'unsupported_intent'
  | 'client_controlled_server_field'
  | 'invalid_business_id'
  | 'invalid_worker_id'

type ApplyHireWorkerError =
  | HireWorkerIntentError
  | 'area_not_claimed'
  | 'business_not_found'
  | 'business_fully_staffed'
  | 'worker_already_hired'

type AdvanceHourIntent =
  | { ok: true }
  | { ok: false; error: AdvanceHourIntentError }

type AdvanceHourIntentError = 'unsupported_intent' | 'client_controlled_server_field'

type ApplyAdvanceHourError =
  | AdvanceHourIntentError
  | 'area_not_claimed'

const SERVICE_PURCHASE_INTENTS: Record<ServicePurchaseIntentType, Exclude<FounderAreaBusinessKind, 'insurance'>> = {
  buyWater: 'water',
  buyFood: 'food',
  buyHousing: 'housing',
  visitClinic: 'clinic',
}

const FORBIDDEN_HIRE_FIELDS = new Set([
  'actorCitizenId',
  'authenticatedCitizenId',
  'authenticatedFounderId',
  'areaId',
  'ownerId',
  'now',
  'balance',
  'money',
  'cash',
  'amount',
  'price',
  'wagePerHour',
  'staffCitizenIds',
  'businesses',
  'transactions',
  'citizens',
])

const FORBIDDEN_ADVANCE_FIELDS = new Set([
  'actorCitizenId',
  'authenticatedCitizenId',
  'authenticatedFounderId',
  'areaId',
  'ownerId',
  'now',
  'balance',
  'money',
  'cash',
  'amount',
  'price',
  'wagePerHour',
  'staffCitizenIds',
  'businessId',
  'workerCitizenId',
  'hour',
  'hours',
  'businesses',
  'transactions',
  'citizens',
  'summary',
])

const FORBIDDEN_SERVICE_FIELDS = new Set([
  'actorCitizenId',
  'authenticatedCitizenId',
  'authenticatedFounderId',
  'areaId',
  'businessId',
  'businessKind',
  'serviceKind',
  'ownerId',
  'now',
  'balance',
  'money',
  'cash',
  'amount',
  'price',
  'businesses',
  'transactions',
  'citizens',
])

const FORBIDDEN_BUILD_FIELDS = new Set([
  'actorCitizenId',
  'authenticatedCitizenId',
  'authenticatedFounderId',
  'areaId',
  'ownerId',
  'createdBy',
  'now',
  'balance',
  'money',
  'cash',
  'buildCost',
  'price',
  'wagePerHour',
  'quality',
  'blueprint',
  'businesses',
  'transactions',
  'citizens',
])

const BUSINESS_BLUEPRINTS: Record<FounderAreaBusinessKind, {
  name: string
  buildCost: number
  price: number
  wagePerHour: number
}> = {
  water: { name: 'Water Point', buildCost: 8_000, price: 2, wagePerHour: 14 },
  food: { name: 'Food Shop', buildCost: 12_000, price: 14, wagePerHour: 15 },
  housing: { name: 'Basic Housing', buildCost: 25_000, price: 28, wagePerHour: 16 },
  clinic: { name: 'Clinic', buildCost: 75_000, price: 90, wagePerHour: 24 },
  insurance: { name: 'Insurance Office', buildCost: 60_000, price: 45, wagePerHour: 20 },
}

const STARTER_LICENSE_SLOTS: Record<FounderAreaBusinessKind, number> = {
  water: 1,
  food: 1,
  housing: 1,
  clinic: 0,
  insurance: 0,
}

const TARGET_STAFF_BY_KIND: Record<FounderAreaBusinessKind, number> = {
  water: 1,
  food: 2,
  housing: 1,
  clinic: 3,
  insurance: 1,
}

export function areaStatePath(citizenId: string): string {
  return `reality-areas/${citizenId}.json`
}

export function normalizeClaimAreaIntent(input: unknown): ClaimAreaIntent {
  if (!isRecord(input) || input.type !== 'claimArea') return { ok: false, error: 'unsupported_intent' }

  const label = text(input.label).slice(0, 80)
  if (!label) return { ok: false, error: 'invalid_area_label' }

  const centerLat = Number(input.centerLat)
  const centerLng = Number(input.centerLng)
  if (
    !Number.isFinite(centerLat) ||
    !Number.isFinite(centerLng) ||
    centerLat < -90 ||
    centerLat > 90 ||
    centerLng < -180 ||
    centerLng > 180
  ) {
    return { ok: false, error: 'invalid_location' }
  }

  const radiusKm = Number(input.radiusKm)
  if (!Number.isFinite(radiusKm) || radiusKm < MIN_FOUNDER_AREA_RADIUS_KM) {
    return { ok: false, error: 'area_too_small' }
  }
  if (radiusKm > MAX_FOUNDER_AREA_RADIUS_KM) return { ok: false, error: 'area_too_large' }

  const source = text(input.source)
  if (!isClaimSource(source)) return { ok: false, error: 'invalid_claim_source' }

  return { ok: true, label, centerLat, centerLng, radiusKm, source }
}

export function normalizeBuildBusinessIntent(input: unknown): BuildBusinessIntent {
  if (!isRecord(input) || input.type !== 'buildBusiness') return { ok: false, error: 'unsupported_intent' }
  if (Object.keys(input).some((key) => FORBIDDEN_BUILD_FIELDS.has(key))) {
    return { ok: false, error: 'client_controlled_server_field' }
  }

  const businessKind = text(input.businessKind)
  if (!isBusinessKind(businessKind)) return { ok: false, error: 'invalid_business_kind' }

  const businessId = text(input.businessId)
  if (!/^[A-Za-z0-9:_-]{1,96}$/.test(businessId)) return { ok: false, error: 'invalid_business_id' }

  const name = text(input.name) || BUSINESS_BLUEPRINTS[businessKind].name
  if (!name || name.length > 80 || hasControlCharacter(name)) return { ok: false, error: 'invalid_business_name' }

  return { ok: true, businessKind, businessId, name }
}

export function normalizeServicePurchaseIntent(input: unknown): ServicePurchaseIntent {
  if (!isRecord(input) || !isServicePurchaseIntentType(input.type)) {
    return { ok: false, error: 'unsupported_intent' }
  }
  if (Object.keys(input).some((key) => FORBIDDEN_SERVICE_FIELDS.has(key))) {
    return { ok: false, error: 'client_controlled_server_field' }
  }
  return { ok: true, type: input.type, serviceKind: SERVICE_PURCHASE_INTENTS[input.type] }
}

export function normalizeHireWorkerIntent(input: unknown): HireWorkerIntent {
  if (!isRecord(input) || input.type !== 'hireWorker') return { ok: false, error: 'unsupported_intent' }
  if (Object.keys(input).some((key) => FORBIDDEN_HIRE_FIELDS.has(key))) {
    return { ok: false, error: 'client_controlled_server_field' }
  }

  const businessId = text(input.businessId)
  if (!isClientId(businessId)) return { ok: false, error: 'invalid_business_id' }

  const workerCitizenId = text(input.workerCitizenId)
  if (!isClientId(workerCitizenId)) return { ok: false, error: 'invalid_worker_id' }

  return { ok: true, businessId, workerCitizenId }
}

export function normalizeAdvanceHourIntent(input: unknown): AdvanceHourIntent {
  if (!isRecord(input) || input.type !== 'advanceHour') return { ok: false, error: 'unsupported_intent' }
  if (Object.keys(input).some((key) => FORBIDDEN_ADVANCE_FIELDS.has(key))) {
    return { ok: false, error: 'client_controlled_server_field' }
  }
  return { ok: true }
}

export async function verifyCitizen(citizenId: string, token: string): Promise<CitizenAuthRecord | null> {
  if (!UUID_RE.test(citizenId) || typeof token !== 'string' || token.length > 64) return null
  const tokenHash = createHash('sha256').update(token).digest('hex').slice(0, 24)
  const batch = await list({ prefix: `citizens/${citizenId}__${tokenHash}`, limit: 1 })
  const pathname = batch.blobs[0]?.pathname
  if (!pathname) return null
  const match = pathname.match(/^citizens\/[0-9a-f-]+__[a-f0-9]{24}__(\d+)\.json$/)
  if (!match) return null
  return { citizenId, founderNumber: Number(match[1]) }
}

async function readAreaState(citizenId: string): Promise<FounderAreaState | null> {
  const batch = await list({ prefix: areaStatePath(citizenId), limit: 1 })
  const url = batch.blobs[0]?.downloadUrl
  if (!url) return null
  const response = await fetch(url)
  if (!response.ok) return null
  const value = await response.json() as unknown
  return isFounderAreaState(value, citizenId) ? value : null
}

function buildFounderAreaState(citizen: CitizenAuthRecord, intent: Extract<ClaimAreaIntent, { ok: true }>, now: Date): FounderAreaState {
  const at = now.toISOString()
  const paddedFounder = String(citizen.founderNumber).padStart(4, '0')
  const areaId = `founder-area-${paddedFounder}`
  const transaction: FounderAreaTransaction = {
    id: `${areaId}:${now.getTime()}:founder-credit`,
    at,
    kind: 'founder_credit',
    fromId: PLATFORM_BANK_ID,
    toId: citizen.citizenId,
    amount: FOUNDER_STARTER_CREDIT,
    memo: `Founder #${paddedFounder} starter operating credit.`,
  }

  return {
    version: AREA_STATE_VERSION,
    areaId,
    founderCitizenId: citizen.citizenId,
    founderNumber: citizen.founderNumber,
    balance: FOUNDER_STARTER_CREDIT,
    claim: {
      founderCitizenId: citizen.citizenId,
      founderNumber: citizen.founderNumber,
      label: intent.label,
      centerLat: intent.centerLat,
      centerLng: intent.centerLng,
      radiusKm: intent.radiusKm,
      claimedAt: at,
      source: intent.source,
    },
    businesses: [],
    citizens: [],
    transactions: [transaction],
    updatedAt: at,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }

  const auth = readAuth(req)
  if (!auth) {
    res.status(400).json({ ok: false, error: 'Missing citizen credentials.' })
    return
  }

  try {
    const citizen = await verifyCitizen(auth.citizenId, auth.token)
    if (!citizen) {
      res.status(401).json({ ok: false, error: 'Not a registered citizen.' })
      return
    }

    const existing = await readAreaState(citizen.citizenId)
    if (req.method === 'GET') {
      res.status(200).json({ ok: true, state: existing, founderNumber: citizen.founderNumber })
      return
    }

    if (citizen.founderNumber <= 0) {
      res.status(403).json({ ok: false, error: 'Founder seat required.', code: 'founder_required' })
      return
    }

    const rawIntent = (req.body as { intent?: unknown } | undefined)?.intent
    const intentType = isRecord(rawIntent) ? rawIntent.type : undefined
    if (intentType === 'claimArea') {
      if (existing) {
        res.status(409).json({ ok: false, error: 'Area already claimed.', code: 'area_already_claimed', state: existing })
        return
      }

      const intent = normalizeClaimAreaIntent(rawIntent)
      if (!intent.ok) {
        res.status(intent.error === 'unsupported_intent' ? 400 : 422).json({
          ok: false,
          error: 'Invalid area claim intent.',
          code: intent.error,
        })
        return
      }

      const state = buildFounderAreaState(citizen, intent, new Date())
      await put(areaStatePath(citizen.citizenId), JSON.stringify(state), {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: false,
        contentType: 'application/json',
      })
      res.status(200).json({ ok: true, state })
      return
    }

    if (intentType === 'buildBusiness') {
      const result = applyBuildBusinessIntent(existing, rawIntent, new Date())
      if (!result.ok) {
        res.status(buildBusinessStatus(result.error)).json({
          ok: false,
          error: buildBusinessMessage(result.error),
          code: result.error,
          state: existing,
        })
        return
      }

      await put(areaStatePath(citizen.citizenId), JSON.stringify(result.state), {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/json',
      })
      res.status(200).json({ ok: true, state: result.state })
      return
    }

    if (isServicePurchaseIntentType(intentType)) {
      const result = applyServicePurchaseIntent(existing, rawIntent, new Date())
      if (!result.ok) {
        res.status(servicePurchaseStatus(result.error)).json({
          ok: false,
          error: servicePurchaseMessage(result.error),
          code: result.error,
          state: existing,
        })
        return
      }

      await put(areaStatePath(citizen.citizenId), JSON.stringify(result.state), {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/json',
      })
      res.status(200).json({ ok: true, state: result.state })
      return
    }

    if (intentType === 'hireWorker') {
      const result = applyHireWorkerIntent(existing, rawIntent, new Date())
      if (!result.ok) {
        res.status(hireWorkerStatus(result.error)).json({
          ok: false,
          error: hireWorkerMessage(result.error),
          code: result.error,
          state: existing,
        })
        return
      }

      await put(areaStatePath(citizen.citizenId), JSON.stringify(result.state), {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/json',
      })
      res.status(200).json({ ok: true, state: result.state })
      return
    }

    if (intentType === 'advanceHour') {
      const result = applyAdvanceHourIntent(existing, rawIntent, new Date())
      if (!result.ok) {
        res.status(advanceHourStatus(result.error)).json({
          ok: false,
          error: advanceHourMessage(result.error),
          code: result.error,
          state: existing,
        })
        return
      }

      await put(areaStatePath(citizen.citizenId), JSON.stringify(result.state), {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/json',
      })
      res.status(200).json({ ok: true, state: result.state })
      return
    }

    res.status(400).json({ ok: false, error: 'Unsupported area intent.', code: 'unsupported_intent' })
  } catch {
    res.status(500).json({ ok: false, error: 'Reality area authority is briefly unavailable.' })
  }
}

function applyBuildBusinessIntent(
  state: FounderAreaState | null,
  input: unknown,
  now: Date,
): { ok: true; state: FounderAreaState } | { ok: false; error: ApplyBuildBusinessError } {
  if (!state) return { ok: false, error: 'area_not_claimed' }
  const intent = normalizeBuildBusinessIntent(input)
  if (!intent.ok) return intent
  if (state.businesses.some((business) => business.id === intent.businessId)) {
    return { ok: false, error: 'business_id_taken' }
  }
  if (state.businesses.filter((business) => business.kind === intent.businessKind).length >= STARTER_LICENSE_SLOTS[intent.businessKind]) {
    return { ok: false, error: 'business_saturated' }
  }

  const blueprint = BUSINESS_BLUEPRINTS[intent.businessKind]
  if (state.balance < blueprint.buildCost) return { ok: false, error: 'insufficient_funds' }

  const at = now.toISOString()
  const business: FounderAreaBusiness = {
    id: intent.businessId,
    name: intent.name,
    kind: intent.businessKind,
    ownerId: state.founderCitizenId,
    cash: 0,
    price: blueprint.price,
    wagePerHour: blueprint.wagePerHour,
    quality: 1,
    staffCitizenIds: [],
    createdAt: at,
    createdBy: state.founderCitizenId,
  }
  const transaction: FounderAreaTransaction = {
    id: `${state.areaId}:${now.getTime()}:business-build:${intent.businessId}`,
    at,
    kind: 'business_build',
    fromId: state.founderCitizenId,
    toId: BUILDER_RECEIVER_ID,
    amount: blueprint.buildCost,
    memo: `${intent.name} built as a ${intent.businessKind} business.`,
  }

  return {
    ok: true,
    state: {
      ...state,
      balance: roundMoney(state.balance - blueprint.buildCost),
      businesses: [...state.businesses, business],
      transactions: [...state.transactions, transaction],
      updatedAt: at,
    },
  }
}

function applyHireWorkerIntent(
  state: FounderAreaState | null,
  input: unknown,
  now: Date,
): { ok: true; state: FounderAreaState } | { ok: false; error: ApplyHireWorkerError } {
  if (!state) return { ok: false, error: 'area_not_claimed' }
  const intent = normalizeHireWorkerIntent(input)
  if (!intent.ok) return intent

  const business = state.businesses.find((candidate) => candidate.id === intent.businessId)
  if (!business) return { ok: false, error: 'business_not_found' }
  const staffCitizenIds = business.staffCitizenIds ?? []
  if (staffCitizenIds.includes(intent.workerCitizenId)) return { ok: false, error: 'worker_already_hired' }
  if (state.businesses.some((candidate) => (candidate.staffCitizenIds ?? []).includes(intent.workerCitizenId))) {
    return { ok: false, error: 'worker_already_hired' }
  }
  if (staffCitizenIds.length >= TARGET_STAFF_BY_KIND[business.kind]) {
    return { ok: false, error: 'business_fully_staffed' }
  }

  return {
    ok: true,
    state: {
      ...state,
      businesses: state.businesses.map((candidate) =>
        candidate.id === intent.businessId
          ? { ...candidate, staffCitizenIds: [...staffCitizenIds, intent.workerCitizenId] }
          : candidate
      ),
      updatedAt: now.toISOString(),
    },
  }
}

function applyAdvanceHourIntent(
  state: FounderAreaState | null,
  input: unknown,
  now: Date,
): { ok: true; state: FounderAreaState } | { ok: false; error: ApplyAdvanceHourError } {
  if (!state) return { ok: false, error: 'area_not_claimed' }
  const intent = normalizeAdvanceHourIntent(input)
  if (!intent.ok) return intent

  const at = now.toISOString()
  const transactions: FounderAreaTransaction[] = []
  const businesses = state.businesses.map((business) => {
    let cash = business.cash
    const paidWorkerIds: string[] = []
    for (const workerId of business.staffCitizenIds ?? []) {
      if (cash < business.wagePerHour) break
      cash = roundMoney(cash - business.wagePerHour)
      paidWorkerIds.push(workerId)
      transactions.push({
        id: `${state.areaId}:${now.getTime()}:worker-wage:${business.id}:${workerId}:${paidWorkerIds.length}`,
        at,
        kind: 'worker_wage',
        fromId: business.id,
        toId: workerId,
        amount: business.wagePerHour,
        memo: `${business.name} paid ${workerId} for one hour of work.`,
      })
    }
    return paidWorkerIds.length > 0 ? { ...business, cash } : business
  })

  return {
    ok: true,
    state: {
      ...state,
      businesses,
      transactions: [...state.transactions, ...transactions],
      updatedAt: at,
    },
  }
}

function applyServicePurchaseIntent(
  state: FounderAreaState | null,
  input: unknown,
  now: Date,
): { ok: true; state: FounderAreaState } | { ok: false; error: ApplyServicePurchaseError } {
  if (!state) return { ok: false, error: 'area_not_claimed' }
  const intent = normalizeServicePurchaseIntent(input)
  if (!intent.ok) return intent

  const business = chooseServiceBusiness(state, intent.serviceKind)
  if (!business) return { ok: false, error: 'service_not_available' }
  if (state.balance < business.price) return { ok: false, error: 'insufficient_funds' }

  const at = now.toISOString()
  const transaction: FounderAreaTransaction = {
    id: `${state.areaId}:${now.getTime()}:customer-purchase:${intent.type}:${business.id}`,
    at,
    kind: 'customer_purchase',
    fromId: state.founderCitizenId,
    toId: business.id,
    amount: business.price,
    memo: `Founder bought ${intent.serviceKind} from ${business.name}.`,
  }

  return {
    ok: true,
    state: {
      ...state,
      balance: roundMoney(state.balance - business.price),
      businesses: state.businesses.map((candidate) =>
        candidate.id === business.id
          ? { ...candidate, cash: roundMoney(candidate.cash + business.price) }
          : candidate
      ),
      transactions: [...state.transactions, transaction],
      updatedAt: at,
    },
  }
}

function chooseServiceBusiness(
  state: FounderAreaState,
  kind: Exclude<FounderAreaBusinessKind, 'insurance'>,
): FounderAreaBusiness | null {
  const businesses = state.businesses
    .filter((business) => business.kind === kind)
    .sort((a, b) => a.price - b.price || a.createdAt.localeCompare(b.createdAt))
  return businesses[0] ?? null
}

function servicePurchaseStatus(error: ApplyServicePurchaseError): number {
  if (error === 'area_not_claimed' || error === 'service_not_available') return 409
  if (error === 'insufficient_funds') return 402
  return error === 'unsupported_intent' ? 400 : 422
}

function servicePurchaseMessage(error: ApplyServicePurchaseError): string {
  switch (error) {
    case 'area_not_claimed':
      return 'Area must be claimed before buying services.'
    case 'service_not_available':
      return 'No local business can serve that need yet.'
    case 'insufficient_funds':
      return 'Founder balance is too low for this purchase.'
    default:
      return 'Invalid service purchase intent.'
  }
}

function buildBusinessStatus(error: ApplyBuildBusinessError): number {
  if (error === 'area_not_claimed') return 409
  if (error === 'business_id_taken' || error === 'business_saturated') return 409
  if (error === 'insufficient_funds') return 402
  return error === 'unsupported_intent' ? 400 : 422
}

function buildBusinessMessage(error: ApplyBuildBusinessError): string {
  switch (error) {
    case 'area_not_claimed':
      return 'Area must be claimed before building.'
    case 'business_id_taken':
      return 'Business id is already used in this area.'
    case 'business_saturated':
      return 'This business type has no open starter license.'
    case 'insufficient_funds':
      return 'Founder balance is too low for this build.'
    default:
      return 'Invalid buildBusiness intent.'
  }
}

function hireWorkerStatus(error: ApplyHireWorkerError): number {
  if (
    error === 'area_not_claimed' ||
    error === 'business_not_found' ||
    error === 'business_fully_staffed' ||
    error === 'worker_already_hired'
  ) {
    return 409
  }
  return error === 'unsupported_intent' ? 400 : 422
}

function hireWorkerMessage(error: ApplyHireWorkerError): string {
  switch (error) {
    case 'area_not_claimed':
      return 'Area must be claimed before hiring workers.'
    case 'business_not_found':
      return 'Business must exist before hiring workers.'
    case 'business_fully_staffed':
      return 'Business already has its target staff.'
    case 'worker_already_hired':
      return 'Worker is already assigned to a local business.'
    default:
      return 'Invalid hireWorker intent.'
  }
}

function advanceHourStatus(error: ApplyAdvanceHourError): number {
  if (error === 'area_not_claimed') return 409
  return error === 'unsupported_intent' ? 400 : 422
}

function advanceHourMessage(error: ApplyAdvanceHourError): string {
  switch (error) {
    case 'area_not_claimed':
      return 'Area must be claimed before advancing the simulation.'
    default:
      return 'Invalid advanceHour intent.'
  }
}

function readAuth(req: VercelRequest): { citizenId: string; token: string } | null {
  const source = req.method === 'GET' ? req.query : req.body
  const citizenId = field(source, 'citizenId')
  const token = field(source, 'token')
  return citizenId && token ? { citizenId, token } : null
}

function field(source: unknown, key: string): string | null {
  if (!isRecord(source)) return null
  const value = source[key]
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : null
  return typeof value === 'string' && value.trim() ? value : null
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function isClaimSource(value: string): value is AreaClaimSource {
  return CLAIM_SOURCES.includes(value as AreaClaimSource)
}

function isBusinessKind(value: string): value is FounderAreaBusinessKind {
  return BUSINESS_KINDS.includes(value as FounderAreaBusinessKind)
}

function isServicePurchaseIntentType(value: unknown): value is ServicePurchaseIntentType {
  return typeof value === 'string' && value in SERVICE_PURCHASE_INTENTS
}

function isClientId(value: string): boolean {
  return /^[A-Za-z0-9:_-]{1,96}$/.test(value)
}

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code <= 31 || code === 127) return true
  }
  return false
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isFounderAreaState(value: unknown, citizenId: string): value is FounderAreaState {
  return isRecord(value) &&
    value.version === AREA_STATE_VERSION &&
    value.founderCitizenId === citizenId &&
    typeof value.areaId === 'string' &&
    typeof value.founderNumber === 'number' &&
    typeof value.balance === 'number' &&
    isRecord(value.claim) &&
    Array.isArray(value.businesses) &&
    Array.isArray(value.transactions)
}
