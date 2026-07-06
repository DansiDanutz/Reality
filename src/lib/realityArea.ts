import type { Citizen } from '../game/types'
import type { FounderAreaProfile } from '../game/founderAreaSession'
import type {
  AreaBusinessAlert,
  AreaBusinessDashboard,
  AreaBusinessStatus,
  AreaCitizenDashboard,
  AreaJobsDashboard,
  AreaNeedsDashboard,
  AreaSurvivalDashboard,
  AreaWorkerCandidateAction,
  CitizenSurvivalSignal,
  FirstBuildAction,
  FirstBuildBlocker,
  FirstBuildRecommendation,
  WorldArea,
  WorldBusiness,
  WorldBusinessKind,
  WorldCitizen,
  WorldClientIntentPayload,
  WorldSurvivalActionBlocker,
  WorldSurvivalActionIntent,
  WorldSurvivalRiskLevel,
  WorldSurvivalWarningKind,
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

export interface RealityAreaLicenseDashboard {
  slots: number
  used: number
  remaining: number
  saturation: number
}

export interface RealityAreaFirstBuildRecommendation {
  kind: WorldBusinessKind
  name: string
  proposedBusinessId: string | null
  buildCost: number
  currentDemand: number
  currentSupply: number
  licensesRemaining: number
  saturation: number
  founderCanAfford: boolean
  canBuildNow: boolean
  clientPayload: Extract<WorldClientIntentPayload, { type: 'buildBusiness' }> | null
  reason: string
}

export interface RealityAreaWorkerCandidateDashboard {
  citizenId: string
  name: string
  displayName: string
  kind: 'real' | 'sim'
  simulated: boolean
  participantLabel: 'Sim Citizen' | 'Real Citizen'
  visualTone: 'simulated' | 'real'
  action: AreaWorkerCandidateAction
  recommendedBusinessId: string | null
  recommendedBusinessName: string | null
  recommendedBusinessKind: WorldBusinessKind | null
  clientPayload: Extract<WorldClientIntentPayload, { type: 'hireWorker' }> | null
}

export interface RealityAreaJobsDashboard {
  employedCitizens: number
  unemployedCitizens: number
  hireableSimWorkers: number
  realWorkersRequiringAcceptance: number
  openPositions: number
  understaffedBusinesses: number
  candidates: RealityAreaWorkerCandidateDashboard[]
}

export interface RealityAreaBusinessDashboard {
  id: string
  name: string
  kind: WorldBusinessKind
  ownerId: string
  cash: number
  price: number
  wagePerHour: number
  quality: number
  activeStaff: number
  targetStaff: number
  openPositions: number
  hourlyCapacity: number
  status: AreaBusinessStatus
  alerts: AreaBusinessAlert[]
}

export interface RealityAreaCitizenDebtDashboard {
  id: string
  kind: 'medical'
  creditorId: string
  amount: number
  issuedAt: string
  memo: string
}

export interface RealityAreaCitizenDashboard {
  id: string
  name: string
  displayName: string
  kind: 'real' | 'sim'
  simulated: boolean
  participantLabel: 'Sim Citizen' | 'Real Citizen'
  visualTone: 'simulated' | 'real'
  state: 'active' | 'hospitalized'
  health: number
  needs: RealityAreaNeeds
  money: number
  debt: number
  debts: RealityAreaCitizenDebtDashboard[]
  homeBusinessId?: string
  jobBusinessId?: string
  insuranceBusinessId?: string
  insuranceActive: boolean
}

export interface RealityAreaSurvivalAction {
  warning: WorldSurvivalWarningKind
  intent: WorldSurvivalActionIntent
  clientPayload: Extract<WorldClientIntentPayload, { type: WorldSurvivalActionIntent }>
  serviceKind: Exclude<WorldBusinessKind, 'insurance'>
  available: boolean
  lowestPrice: number | null
  canAfford: boolean
  blockers: WorldSurvivalActionBlocker[]
}

export interface RealityAreaSurvivalSignal {
  citizenId: string
  name: string
  displayName: string
  kind: 'real' | 'sim'
  simulated: boolean
  participantLabel: 'Sim Citizen' | 'Real Citizen'
  visualTone: 'simulated' | 'real'
  risk: WorldSurvivalRiskLevel
  warnings: WorldSurvivalWarningKind[]
  actions: RealityAreaSurvivalAction[]
  hospitalizedUntil?: string
}

export interface RealityAreaSurvivalDashboard {
  stableCitizens: number
  warningCitizens: number
  dangerCitizens: number
  hospitalizedCitizens: number
  signals: RealityAreaSurvivalSignal[]
}

export interface RealityAreaDashboard {
  areaId: string
  updatedAt: string
  population: number
  simPopulation: number
  realPopulation: number
  demand: Record<WorldBusinessKind, number>
  simDemand: Record<WorldBusinessKind, number>
  realDemand: Record<WorldBusinessKind, number>
  supply: Record<WorldBusinessKind, number>
  capacity: Record<WorldBusinessKind, number>
  shortage: Record<WorldBusinessKind, number>
  licenseSlots: Record<WorldBusinessKind, number>
  saturation: Record<WorldBusinessKind, number>
  licenses: Record<WorldBusinessKind, RealityAreaLicenseDashboard>
  jobs: RealityAreaJobsDashboard
  firstBuild: RealityAreaFirstBuildRecommendation[]
  existingBusinesses: RealityAreaBusinessDashboard[]
  citizens: RealityAreaCitizenDashboard[]
  survival: RealityAreaSurvivalDashboard
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
  | { ok: true; state: RealityAreaState; restoredExisting: boolean; dashboard?: RealityAreaDashboard }
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
  | { ok: true; state: RealityAreaState; dashboard?: RealityAreaDashboard }
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
    const dashboard = isRealityAreaDashboard(data.dashboard) ? data.dashboard : undefined
    if (response.ok && data.ok === true && state) {
      return { ok: true, state, restoredExisting: false, dashboard }
    }
    if (response.status === 409 && data.code === 'area_already_claimed' && state) {
      return { ok: true, state, restoredExisting: true, dashboard }
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
    const dashboard = isRealityAreaDashboard(data.dashboard) ? data.dashboard : undefined
    if (response.ok && data.ok === true && state) return { ok: true, state, dashboard }
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

export function mergeRealityAreaDashboardIntoWorldDashboard(
  dashboard: AreaNeedsDashboard,
  serverDashboard: RealityAreaDashboard | undefined,
): AreaNeedsDashboard {
  if (!serverDashboard) return dashboard

  const licenseSlots = { ...dashboard.licenseSlots, ...serverDashboard.licenseSlots }
  const saturation = { ...dashboard.saturation, ...serverDashboard.saturation }
  const licenses = { ...dashboard.licenses }
  for (const kind of BUSINESS_KINDS) {
    const serverLicense = serverDashboard.licenses[kind]
    if (!serverLicense) continue
    licenses[kind] = {
      ...licenses[kind],
      slots: serverLicense.slots,
      used: serverLicense.used,
      remaining: serverLicense.remaining,
      saturation: serverLicense.saturation,
    }
  }

  return {
    ...dashboard,
    population: serverDashboard.population,
    simPopulation: serverDashboard.simPopulation,
    realPopulation: serverDashboard.realPopulation,
    demand: { ...serverDashboard.demand },
    simDemand: { ...serverDashboard.simDemand },
    realDemand: { ...serverDashboard.realDemand },
    supply: { ...serverDashboard.supply },
    capacity: { ...serverDashboard.capacity },
    shortage: { ...serverDashboard.shortage },
    licenseSlots,
    saturation,
    licenses,
    jobs: mergeRealityAreaJobsDashboard(dashboard.jobs, serverDashboard.jobs),
    firstBuild: serverDashboard.firstBuild.map((recommendation) =>
      mergeFirstBuildRecommendation(recommendation, dashboard.firstBuild.find((candidate) => candidate.kind === recommendation.kind), serverDashboard)
    ),
    existingBusinesses: serverDashboard.existingBusinesses.map((business) =>
      mergeRealityAreaBusinessDashboard(business, dashboard.existingBusinesses.find((candidate) => candidate.id === business.id))
    ),
    citizens: serverDashboard.citizens.map((citizen) =>
      mergeRealityAreaCitizenDashboard(citizen, dashboard.citizens.find((candidate) => candidate.id === citizen.id))
    ),
    survival: mergeRealityAreaSurvivalDashboard(serverDashboard.survival),
  }
}

function mergeRealityAreaJobsDashboard(
  fallback: AreaJobsDashboard,
  serverJobs: RealityAreaJobsDashboard,
): AreaJobsDashboard {
  return {
    ...fallback,
    employedCitizens: serverJobs.employedCitizens,
    unemployedCitizens: serverJobs.unemployedCitizens,
    hireableSimWorkers: serverJobs.hireableSimWorkers,
    realWorkersRequiringAcceptance: serverJobs.realWorkersRequiringAcceptance,
    openPositions: serverJobs.openPositions,
    understaffedBusinesses: serverJobs.understaffedBusinesses,
    candidates: serverJobs.candidates.map((candidate) => ({ ...candidate })),
  }
}

function mergeRealityAreaBusinessDashboard(
  business: RealityAreaBusinessDashboard,
  fallback: AreaBusinessDashboard | undefined,
): AreaBusinessDashboard {
  return {
    ...fallback,
    id: business.id,
    name: business.name,
    kind: business.kind,
    ownerId: business.ownerId,
    cash: business.cash,
    price: business.price,
    wagePerHour: business.wagePerHour,
    quality: business.quality,
    activeStaff: business.activeStaff,
    targetStaff: business.targetStaff,
    openPositions: business.openPositions,
    hourlyCapacity: business.hourlyCapacity,
    status: business.status,
    alerts: business.alerts.map((alert) => ({ ...alert })),
    ledger: fallback?.ledger ?? {
      transactionCount: 0,
      revenue: 0,
      expenses: 0,
      netCashFlow: 0,
      wagesPaid: 0,
      receivablesIssued: 0,
      recentTransactions: [],
    },
  }
}

function mergeRealityAreaSurvivalDashboard(survival: RealityAreaSurvivalDashboard): AreaSurvivalDashboard {
  return {
    stableCitizens: survival.stableCitizens,
    warningCitizens: survival.warningCitizens,
    dangerCitizens: survival.dangerCitizens,
    hospitalizedCitizens: survival.hospitalizedCitizens,
    signals: survival.signals.map(mergeRealityAreaSurvivalSignal),
  }
}

function mergeRealityAreaSurvivalSignal(signal: RealityAreaSurvivalSignal): CitizenSurvivalSignal {
  return {
    ...signal,
    actions: signal.actions.map((action) => ({
      ...action,
      blockers: [...action.blockers],
      clientPayload: { ...action.clientPayload },
    })),
    warnings: [...signal.warnings],
    hospitalizedUntil: signal.hospitalizedUntil ? parseInstant(signal.hospitalizedUntil) : undefined,
  }
}

function mergeRealityAreaCitizenDashboard(
  citizen: RealityAreaCitizenDashboard,
  fallback: AreaCitizenDashboard | undefined,
): AreaCitizenDashboard {
  const fallbackDebts = new Map((fallback?.debts ?? []).map((debt) => [debt.id, debt]))
  return {
    ...fallback,
    id: citizen.id,
    name: citizen.name,
    displayName: citizen.displayName,
    kind: citizen.kind,
    simulated: citizen.simulated,
    participantLabel: citizen.participantLabel,
    visualTone: citizen.visualTone,
    state: citizen.state,
    health: citizen.health,
    needs: { ...citizen.needs },
    money: citizen.money,
    debt: citizen.debt,
    debts: citizen.debts.map((debt) => mergeRealityAreaDebtDashboard(debt, fallbackDebts.get(debt.id), citizen)),
    homeBusinessId: citizen.homeBusinessId,
    jobBusinessId: citizen.jobBusinessId,
    insuranceBusinessId: citizen.insuranceBusinessId,
    insuranceActive: citizen.insuranceActive,
    insuranceAction: fallback?.insuranceAction ?? {
      intent: 'buyInsurance',
      clientPayload: null,
      insuranceBusinessId: null,
      premium: null,
      available: false,
      canAfford: false,
      canBuyNow: false,
      blockers: ['service_unavailable'],
    },
    estateProtection: fallback?.estateProtection ?? {
      enabled: false,
      namedHeirCitizenId: null,
      namedHeirName: null,
      protectedByInsurance: citizen.insuranceActive,
      status: 'disabled_until_death_enabled',
    },
  }
}

function mergeRealityAreaDebtDashboard(
  debt: RealityAreaCitizenDebtDashboard,
  fallback: AreaCitizenDashboard['debts'][number] | undefined,
  citizen: RealityAreaCitizenDashboard,
): AreaCitizenDashboard['debts'][number] {
  const maxAffordablePayment = roundMoney(Math.min(citizen.money, debt.amount))
  const blockers: AreaCitizenDashboard['debts'][number]['blockers'] = []
  if (citizen.state !== 'active') blockers.push('actor_unavailable')
  if (maxAffordablePayment <= 0) blockers.push('insufficient_funds')
  return {
    ...fallback,
    id: debt.id,
    kind: debt.kind,
    creditorId: debt.creditorId,
    amount: debt.amount,
    issuedAt: parseInstant(debt.issuedAt),
    memo: debt.memo,
    repaymentIntent: 'repayDebt',
    clientPayload: maxAffordablePayment > 0
      ? { type: 'repayDebt', debtId: debt.id, amount: maxAffordablePayment }
      : null,
    recommendedPayment: maxAffordablePayment,
    maxAffordablePayment,
    canRepayNow: blockers.length === 0,
    blockers,
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

const BUSINESS_KINDS: WorldBusinessKind[] = ['water', 'food', 'housing', 'clinic', 'insurance']

function mergeFirstBuildRecommendation(
  recommendation: RealityAreaFirstBuildRecommendation,
  fallback: FirstBuildRecommendation | undefined,
  serverDashboard: RealityAreaDashboard,
): FirstBuildRecommendation {
  const license = serverDashboard.licenses[recommendation.kind]
  const licensed = recommendation.licensesRemaining > 0
  const saturated = license ? license.remaining <= 0 && license.slots > 0 : recommendation.saturation >= 1
  const blockers = serverFirstBuildBlockers(recommendation)
  return {
    ...fallback,
    kind: recommendation.kind,
    name: recommendation.name,
    proposedBusinessId: recommendation.proposedBusinessId,
    priority: fallback?.priority ?? 'low',
    action: serverFirstBuildAction(recommendation, blockers),
    clientPayload: recommendation.clientPayload,
    score: fallback?.score ?? 0,
    buildCost: recommendation.buildCost,
    cashShortfall: recommendation.founderCanAfford ? 0 : (fallback?.cashShortfall ?? recommendation.buildCost),
    currentDemand: recommendation.currentDemand,
    currentSupply: recommendation.currentSupply,
    licenseSlots: license?.slots ?? serverDashboard.licenseSlots[recommendation.kind] ?? fallback?.licenseSlots ?? 0,
    licensesRemaining: recommendation.licensesRemaining,
    nextLicensePopulation: fallback?.nextLicensePopulation ?? 0,
    citizensUntilNextLicense: fallback?.citizensUntilNextLicense ?? 0,
    founderCanAfford: recommendation.founderCanAfford,
    canBuildNow: recommendation.canBuildNow,
    blockers,
    licensed,
    saturated,
    estimatedHourlyRevenue: fallback?.estimatedHourlyRevenue ?? 0,
    estimatedHourlyWageCost: fallback?.estimatedHourlyWageCost ?? 0,
    estimatedHourlyProfit: fallback?.estimatedHourlyProfit ?? 0,
    estimatedPaybackHours: fallback?.estimatedPaybackHours ?? null,
    reason: recommendation.reason,
  }
}

function serverFirstBuildBlockers(recommendation: RealityAreaFirstBuildRecommendation): FirstBuildBlocker[] {
  const blockers: FirstBuildBlocker[] = []
  if (recommendation.reason === 'Founder must recover before building.') blockers.push('actor_unavailable')
  if (recommendation.licensesRemaining <= 0) blockers.push('license_unavailable')
  if (!recommendation.founderCanAfford) blockers.push('insufficient_funds')
  return blockers
}

function serverFirstBuildAction(
  recommendation: RealityAreaFirstBuildRecommendation,
  blockers: FirstBuildBlocker[],
): FirstBuildAction {
  if (recommendation.canBuildNow) return 'build_now'
  if (blockers.includes('actor_unavailable')) return 'recover_first'
  if (blockers.includes('insufficient_funds')) return 'save_credits'
  if (blockers.includes('license_unavailable')) return 'grow_demand'
  return recommendation.currentDemand > recommendation.currentSupply ? 'build_now' : 'wait_for_demand'
}

function isRealityAreaDashboard(value: unknown): value is RealityAreaDashboard {
  if (!isRecord(value)) return false
  return typeof value.areaId === 'string' &&
    typeof value.updatedAt === 'string' &&
    typeof value.population === 'number' &&
    typeof value.simPopulation === 'number' &&
    typeof value.realPopulation === 'number' &&
    isKindNumberRecord(value.demand) &&
    isKindNumberRecord(value.simDemand) &&
    isKindNumberRecord(value.realDemand) &&
    isKindNumberRecord(value.supply) &&
    isKindNumberRecord(value.capacity) &&
    isKindNumberRecord(value.shortage) &&
    isKindNumberRecord(value.licenseSlots) &&
    isKindNumberRecord(value.saturation) &&
    isLicenseDashboardRecord(value.licenses) &&
    isRealityAreaJobsDashboard(value.jobs) &&
    Array.isArray(value.firstBuild) &&
    value.firstBuild.every(isRealityAreaFirstBuildRecommendation) &&
    Array.isArray(value.existingBusinesses) &&
    value.existingBusinesses.every(isRealityAreaBusinessDashboard) &&
    Array.isArray(value.citizens) &&
    value.citizens.every(isRealityAreaCitizenDashboard) &&
    isRealityAreaSurvivalDashboard(value.survival)
}

function isKindNumberRecord(value: unknown): value is Record<WorldBusinessKind, number> {
  return isRecord(value) && BUSINESS_KINDS.every((kind) => typeof value[kind] === 'number')
}

function isLicenseDashboardRecord(value: unknown): value is Record<WorldBusinessKind, RealityAreaLicenseDashboard> {
  return isRecord(value) && BUSINESS_KINDS.every((kind) => isRealityAreaLicenseDashboard(value[kind]))
}

function isRealityAreaLicenseDashboard(value: unknown): value is RealityAreaLicenseDashboard {
  return isRecord(value) &&
    typeof value.slots === 'number' &&
    typeof value.used === 'number' &&
    typeof value.remaining === 'number' &&
    typeof value.saturation === 'number'
}

function isRealityAreaJobsDashboard(value: unknown): value is RealityAreaJobsDashboard {
  return isRecord(value) &&
    typeof value.employedCitizens === 'number' &&
    typeof value.unemployedCitizens === 'number' &&
    typeof value.hireableSimWorkers === 'number' &&
    typeof value.realWorkersRequiringAcceptance === 'number' &&
    typeof value.openPositions === 'number' &&
    typeof value.understaffedBusinesses === 'number' &&
    Array.isArray(value.candidates) &&
    value.candidates.every(isRealityAreaWorkerCandidateDashboard)
}

function isRealityAreaBusinessDashboard(value: unknown): value is RealityAreaBusinessDashboard {
  if (!isRecord(value)) return false
  return typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    isBusinessKind(value.kind) &&
    typeof value.ownerId === 'string' &&
    typeof value.cash === 'number' &&
    typeof value.price === 'number' &&
    typeof value.wagePerHour === 'number' &&
    typeof value.quality === 'number' &&
    typeof value.activeStaff === 'number' &&
    typeof value.targetStaff === 'number' &&
    typeof value.openPositions === 'number' &&
    typeof value.hourlyCapacity === 'number' &&
    isBusinessStatus(value.status) &&
    Array.isArray(value.alerts) &&
    value.alerts.every(isBusinessAlert)
}

function isBusinessAlert(value: unknown): value is AreaBusinessAlert {
  return isRecord(value) &&
    isBusinessAlertKind(value.kind) &&
    (value.severity === 'warning' || value.severity === 'critical')
}

function isRealityAreaCitizenDashboard(value: unknown): value is RealityAreaCitizenDashboard {
  if (!isRecord(value)) return false
  return typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.displayName === 'string' &&
    (value.kind === 'real' || value.kind === 'sim') &&
    typeof value.simulated === 'boolean' &&
    (value.participantLabel === 'Sim Citizen' || value.participantLabel === 'Real Citizen') &&
    (value.visualTone === 'simulated' || value.visualTone === 'real') &&
    (value.state === 'active' || value.state === 'hospitalized') &&
    typeof value.health === 'number' &&
    isRealityAreaNeeds(value.needs) &&
    typeof value.money === 'number' &&
    typeof value.debt === 'number' &&
    Array.isArray(value.debts) &&
    value.debts.every(isRealityAreaCitizenDebtDashboard) &&
    (typeof value.homeBusinessId === 'string' || value.homeBusinessId === undefined) &&
    (typeof value.jobBusinessId === 'string' || value.jobBusinessId === undefined) &&
    (typeof value.insuranceBusinessId === 'string' || value.insuranceBusinessId === undefined) &&
    typeof value.insuranceActive === 'boolean'
}

function isRealityAreaCitizenDebtDashboard(value: unknown): value is RealityAreaCitizenDebtDashboard {
  return isRecord(value) &&
    typeof value.id === 'string' &&
    value.kind === 'medical' &&
    typeof value.creditorId === 'string' &&
    typeof value.amount === 'number' &&
    typeof value.issuedAt === 'string' &&
    typeof value.memo === 'string'
}

function isRealityAreaSurvivalDashboard(value: unknown): value is RealityAreaSurvivalDashboard {
  return isRecord(value) &&
    typeof value.stableCitizens === 'number' &&
    typeof value.warningCitizens === 'number' &&
    typeof value.dangerCitizens === 'number' &&
    typeof value.hospitalizedCitizens === 'number' &&
    Array.isArray(value.signals) &&
    value.signals.every(isRealityAreaSurvivalSignal)
}

function isRealityAreaSurvivalSignal(value: unknown): value is RealityAreaSurvivalSignal {
  if (!isRecord(value)) return false
  return typeof value.citizenId === 'string' &&
    typeof value.name === 'string' &&
    typeof value.displayName === 'string' &&
    (value.kind === 'real' || value.kind === 'sim') &&
    typeof value.simulated === 'boolean' &&
    (value.participantLabel === 'Sim Citizen' || value.participantLabel === 'Real Citizen') &&
    (value.visualTone === 'simulated' || value.visualTone === 'real') &&
    isSurvivalRisk(value.risk) &&
    Array.isArray(value.warnings) &&
    value.warnings.every(isSurvivalWarning) &&
    Array.isArray(value.actions) &&
    value.actions.every(isRealityAreaSurvivalAction) &&
    (typeof value.hospitalizedUntil === 'string' || value.hospitalizedUntil === undefined)
}

function isRealityAreaSurvivalAction(value: unknown): value is RealityAreaSurvivalAction {
  return isRecord(value) &&
    isSurvivalWarning(value.warning) &&
    isSurvivalActionIntent(value.intent) &&
    isRealityAreaSurvivalPayload(value.clientPayload) &&
    isBusinessKind(value.serviceKind) &&
    value.serviceKind !== 'insurance' &&
    typeof value.available === 'boolean' &&
    (typeof value.lowestPrice === 'number' || value.lowestPrice === null) &&
    typeof value.canAfford === 'boolean' &&
    Array.isArray(value.blockers) &&
    value.blockers.every(isSurvivalActionBlocker)
}

function isRealityAreaSurvivalPayload(value: unknown): value is Extract<WorldClientIntentPayload, { type: WorldSurvivalActionIntent }> {
  return isRecord(value) && isSurvivalActionIntent(value.type)
}

function isRealityAreaNeeds(value: unknown): value is RealityAreaNeeds {
  return isRecord(value) &&
    typeof value.hunger === 'number' &&
    typeof value.hydration === 'number' &&
    typeof value.energy === 'number' &&
    typeof value.hygiene === 'number' &&
    typeof value.fun === 'number'
}

function isRealityAreaWorkerCandidateDashboard(value: unknown): value is RealityAreaWorkerCandidateDashboard {
  if (!isRecord(value)) return false
  return typeof value.citizenId === 'string' &&
    typeof value.name === 'string' &&
    typeof value.displayName === 'string' &&
    (value.kind === 'real' || value.kind === 'sim') &&
    typeof value.simulated === 'boolean' &&
    (value.participantLabel === 'Sim Citizen' || value.participantLabel === 'Real Citizen') &&
    (value.visualTone === 'simulated' || value.visualTone === 'real') &&
    isWorkerCandidateAction(value.action) &&
    (typeof value.recommendedBusinessId === 'string' || value.recommendedBusinessId === null) &&
    (typeof value.recommendedBusinessName === 'string' || value.recommendedBusinessName === null) &&
    (isBusinessKind(value.recommendedBusinessKind) || value.recommendedBusinessKind === null) &&
    (isRealityAreaHirePayload(value.clientPayload) || value.clientPayload === null)
}

function isRealityAreaFirstBuildRecommendation(value: unknown): value is RealityAreaFirstBuildRecommendation {
  if (!isRecord(value)) return false
  return isBusinessKind(value.kind) &&
    typeof value.name === 'string' &&
    (typeof value.proposedBusinessId === 'string' || value.proposedBusinessId === null) &&
    typeof value.buildCost === 'number' &&
    typeof value.currentDemand === 'number' &&
    typeof value.currentSupply === 'number' &&
    typeof value.licensesRemaining === 'number' &&
    typeof value.saturation === 'number' &&
    typeof value.founderCanAfford === 'boolean' &&
    typeof value.canBuildNow === 'boolean' &&
    (isRealityAreaBuildPayload(value.clientPayload) || value.clientPayload === null) &&
    typeof value.reason === 'string'
}

function isRealityAreaBuildPayload(value: unknown): value is Extract<WorldClientIntentPayload, { type: 'buildBusiness' }> {
  return isRecord(value) &&
    value.type === 'buildBusiness' &&
    isBusinessKind(value.businessKind) &&
    typeof value.businessId === 'string' &&
    (typeof value.name === 'string' || value.name === undefined)
}

function isRealityAreaHirePayload(value: unknown): value is Extract<WorldClientIntentPayload, { type: 'hireWorker' }> {
  return isRecord(value) &&
    value.type === 'hireWorker' &&
    typeof value.businessId === 'string' &&
    typeof value.workerCitizenId === 'string'
}

function isWorkerCandidateAction(value: unknown): value is AreaWorkerCandidateAction {
  return value === 'hire_now' ||
    value === 'requires_acceptance' ||
    value === 'waiting_for_position' ||
    value === 'founder_unavailable'
}

function isBusinessStatus(value: unknown): value is AreaBusinessStatus {
  return value === 'stable' || value === 'warning' || value === 'critical'
}

function isSurvivalRisk(value: unknown): value is WorldSurvivalRiskLevel {
  return value === 'stable' || value === 'warning' || value === 'danger' || value === 'hospitalized'
}

function isSurvivalWarning(value: unknown): value is WorldSurvivalWarningKind {
  return value === 'water' || value === 'food' || value === 'rest' || value === 'health'
}

function isSurvivalActionIntent(value: unknown): value is WorldSurvivalActionIntent {
  return value === 'buyWater' || value === 'buyFood' || value === 'buyHousing' || value === 'visitClinic'
}

function isSurvivalActionBlocker(value: unknown): value is WorldSurvivalActionBlocker {
  return value === 'service_unavailable' || value === 'insufficient_funds'
}

function isBusinessAlertKind(value: unknown): value is AreaBusinessAlert['kind'] {
  return value === 'understaffed' ||
    value === 'cash_risk' ||
    value === 'owner_unavailable' ||
    value === 'quality_degraded' ||
    value === 'negative_cash_flow'
}

function isBusinessKind(value: unknown): value is WorldBusinessKind {
  return BUSINESS_KINDS.includes(value as WorldBusinessKind)
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

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
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
