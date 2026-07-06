import { createHash } from 'node:crypto'
import { list, put } from '@vercel/blob'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const FOUNDER_STARTER_CREDIT = 200_000
const SIM_CITIZEN_STARTER_CREDIT = 100
const MIN_FOUNDER_AREA_RADIUS_KM = 0.25
const MAX_FOUNDER_AREA_RADIUS_KM = 5
const PLATFORM_BANK_ID = 'reality-founder-bank'
const SIM_CREDIT_ACCOUNT_ID = 'system:sim-credit'
const BUILDER_RECEIVER_ID = 'system:builders'
const SYSTEM_HOSPITAL_ACCOUNT_ID = 'system:hospital'
const AREA_STATE_VERSION = 1
const INSURANCE_POLICY_PERIOD_MS = 30 * 24 * 60 * 60 * 1000
const INSURANCE_COVERAGE = 0.6
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
  kind:
    | 'founder_credit'
    | 'sim_citizen_credit'
    | 'business_build'
    | 'customer_purchase'
    | 'worker_wage'
    | 'hospital_bill'
    | 'insurance_premium'
    | 'insurance_payout'
    | 'medical_debt'
    | 'debt_repayment'
  fromId: string
  toId: string
  amount: number
  memo: string
}

interface FounderAreaNeeds {
  hunger: number
  hydration: number
  energy: number
  hygiene: number
  fun: number
}

interface FounderAreaCitizen {
  id: string
  name: string
  kind: 'real' | 'sim'
  money: number
  debt: number
  debts?: FounderAreaDebt[]
  needs: FounderAreaNeeds
  health: number
  state: { kind: 'active' } | { kind: 'hospitalized'; until: string }
  jobBusinessId?: string
  insuranceBusinessId?: string
  insurancePaidUntil?: string
}

interface FounderAreaDebt {
  id: string
  kind: 'medical'
  creditorId: string
  amount: number
  issuedAt: string
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

type FounderAreaCovenantStatus = 'active' | 'watch' | 'manual_review'
type FounderAreaCovenantNextAction = 'none' | 'warn_founder' | 'manual_review'
type FounderAreaCovenantSignalSeverity = 'info' | 'warning' | 'critical'
type FounderAreaCovenantSignalKind =
  | 'founder_unavailable'
  | 'no_business_built'
  | 'understaffed_businesses'
  | 'essential_shortage'
  | 'founder_debt'

interface FounderAreaCovenantSignal {
  kind: FounderAreaCovenantSignalKind
  severity: FounderAreaCovenantSignalSeverity
  message: string
  businessIds?: string[]
  businessKinds?: FounderAreaBusinessKind[]
  amount?: number
}

interface FounderAreaCovenantActivityReview {
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

interface FounderAreaCovenantReview {
  founderCitizenId: string
  status: FounderAreaCovenantStatus
  nextAction: FounderAreaCovenantNextAction
  reviewCadence: 'weekly_monthly_manual'
  manualReviewRequired: boolean
  replacementEnabled: false
  waitlistHandoffEnabled: false
  activityReview: FounderAreaCovenantActivityReview
  signals: FounderAreaCovenantSignal[]
}

interface FounderAreaState {
  version: typeof AREA_STATE_VERSION
  areaId: string
  founderCitizenId: string
  founderNumber: number
  balance: number
  claim: FounderAreaClaim
  businesses: FounderAreaBusiness[]
  citizens: FounderAreaCitizen[]
  transactions: FounderAreaTransaction[]
  founderCovenant: FounderAreaCovenantReview
  updatedAt: string
}

type FounderAreaStateInput = Omit<FounderAreaState, 'founderCovenant'> & {
  founderCovenant?: FounderAreaCovenantReview
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
  | 'actor_unavailable'
  | 'service_not_available'
  | 'insufficient_funds'

type BuyInsuranceIntent =
  | {
    ok: true
    insuranceBusinessId: string
  }
  | { ok: false; error: BuyInsuranceIntentError }

type BuyInsuranceIntentError =
  | 'unsupported_intent'
  | 'client_controlled_server_field'
  | 'invalid_business_id'

type ApplyBuyInsuranceError =
  | BuyInsuranceIntentError
  | 'area_not_claimed'
  | 'actor_unavailable'
  | 'business_not_found'
  | 'not_insurance_business'
  | 'already_insured'
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
  | 'worker_not_found'
  | 'worker_unavailable'
  | 'real_worker_requires_acceptance'

type AdvanceHourIntent =
  | { ok: true }
  | { ok: false; error: AdvanceHourIntentError }

type AdvanceHourIntentError = 'unsupported_intent' | 'client_controlled_server_field'

type ApplyAdvanceHourError =
  | AdvanceHourIntentError
  | 'area_not_claimed'
  | 'clock_not_ready'

type RepayDebtIntent =
  | {
    ok: true
    debtId: string
    amount: number
  }
  | { ok: false; error: RepayDebtIntentError }

type RepayDebtIntentError =
  | 'unsupported_intent'
  | 'client_controlled_server_field'
  | 'invalid_debt_id'
  | 'invalid_debt_payment'

type ApplyRepayDebtError =
  | RepayDebtIntentError
  | 'area_not_claimed'
  | 'actor_unavailable'
  | 'debt_not_found'
  | 'insufficient_funds'

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

const FORBIDDEN_REPAY_DEBT_FIELDS = new Set([
  'actorCitizenId',
  'authenticatedCitizenId',
  'authenticatedFounderId',
  'areaId',
  'ownerId',
  'now',
  'balance',
  'money',
  'cash',
  'price',
  'wagePerHour',
  'creditorId',
  'debt',
  'debts',
  'businesses',
  'transactions',
  'citizens',
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

const FORBIDDEN_INSURANCE_FIELDS = new Set([
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
  'wagePerHour',
  'insurancePaidUntil',
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

const FULL_NEEDS: FounderAreaNeeds = {
  hunger: 90,
  hydration: 90,
  energy: 90,
  hygiene: 90,
  fun: 90,
}

const NEED_DECAY_PER_HOUR: FounderAreaNeeds = {
  hunger: 4,
  hydration: 5,
  energy: 3,
  hygiene: 1,
  fun: 1,
}

const NEED_PURCHASE_THRESHOLD = 65
const HEALTH_PURCHASE_THRESHOLD = 75
const COLLAPSE_HEALTH = 20
const HOSPITAL_BILL = 350
const HOSPITALIZATION_HOURS = 8
const INSURED_HOSPITALIZATION_HOURS = 5
const RECOVERY_HEALTH = 55
const MIN_BUSINESS_QUALITY = 0.35
const UNSTAFFED_HOSPITALIZED_OWNER_QUALITY_LOSS_PER_HOUR = 0.04
const SERVICE_EFFECTS: Record<Exclude<FounderAreaBusinessKind, 'insurance'>, Partial<FounderAreaNeeds> & { health?: number }> = {
  water: { hydration: 35 },
  food: { hunger: 35 },
  housing: { energy: 35 },
  clinic: { health: 30 },
}
const BASE_SERVICE_CAPACITY_PER_HOUR: Record<FounderAreaBusinessKind, number> = {
  water: 24,
  food: 14,
  housing: 8,
  clinic: 6,
  insurance: 8,
}
const STAFF_CAPACITY_MULTIPLIER = 0.75
const SERVER_AREA_TICK_MS = 3_600_000
const MAX_SERVER_AREA_CATCH_UP_HOURS = 24

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

export function normalizeBuyInsuranceIntent(input: unknown): BuyInsuranceIntent {
  if (!isRecord(input) || input.type !== 'buyInsurance') return { ok: false, error: 'unsupported_intent' }
  if (Object.keys(input).some((key) => FORBIDDEN_INSURANCE_FIELDS.has(key))) {
    return { ok: false, error: 'client_controlled_server_field' }
  }

  const insuranceBusinessId = text(input.insuranceBusinessId)
  if (!isClientId(insuranceBusinessId)) return { ok: false, error: 'invalid_business_id' }

  return { ok: true, insuranceBusinessId }
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

export function normalizeRepayDebtIntent(input: unknown): RepayDebtIntent {
  if (!isRecord(input) || input.type !== 'repayDebt') return { ok: false, error: 'unsupported_intent' }
  if (Object.keys(input).some((key) => FORBIDDEN_REPAY_DEBT_FIELDS.has(key))) {
    return { ok: false, error: 'client_controlled_server_field' }
  }

  const debtId = text(input.debtId)
  if (!isClientId(debtId)) return { ok: false, error: 'invalid_debt_id' }

  const amount = roundMoney(Number(input.amount))
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'invalid_debt_payment' }

  return { ok: true, debtId, amount }
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
  return isFounderAreaState(value, citizenId) ? normalizeAreaCitizens(value) : null
}

function buildFounderAreaState(citizen: CitizenAuthRecord, intent: Extract<ClaimAreaIntent, { ok: true }>, now: Date): FounderAreaState {
  const at = now.toISOString()
  const paddedFounder = String(citizen.founderNumber).padStart(4, '0')
  const areaId = `founder-area-${paddedFounder}`
  const founderCitizen = founderCitizenRecord(citizen, FOUNDER_STARTER_CREDIT)
  const simCitizens = defaultSimCitizens(areaId)
  const transaction: FounderAreaTransaction = {
    id: `${areaId}:${now.getTime()}:founder-credit`,
    at,
    kind: 'founder_credit',
    fromId: PLATFORM_BANK_ID,
    toId: citizen.citizenId,
    amount: FOUNDER_STARTER_CREDIT,
    memo: `Founder #${paddedFounder} starter operating credit.`,
  }
  const simTransactions = simCitizens.map((simCitizen, index) =>
    simCitizenCreditTransaction(areaId, at, now.getTime(), index + 1, simCitizen)
  )

  return withFounderCovenantReview({
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
    citizens: [founderCitizen, ...simCitizens],
    transactions: [transaction, ...simTransactions],
    updatedAt: at,
  })
}

function normalizeAreaCitizens(state: FounderAreaState): FounderAreaState {
  const claimedAt = state.claim.claimedAt
  const claimedMs = Date.parse(claimedAt)
  const atMs = Number.isFinite(claimedMs) ? claimedMs : 0
  const founder: CitizenAuthRecord = {
    citizenId: state.founderCitizenId,
    founderNumber: state.founderNumber,
  }
  const expectedCitizens = [
    founderCitizenRecord(founder, state.balance),
    ...defaultSimCitizens(state.areaId),
  ]
  let citizens = state.citizens.map((citizen) =>
    citizen.id === state.founderCitizenId ? { ...citizen, money: state.balance } : citizen
  )
  const transactions = [...state.transactions]

  for (const expected of expectedCitizens) {
    if (citizens.some((citizen) => citizen.id === expected.id)) continue
    citizens = [...citizens, expected]
    if (expected.kind === 'sim' && !transactions.some((transaction) =>
      transaction.kind === 'sim_citizen_credit' && transaction.toId === expected.id
    )) {
      transactions.push(simCitizenCreditTransaction(
        state.areaId,
        claimedAt,
        atMs,
        transactions.filter((transaction) => transaction.kind === 'sim_citizen_credit').length + 1,
        expected,
      ))
    }
  }

  return withFounderCovenantReview({ ...state, citizens, transactions })
}

function withFounderCovenantReview(state: FounderAreaStateInput): FounderAreaState {
  return {
    ...state,
    founderCovenant: founderCovenantReview(state),
  }
}

function founderCovenantReview(state: FounderAreaStateInput): FounderAreaCovenantReview {
  const founder = state.citizens.find((citizen) => citizen.id === state.founderCitizenId)
  const founderBusinesses = state.businesses.filter((business) => business.ownerId === state.founderCitizenId)
  const founderBusinessIds = new Set(founderBusinesses.map((business) => business.id))
  const founderActive = founder?.state.kind === 'active'
  const founderHospitalized = founder?.state.kind === 'hospitalized'
  const building = founderBusinesses.length > 0
  const founderDebt = founder ? totalCitizenDebt(founder) : 0
  const signals: FounderAreaCovenantSignal[] = []
  const demand = areaServiceDemand(state.citizens)
  const capacity = areaServiceCapacity(state.citizens, state.businesses)
  const essentialShortages = (['water', 'food', 'housing'] as const)
    .filter((kind) => demand[kind] > capacity[kind])
  const understaffedBusinesses = founderBusinesses.filter((business) =>
    activeStaffCount(state.citizens, business) < TARGET_STAFF_BY_KIND[business.kind]
  )
  const staffed = building && understaffedBusinesses.length === 0
  const servedCustomers = state.transactions.some((transaction) =>
    transaction.kind === 'customer_purchase' && founderBusinessIds.has(transaction.toId)
  )
  const demandServedByFounder = founderBusinesses.some((business) =>
    demand[business.kind] > 0 && capacity[business.kind] >= demand[business.kind]
  )
  const useful = building && (servedCustomers || demandServedByFounder || essentialShortages.length === 0)

  if (!founder || !founderActive) {
    signals.push({
      kind: 'founder_unavailable',
      severity: 'critical',
      message: 'Founder is unavailable; review the seat manually before any replacement decision.',
    })
  }
  if (!building) {
    signals.push({
      kind: 'no_business_built',
      severity: 'warning',
      message: 'Founder has not built a local business yet.',
    })
  }
  if (understaffedBusinesses.length > 0) {
    signals.push({
      kind: 'understaffed_businesses',
      severity: 'warning',
      message: 'Founder-owned businesses need workers before the area can run reliably.',
      businessIds: understaffedBusinesses.map((business) => business.id),
    })
  }
  if (essentialShortages.length > 0) {
    signals.push({
      kind: 'essential_shortage',
      severity: 'warning',
      message: 'The area has unserved water, food, or housing demand.',
      businessKinds: essentialShortages,
      amount: essentialShortages.reduce((total, kind) => total + Math.max(0, demand[kind] - capacity[kind]), 0),
    })
  }
  if (founderDebt > 0) {
    signals.push({
      kind: 'founder_debt',
      severity: 'info',
      message: 'Founder has unpaid debt that should be reviewed before profit or succession decisions.',
      amount: founderDebt,
    })
  }

  const manualReviewRequired = signals.some((signal) => signal.severity === 'critical')
  const status: FounderAreaCovenantStatus = manualReviewRequired ? 'manual_review' : signals.length > 0 ? 'watch' : 'active'
  const activityReview: FounderAreaCovenantActivityReview = {
    checkedAt: state.updatedAt,
    active: founderActive,
    useful,
    building,
    staffed,
    indebted: founderDebt > 0,
    hospitalized: founderHospitalized,
    atRisk: status !== 'active',
    score: founder
      ? founderActivityScore({ active: founderActive, useful, building, staffed, indebted: founderDebt > 0 })
      : 0,
  }

  return {
    founderCitizenId: state.founderCitizenId,
    status,
    nextAction: manualReviewRequired
      ? 'manual_review'
      : signals.some((signal) => signal.severity === 'warning')
        ? 'warn_founder'
        : 'none',
    reviewCadence: 'weekly_monthly_manual',
    manualReviewRequired,
    replacementEnabled: false,
    waitlistHandoffEnabled: false,
    activityReview,
    signals,
  }
}

function areaServiceDemand(citizens: FounderAreaCitizen[]): Record<FounderAreaBusinessKind, number> {
  const demand = emptyBusinessKindRecord()
  for (const citizen of citizens) {
    if (citizen.needs.hydration < 70) demand.water += 1
    if (citizen.needs.hunger < 70) demand.food += 1
    if (citizen.needs.energy < 60) demand.housing += 1
    if (citizen.health < 80) demand.clinic += 1
    if (!citizen.insurancePaidUntil) demand.insurance += 1
  }
  return demand
}

function areaServiceCapacity(
  citizens: FounderAreaCitizen[],
  businesses: FounderAreaBusiness[],
): Record<FounderAreaBusinessKind, number> {
  const capacity = emptyBusinessKindRecord()
  for (const business of businesses) {
    capacity[business.kind] += hourlyServiceCapacity(citizens, business)
  }
  return capacity
}

function emptyBusinessKindRecord(): Record<FounderAreaBusinessKind, number> {
  return {
    water: 0,
    food: 0,
    housing: 0,
    clinic: 0,
    insurance: 0,
  }
}

function totalCitizenDebt(citizen: FounderAreaCitizen): number {
  const itemizedDebt = (citizen.debts ?? []).reduce((total, debt) => total + debt.amount, 0)
  return roundMoney(Math.max(citizen.debt, itemizedDebt))
}

function founderActivityScore(input: {
  active: boolean
  useful: boolean
  building: boolean
  staffed: boolean
  indebted: boolean
}): number {
  return (input.active ? 30 : 0) +
    (input.useful ? 25 : 0) +
    (input.building ? 20 : 0) +
    (input.staffed ? 15 : 0) +
    (!input.indebted ? 10 : 0)
}

function founderCitizenRecord(citizen: CitizenAuthRecord, money: number): FounderAreaCitizen {
  const paddedFounder = String(citizen.founderNumber).padStart(4, '0')
  return {
    id: citizen.citizenId,
    name: `Founder #${paddedFounder}`,
    kind: 'real',
    money,
    debt: 0,
    needs: { ...FULL_NEEDS },
    health: 100,
    state: { kind: 'active' },
  }
}

function defaultSimCitizens(areaId: string): FounderAreaCitizen[] {
  return [
    simCitizen(`${areaId}:sim-water`, 'Demo Water Resident', { hydration: 42 }),
    simCitizen(`${areaId}:sim-food`, 'Demo Food Resident', { hunger: 44 }),
    simCitizen(`${areaId}:sim-housing`, 'Demo Housing Resident', { energy: 32 }),
  ]
}

function simCitizen(id: string, name: string, needs: Partial<FounderAreaNeeds>): FounderAreaCitizen {
  return {
    id,
    name,
    kind: 'sim',
    money: SIM_CITIZEN_STARTER_CREDIT,
    debt: 0,
    needs: { ...FULL_NEEDS, ...needs },
    health: 100,
    state: { kind: 'active' },
  }
}

function simCitizenCreditTransaction(
  areaId: string,
  at: string,
  atMs: number,
  sequence: number,
  citizen: FounderAreaCitizen,
): FounderAreaTransaction {
  return {
    id: `${areaId}:${atMs}:sim-citizen-credit:${sequence}:${citizen.id}`,
    at,
    kind: 'sim_citizen_credit',
    fromId: SIM_CREDIT_ACCOUNT_ID,
    toId: citizen.id,
    amount: SIM_CITIZEN_STARTER_CREDIT,
    memo: `${citizen.name} received simulated resident game credit.`,
  }
}

async function persistAreaState(
  citizenId: string,
  state: FounderAreaStateInput,
  allowOverwrite: boolean,
): Promise<FounderAreaState> {
  const reviewed = withFounderCovenantReview(state)
  await put(areaStatePath(citizenId), JSON.stringify(reviewed), {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite,
    contentType: 'application/json',
  })
  return reviewed
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

      const state = await persistAreaState(citizen.citizenId, buildFounderAreaState(citizen, intent, new Date()), false)
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

      const state = await persistAreaState(citizen.citizenId, result.state, true)
      res.status(200).json({ ok: true, state })
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

      const state = await persistAreaState(citizen.citizenId, result.state, true)
      res.status(200).json({ ok: true, state })
      return
    }

    if (intentType === 'buyInsurance') {
      const result = applyBuyInsuranceIntent(existing, rawIntent, new Date())
      if (!result.ok) {
        res.status(buyInsuranceStatus(result.error)).json({
          ok: false,
          error: buyInsuranceMessage(result.error),
          code: result.error,
          state: existing,
        })
        return
      }

      const state = await persistAreaState(citizen.citizenId, result.state, true)
      res.status(200).json({ ok: true, state })
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

      const state = await persistAreaState(citizen.citizenId, result.state, true)
      res.status(200).json({ ok: true, state })
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

      const state = await persistAreaState(citizen.citizenId, result.state, true)
      res.status(200).json({ ok: true, state })
      return
    }

    if (intentType === 'repayDebt') {
      const result = applyRepayDebtIntent(existing, rawIntent, new Date())
      if (!result.ok) {
        res.status(repayDebtStatus(result.error)).json({
          ok: false,
          error: repayDebtMessage(result.error),
          code: result.error,
          state: existing,
        })
        return
      }

      const state = await persistAreaState(citizen.citizenId, result.state, true)
      res.status(200).json({ ok: true, state })
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
      citizens: setFounderCitizenMoney(state, roundMoney(state.balance - blueprint.buildCost)),
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
  const worker = state.citizens.find((citizen) => citizen.id === intent.workerCitizenId)
  if (!worker) return { ok: false, error: 'worker_not_found' }
  if (worker.kind !== 'sim') return { ok: false, error: 'real_worker_requires_acceptance' }
  if (worker.state.kind !== 'active' || (worker.jobBusinessId && worker.jobBusinessId !== business.id)) {
    return { ok: false, error: 'worker_unavailable' }
  }
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
      citizens: state.citizens.map((candidate) =>
        candidate.id === intent.workerCitizenId ? { ...candidate, jobBusinessId: intent.businessId } : candidate
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
  const tickDates = areaClockTickDates(state, now)
  if (tickDates.length === 0) return { ok: false, error: 'clock_not_ready' }

  const transactions: FounderAreaTransaction[] = []
  const citizens = state.citizens.map(cloneCitizen)
  const businesses = state.businesses.map((business) => ({ ...business, staffCitizenIds: [...business.staffCitizenIds] }))
  for (const tickNow of tickDates) {
    applyAreaHourTick(state.areaId, state.founderCitizenId, citizens, businesses, tickNow, transactions)
  }
  const founder = citizens.find((citizen) => citizen.id === state.founderCitizenId)
  const balance = founder ? roundMoney(founder.money) : state.balance
  const updatedAt = tickDates.at(-1)?.toISOString() ?? state.updatedAt

  return {
    ok: true,
    state: {
      ...state,
      balance,
      businesses,
      citizens,
      transactions: [...state.transactions, ...transactions],
      updatedAt,
    },
  }
}

function applyAreaHourTick(
  areaId: string,
  founderCitizenId: string,
  citizens: FounderAreaCitizen[],
  businesses: FounderAreaBusiness[],
  now: Date,
  transactions: FounderAreaTransaction[],
): void {
  const at = now.toISOString()
  renewInsurancePolicies(areaId, citizens, businesses, now, at, transactions)
  applyFounderHour(areaId, founderCitizenId, citizens, businesses, now, at, transactions)
  degradeUnmanagedBusinesses(citizens, businesses)
  applySimCitizenHour(areaId, citizens, businesses, now, at, transactions)
  for (const business of businesses) {
    let cash = business.cash
    const paidWorkerIds: string[] = []
    for (const workerId of business.staffCitizenIds ?? []) {
      const worker = citizens.find((citizen) => citizen.id === workerId)
      if (!worker || worker.state.kind !== 'active' || worker.jobBusinessId !== business.id) continue
      if (cash < business.wagePerHour) break
      cash = roundMoney(cash - business.wagePerHour)
      worker.money = roundMoney(worker.money + business.wagePerHour)
      paidWorkerIds.push(workerId)
      transactions.push({
        id: `${areaId}:${now.getTime()}:worker-wage:${business.id}:${workerId}:${paidWorkerIds.length}`,
        at,
        kind: 'worker_wage',
        fromId: business.id,
        toId: workerId,
        amount: business.wagePerHour,
        memo: `${business.name} paid ${workerId} for one hour of work.`,
      })
    }
    business.cash = cash
  }
}

function areaClockTickDates(state: FounderAreaState, now: Date): Date[] {
  const updatedMs = Date.parse(state.updatedAt)
  if (!Number.isFinite(updatedMs)) return [now]
  const elapsedMs = now.getTime() - updatedMs
  if (elapsedMs < SERVER_AREA_TICK_MS) return []
  const tickCount = Math.min(MAX_SERVER_AREA_CATCH_UP_HOURS, Math.floor(elapsedMs / SERVER_AREA_TICK_MS))
  return Array.from({ length: tickCount }, (_, index) => new Date(updatedMs + (index + 1) * SERVER_AREA_TICK_MS))
}

function applyServicePurchaseIntent(
  state: FounderAreaState | null,
  input: unknown,
  now: Date,
): { ok: true; state: FounderAreaState } | { ok: false; error: ApplyServicePurchaseError } {
  if (!state) return { ok: false, error: 'area_not_claimed' }
  const intent = normalizeServicePurchaseIntent(input)
  if (!intent.ok) return intent

  const actor = state.citizens.find((citizen) => citizen.id === state.founderCitizenId)
  if (!actor || actor.state.kind !== 'active') return { ok: false, error: 'actor_unavailable' }

  const business = chooseServiceBusiness(state, intent.serviceKind)
  if (!business) return { ok: false, error: 'service_not_available' }
  if (state.balance < business.price) return { ok: false, error: 'insufficient_funds' }

  const at = now.toISOString()
  const nextBalance = roundMoney(state.balance - business.price)
  const serviceQuality = effectiveBusinessQuality(state.citizens, business)
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
      balance: nextBalance,
      businesses: state.businesses.map((candidate) =>
        candidate.id === business.id
          ? { ...candidate, cash: roundMoney(candidate.cash + business.price) }
          : candidate
      ),
      citizens: state.citizens.map((citizen) => {
        if (citizen.id !== actor.id) return citizen
        const nextCitizen = {
          ...citizen,
          money: nextBalance,
          needs: { ...citizen.needs },
          state: { ...citizen.state },
        }
        applyServiceEffect(nextCitizen, intent.serviceKind, serviceQuality)
        return nextCitizen
      }),
      transactions: [...state.transactions, transaction],
      updatedAt: at,
    },
  }
}

function applyBuyInsuranceIntent(
  state: FounderAreaState | null,
  input: unknown,
  now: Date,
): { ok: true; state: FounderAreaState } | { ok: false; error: ApplyBuyInsuranceError } {
  if (!state) return { ok: false, error: 'area_not_claimed' }
  const intent = normalizeBuyInsuranceIntent(input)
  if (!intent.ok) return intent

  const actor = state.citizens.find((citizen) => citizen.id === state.founderCitizenId)
  if (!actor || actor.state.kind !== 'active') return { ok: false, error: 'actor_unavailable' }

  const insurer = state.businesses.find((business) => business.id === intent.insuranceBusinessId)
  if (!insurer) return { ok: false, error: 'business_not_found' }
  if (insurer.kind !== 'insurance') return { ok: false, error: 'not_insurance_business' }

  const existingPolicyUntil = actor.insurancePaidUntil ? Date.parse(actor.insurancePaidUntil) : Number.NaN
  if (Number.isFinite(existingPolicyUntil) && existingPolicyUntil > now.getTime()) {
    return { ok: false, error: 'already_insured' }
  }
  if (state.balance < insurer.price) return { ok: false, error: 'insufficient_funds' }

  const at = now.toISOString()
  const paidUntil = new Date(now.getTime() + INSURANCE_POLICY_PERIOD_MS).toISOString()
  const transaction: FounderAreaTransaction = {
    id: `${state.areaId}:${now.getTime()}:insurance-premium:${actor.id}:${insurer.id}`,
    at,
    kind: 'insurance_premium',
    fromId: actor.id,
    toId: insurer.id,
    amount: insurer.price,
    memo: `${actor.name} bought insurance from ${insurer.name}.`,
  }

  return {
    ok: true,
    state: {
      ...state,
      balance: roundMoney(state.balance - insurer.price),
      businesses: state.businesses.map((business) =>
        business.id === insurer.id ? { ...business, cash: roundMoney(business.cash + insurer.price) } : business
      ),
      citizens: state.citizens.map((citizen) =>
        citizen.id === actor.id
          ? {
            ...citizen,
            money: roundMoney(citizen.money - insurer.price),
            insuranceBusinessId: insurer.id,
            insurancePaidUntil: paidUntil,
          }
          : citizen
      ),
      transactions: [...state.transactions, transaction],
      updatedAt: at,
    },
  }
}

function applyRepayDebtIntent(
  state: FounderAreaState | null,
  input: unknown,
  now: Date,
): { ok: true; state: FounderAreaState } | { ok: false; error: ApplyRepayDebtError } {
  if (!state) return { ok: false, error: 'area_not_claimed' }
  const intent = normalizeRepayDebtIntent(input)
  if (!intent.ok) return intent

  const actor = state.citizens.find((citizen) => citizen.id === state.founderCitizenId)
  if (!actor || actor.state.kind !== 'active') return { ok: false, error: 'actor_unavailable' }

  const debt = actor.debts?.find((candidate) => candidate.id === intent.debtId)
  if (!debt || debt.amount <= 0) return { ok: false, error: 'debt_not_found' }

  const payment = roundMoney(Math.min(intent.amount, debt.amount))
  if (payment <= 0) return { ok: false, error: 'invalid_debt_payment' }
  if (actor.money < payment) return { ok: false, error: 'insufficient_funds' }

  const at = now.toISOString()
  const nextDebtAmount = roundMoney(debt.amount - payment)
  const citizens = state.citizens.map((citizen) => {
    if (citizen.id !== actor.id) return citizen
    const nextDebts = (citizen.debts ?? [])
      .map((candidate) => candidate.id === debt.id ? { ...candidate, amount: nextDebtAmount } : candidate)
      .filter((candidate) => candidate.amount > 0)
    return {
      ...citizen,
      money: roundMoney(citizen.money - payment),
      debt: roundMoney(Math.max(0, citizen.debt - payment)),
      debts: nextDebts.length > 0 ? nextDebts : undefined,
    }
  })
  const businesses = state.businesses.map((business) =>
    business.id === debt.creditorId ? { ...business, cash: roundMoney(business.cash + payment) } : business
  )
  const transaction: FounderAreaTransaction = {
    id: `${state.areaId}:${now.getTime()}:debt-repayment:${actor.id}:${debt.id}`,
    at,
    kind: 'debt_repayment',
    fromId: actor.id,
    toId: debt.creditorId,
    amount: payment,
    memo: `${actor.name} repaid debt to ${debt.creditorId}.`,
  }

  return {
    ok: true,
    state: {
      ...state,
      balance: roundMoney(state.balance - payment),
      businesses,
      citizens,
      transactions: [...state.transactions, transaction],
      updatedAt: at,
    },
  }
}

function applyFounderHour(
  areaId: string,
  founderCitizenId: string,
  citizens: FounderAreaCitizen[],
  businesses: FounderAreaBusiness[],
  now: Date,
  at: string,
  transactions: FounderAreaTransaction[],
): void {
  const founder = citizens.find((citizen) => citizen.id === founderCitizenId)
  if (!founder) return
  if (founder.state.kind === 'hospitalized') {
    recoverIfReady(founder, now)
    return
  }
  decayNeeds(founder)
  applyUnmetNeedHealthPenalty(founder)
  if (shouldHospitalize(founder)) {
    hospitalizeCitizen(areaId, founder, businesses, now, at, transactions)
  }
}

function renewInsurancePolicies(
  areaId: string,
  citizens: FounderAreaCitizen[],
  businesses: FounderAreaBusiness[],
  now: Date,
  at: string,
  transactions: FounderAreaTransaction[],
): void {
  let renewalSequence = 0
  for (const citizen of citizens) {
    if (!citizen.insuranceBusinessId || hasActiveInsurance(citizen, now)) continue
    const insurer = businesses.find((business) =>
      business.id === citizen.insuranceBusinessId && business.kind === 'insurance'
    )
    if (!insurer || citizen.money < insurer.price) {
      lapseInsurance(citizen)
      continue
    }

    const paidUntil = new Date(now.getTime() + INSURANCE_POLICY_PERIOD_MS).toISOString()
    citizen.money = roundMoney(citizen.money - insurer.price)
    citizen.insurancePaidUntil = paidUntil
    insurer.cash = roundMoney(insurer.cash + insurer.price)
    renewalSequence += 1
    transactions.push({
      id: `${areaId}:${now.getTime()}:insurance-renewal:${citizen.id}:${insurer.id}:${renewalSequence}`,
      at,
      kind: 'insurance_premium',
      fromId: citizen.id,
      toId: insurer.id,
      amount: insurer.price,
      memo: `${citizen.name} renewed insurance with ${insurer.name}.`,
    })
  }
}

function hasActiveInsurance(citizen: FounderAreaCitizen, now: Date): boolean {
  if (!citizen.insuranceBusinessId || !citizen.insurancePaidUntil) return false
  const paidUntilMs = Date.parse(citizen.insurancePaidUntil)
  return Number.isFinite(paidUntilMs) && paidUntilMs > now.getTime()
}

function lapseInsurance(citizen: FounderAreaCitizen): void {
  delete citizen.insuranceBusinessId
  delete citizen.insurancePaidUntil
}

function degradeUnmanagedBusinesses(citizens: FounderAreaCitizen[], businesses: FounderAreaBusiness[]): void {
  for (const business of businesses) {
    const owner = citizens.find((citizen) => citizen.id === business.ownerId)
    if (owner?.state.kind !== 'hospitalized' || activeStaffCount(citizens, business) > 0) continue
    business.quality = roundMoney(Math.max(
      MIN_BUSINESS_QUALITY,
      (business.quality ?? 1) - UNSTAFFED_HOSPITALIZED_OWNER_QUALITY_LOSS_PER_HOUR,
    ))
  }
}

function activeStaffCount(citizens: FounderAreaCitizen[], business: FounderAreaBusiness): number {
  return (business.staffCitizenIds ?? [])
    .map((workerId) => citizens.find((citizen) => citizen.id === workerId))
    .filter((worker): worker is FounderAreaCitizen => worker?.state.kind === 'active' && worker.jobBusinessId === business.id)
    .length
}

function effectiveBusinessQuality(citizens: FounderAreaCitizen[], business: FounderAreaBusiness): number {
  const owner = citizens.find((citizen) => citizen.id === business.ownerId)
  const unmanagedPenalty = owner?.state.kind === 'hospitalized' && activeStaffCount(citizens, business) === 0 ? 0.35 : 1
  return clampQuality((business.quality ?? 1) * unmanagedPenalty)
}

function applySimCitizenHour(
  areaId: string,
  citizens: FounderAreaCitizen[],
  businesses: FounderAreaBusiness[],
  now: Date,
  at: string,
  transactions: FounderAreaTransaction[],
): void {
  let purchaseSequence = 0
  const capacityUsed = new Map<string, number>()
  for (const citizen of citizens) {
    if (citizen.kind !== 'sim') continue
    if (citizen.state.kind === 'hospitalized') {
      recoverIfReady(citizen, now)
      continue
    }
    decayNeeds(citizen)
    for (const serviceKind of serviceNeedsForCitizen(citizen)) {
      const business = chooseAvailableServiceBusiness(businesses, serviceKind, citizens, capacityUsed)
      if (!business || citizen.money < business.price) continue
      citizen.money = roundMoney(citizen.money - business.price)
      business.cash = roundMoney(business.cash + business.price)
      applyServiceEffect(citizen, serviceKind, effectiveBusinessQuality(citizens, business))
      reserveServiceCapacity(capacityUsed, business)
      purchaseSequence += 1
      transactions.push({
        id: `${areaId}:${now.getTime()}:sim-purchase:${citizen.id}:${serviceKind}:${business.id}:${purchaseSequence}`,
        at,
        kind: 'customer_purchase',
        fromId: citizen.id,
        toId: business.id,
        amount: business.price,
        memo: `${citizen.name} bought ${serviceKind} from ${business.name}.`,
      })
    }
    applyUnmetNeedHealthPenalty(citizen)
    if (shouldHospitalize(citizen)) {
      hospitalizeCitizen(areaId, citizen, businesses, now, at, transactions)
    }
  }
}

function chooseAvailableServiceBusiness(
  businesses: FounderAreaBusiness[],
  kind: Exclude<FounderAreaBusinessKind, 'insurance'>,
  citizens: FounderAreaCitizen[],
  capacityUsed: Map<string, number>,
): FounderAreaBusiness | null {
  const candidates = businesses
    .filter((business) => business.kind === kind)
    .filter((business) => hourlyServiceCapacity(citizens, business) > (capacityUsed.get(business.id) ?? 0))
    .sort((a, b) => a.price - b.price || a.createdAt.localeCompare(b.createdAt))
  return candidates[0] ?? null
}

function reserveServiceCapacity(capacityUsed: Map<string, number>, business: FounderAreaBusiness): void {
  capacityUsed.set(business.id, (capacityUsed.get(business.id) ?? 0) + 1)
}

function hourlyServiceCapacity(citizens: FounderAreaCitizen[], business: FounderAreaBusiness): number {
  const activeStaff = activeStaffCount(citizens, business)
  const staffMultiplier = activeStaff === 0 ? 1 : 1 + activeStaff * STAFF_CAPACITY_MULTIPLIER
  return Math.floor(BASE_SERVICE_CAPACITY_PER_HOUR[business.kind] * staffMultiplier * effectiveBusinessQuality(citizens, business))
}

function cloneCitizen(citizen: FounderAreaCitizen): FounderAreaCitizen {
  return {
    ...citizen,
    debts: citizen.debts?.map((debt) => ({ ...debt })),
    needs: { ...citizen.needs },
    state: { ...citizen.state },
  }
}

function decayNeeds(citizen: FounderAreaCitizen): void {
  citizen.needs = {
    hunger: clampNeed(citizen.needs.hunger - NEED_DECAY_PER_HOUR.hunger),
    hydration: clampNeed(citizen.needs.hydration - NEED_DECAY_PER_HOUR.hydration),
    energy: clampNeed(citizen.needs.energy - NEED_DECAY_PER_HOUR.energy),
    hygiene: clampNeed(citizen.needs.hygiene - NEED_DECAY_PER_HOUR.hygiene),
    fun: clampNeed(citizen.needs.fun - NEED_DECAY_PER_HOUR.fun),
  }
}

function applyUnmetNeedHealthPenalty(citizen: FounderAreaCitizen): void {
  const criticalNeeds = [
    citizen.needs.hydration <= 0,
    citizen.needs.hunger <= 0,
    citizen.needs.energy <= 0,
  ].filter(Boolean).length
  if (criticalNeeds === 0) return
  citizen.health = clampNeed(citizen.health - criticalNeeds * 15)
}

function shouldHospitalize(citizen: FounderAreaCitizen): boolean {
  return citizen.health <= COLLAPSE_HEALTH || citizen.needs.hydration <= 0 || citizen.needs.hunger <= 0
}

function recoverIfReady(citizen: FounderAreaCitizen, now: Date): boolean {
  if (citizen.state.kind !== 'hospitalized') return false
  const untilMs = Date.parse(citizen.state.until)
  if (Number.isFinite(untilMs) && untilMs > now.getTime()) return false
  citizen.state = { kind: 'active' }
  citizen.health = Math.max(citizen.health, RECOVERY_HEALTH)
  citizen.needs = {
    ...citizen.needs,
    hunger: Math.max(citizen.needs.hunger, 45),
    hydration: Math.max(citizen.needs.hydration, 45),
    energy: Math.max(citizen.needs.energy, 35),
  }
  return true
}

function hospitalizeCitizen(
  areaId: string,
  citizen: FounderAreaCitizen,
  businesses: FounderAreaBusiness[],
  now: Date,
  at: string,
  transactions: FounderAreaTransaction[],
): void {
  citizen.health = Math.max(citizen.health, 30)
  const insurancePaid = settleHospitalBill(areaId, citizen, businesses, now, at, transactions)
  const recoveryHours = insurancePaid ? INSURED_HOSPITALIZATION_HOURS : HOSPITALIZATION_HOURS
  const until = new Date(now.getTime() + recoveryHours * 3_600_000).toISOString()
  citizen.state = { kind: 'hospitalized', until }
}

function settleHospitalBill(
  areaId: string,
  citizen: FounderAreaCitizen,
  businesses: FounderAreaBusiness[],
  now: Date,
  at: string,
  transactions: FounderAreaTransaction[],
): boolean {
  const clinic = chooseServiceBusinessFromBusinesses(businesses, 'clinic')
  const receiverId = clinic?.id ?? SYSTEM_HOSPITAL_ACCOUNT_ID
  let remaining = HOSPITAL_BILL
  let insurancePaid = false

  const insurer = activeInsuranceBusiness(citizen, businesses, now)
  if (insurer) {
    const coverage = roundMoney(Math.min(HOSPITAL_BILL * INSURANCE_COVERAGE, insurer.cash))
    if (coverage > 0) {
      insurancePaid = true
      insurer.cash = roundMoney(insurer.cash - coverage)
      if (clinic) clinic.cash = roundMoney(clinic.cash + coverage)
      remaining = roundMoney(remaining - coverage)
      transactions.push({
        id: `${areaId}:${now.getTime()}:insurance-payout:${insurer.id}:${citizen.id}`,
        at,
        kind: 'insurance_payout',
        fromId: insurer.id,
        toId: receiverId,
        amount: coverage,
        memo: `${insurer.name} covered part of ${citizen.name}'s hospital bill.`,
      })
    }
  }

  const paid = roundMoney(Math.min(remaining, citizen.money))
  if (paid > 0) {
    citizen.money = roundMoney(citizen.money - paid)
    if (clinic) clinic.cash = roundMoney(clinic.cash + paid)
    remaining = roundMoney(remaining - paid)
    transactions.push({
      id: `${areaId}:${now.getTime()}:hospital-bill:${citizen.id}`,
      at,
      kind: 'hospital_bill',
      fromId: citizen.id,
      toId: receiverId,
      amount: paid,
      memo: `${citizen.name} paid a hospital bill.`,
    })
  }

  if (remaining <= 0) return insurancePaid
  citizen.debt = roundMoney(citizen.debt + remaining)
  const debt: FounderAreaDebt = {
    id: `${citizen.id}:${now.getTime()}:${(citizen.debts?.length ?? 0) + 1}:medical`,
    kind: 'medical',
    creditorId: receiverId,
    amount: remaining,
    issuedAt: at,
    memo: `${citizen.name} owes medical debt to ${receiverId}.`,
  }
  citizen.debts = [...(citizen.debts ?? []), debt]
  transactions.push({
    id: `${areaId}:${now.getTime()}:medical-debt:${citizen.id}`,
    at,
    kind: 'medical_debt',
    fromId: citizen.id,
    toId: receiverId,
    amount: remaining,
    memo: `${citizen.name} left the hospital bill as medical debt.`,
  })
  return insurancePaid
}

function activeInsuranceBusiness(
  citizen: FounderAreaCitizen,
  businesses: FounderAreaBusiness[],
  now: Date,
): FounderAreaBusiness | null {
  if (!citizen.insuranceBusinessId || !citizen.insurancePaidUntil) return null
  const paidUntilMs = Date.parse(citizen.insurancePaidUntil)
  if (!Number.isFinite(paidUntilMs) || paidUntilMs <= now.getTime()) return null
  return businesses.find((business) =>
    business.id === citizen.insuranceBusinessId && business.kind === 'insurance'
  ) ?? null
}

function serviceNeedsForCitizen(citizen: FounderAreaCitizen): Exclude<FounderAreaBusinessKind, 'insurance'>[] {
  const services: Exclude<FounderAreaBusinessKind, 'insurance'>[] = []
  if (citizen.needs.hydration < NEED_PURCHASE_THRESHOLD) services.push('water')
  if (citizen.needs.hunger < NEED_PURCHASE_THRESHOLD) services.push('food')
  if (citizen.needs.energy < NEED_PURCHASE_THRESHOLD) services.push('housing')
  if (citizen.health < HEALTH_PURCHASE_THRESHOLD) services.push('clinic')
  return services
}

function applyServiceEffect(
  citizen: FounderAreaCitizen,
  serviceKind: Exclude<FounderAreaBusinessKind, 'insurance'>,
  quality: number,
): void {
  const effect = SERVICE_EFFECTS[serviceKind]
  citizen.needs = {
    ...citizen.needs,
    hunger: effect.hunger === undefined ? citizen.needs.hunger : clampNeed(citizen.needs.hunger + effect.hunger * quality),
    hydration: effect.hydration === undefined ? citizen.needs.hydration : clampNeed(citizen.needs.hydration + effect.hydration * quality),
    energy: effect.energy === undefined ? citizen.needs.energy : clampNeed(citizen.needs.energy + effect.energy * quality),
    hygiene: effect.hygiene === undefined ? citizen.needs.hygiene : clampNeed(citizen.needs.hygiene + effect.hygiene * quality),
    fun: effect.fun === undefined ? citizen.needs.fun : clampNeed(citizen.needs.fun + effect.fun * quality),
  }
  if (effect.health !== undefined) citizen.health = clampNeed(citizen.health + effect.health * quality)
}

function chooseServiceBusiness(
  state: FounderAreaState,
  kind: Exclude<FounderAreaBusinessKind, 'insurance'>,
): FounderAreaBusiness | null {
  return chooseServiceBusinessFromBusinesses(state.businesses, kind)
}

function chooseServiceBusinessFromBusinesses(
  businesses: FounderAreaBusiness[],
  kind: Exclude<FounderAreaBusinessKind, 'insurance'>,
): FounderAreaBusiness | null {
  const candidates = businesses
    .filter((business) => business.kind === kind)
    .sort((a, b) => a.price - b.price || a.createdAt.localeCompare(b.createdAt))
  return candidates[0] ?? null
}

function setFounderCitizenMoney(state: FounderAreaState, money: number): FounderAreaCitizen[] {
  return state.citizens.map((citizen) =>
    citizen.id === state.founderCitizenId ? { ...citizen, money } : citizen
  )
}

function servicePurchaseStatus(error: ApplyServicePurchaseError): number {
  if (error === 'area_not_claimed' || error === 'actor_unavailable' || error === 'service_not_available') return 409
  if (error === 'insufficient_funds') return 402
  return error === 'unsupported_intent' ? 400 : 422
}

function servicePurchaseMessage(error: ApplyServicePurchaseError): string {
  switch (error) {
    case 'area_not_claimed':
      return 'Area must be claimed before buying services.'
    case 'actor_unavailable':
      return 'Founder must be active before buying services.'
    case 'service_not_available':
      return 'No local business can serve that need yet.'
    case 'insufficient_funds':
      return 'Founder balance is too low for this purchase.'
    default:
      return 'Invalid service purchase intent.'
  }
}

function buyInsuranceStatus(error: ApplyBuyInsuranceError): number {
  if (
    error === 'area_not_claimed' ||
    error === 'actor_unavailable' ||
    error === 'business_not_found' ||
    error === 'not_insurance_business' ||
    error === 'already_insured'
  ) {
    return 409
  }
  if (error === 'insufficient_funds') return 402
  return error === 'unsupported_intent' ? 400 : 422
}

function buyInsuranceMessage(error: ApplyBuyInsuranceError): string {
  switch (error) {
    case 'area_not_claimed':
      return 'Area must be claimed before buying insurance.'
    case 'actor_unavailable':
      return 'Founder must be active before buying insurance.'
    case 'business_not_found':
      return 'Insurance business must exist before buying a policy.'
    case 'not_insurance_business':
      return 'Selected business is not an insurance provider.'
    case 'already_insured':
      return 'Founder already has active insurance.'
    case 'insufficient_funds':
      return 'Founder balance is too low for this insurance premium.'
    default:
      return 'Invalid buyInsurance intent.'
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
    error === 'worker_already_hired' ||
    error === 'worker_not_found' ||
    error === 'worker_unavailable' ||
    error === 'real_worker_requires_acceptance'
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
    case 'worker_not_found':
      return 'Worker must exist in the server-owned Sim Citizen roster.'
    case 'worker_unavailable':
      return 'Worker is not available for this job.'
    case 'real_worker_requires_acceptance':
      return 'Real workers must accept job offers themselves.'
    default:
      return 'Invalid hireWorker intent.'
  }
}

function advanceHourStatus(error: ApplyAdvanceHourError): number {
  if (error === 'area_not_claimed' || error === 'clock_not_ready') return 409
  return error === 'unsupported_intent' ? 400 : 422
}

function advanceHourMessage(error: ApplyAdvanceHourError): string {
  switch (error) {
    case 'area_not_claimed':
      return 'Area must be claimed before advancing the simulation.'
    case 'clock_not_ready':
      return 'Reality area can advance only after a real hour has elapsed.'
    default:
      return 'Invalid advanceHour intent.'
  }
}

function repayDebtStatus(error: ApplyRepayDebtError): number {
  if (error === 'area_not_claimed' || error === 'actor_unavailable' || error === 'debt_not_found') return 409
  if (error === 'insufficient_funds') return 402
  return error === 'unsupported_intent' ? 400 : 422
}

function repayDebtMessage(error: ApplyRepayDebtError): string {
  switch (error) {
    case 'area_not_claimed':
      return 'Area must be claimed before repaying debt.'
    case 'actor_unavailable':
      return 'Founder must be active before repaying debt.'
    case 'debt_not_found':
      return 'Debt must exist on the server before repayment.'
    case 'insufficient_funds':
      return 'Founder balance is too low for this debt repayment.'
    default:
      return 'Invalid repayDebt intent.'
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

function clampNeed(value: number): number {
  if (value < 0) return 0
  if (value > 100) return 100
  return Math.round(value * 100) / 100
}

function clampQuality(value: number): number {
  if (value < 0.15) return 0.15
  if (value > 1.5) return 1.5
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
