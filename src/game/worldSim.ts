import { clamp } from './engine'
import type { Needs } from './types'

export type WorldBusinessKind = 'water' | 'food' | 'housing' | 'clinic' | 'insurance'
export type WorldCitizenKind = 'sim' | 'real'
export type AreaClaimSource = 'manual' | 'ip' | 'geolocation' | 'telegram'

export type WorldCitizenState =
  | { kind: 'active' }
  | { kind: 'hospitalized'; until: number }

export interface WorldCitizen {
  id: string
  name: string
  kind: WorldCitizenKind
  money: number
  debt: number
  needs: Needs
  health: number
  state: WorldCitizenState
  homeBusinessId?: string
  jobBusinessId?: string
  insuranceBusinessId?: string
}

export interface WorldBusiness {
  id: string
  name: string
  kind: WorldBusinessKind
  ownerId: string
  cash: number
  staffCitizenIds: string[]
  price?: number
  wagePerHour?: number
  quality?: number
  createdBy?: string
  inheritedFrom?: string
}

export interface WorldAreaClaim {
  founderCitizenId: string
  label: string
  centerLat: number
  centerLng: number
  radiusKm: number
  claimedAt: number
  source: AreaClaimSource
}

export type WorldTransactionKind =
  | 'customer_purchase'
  | 'business_build'
  | 'worker_wage'
  | 'hospital_bill'
  | 'insurance_premium'
  | 'insurance_payout'
  | 'medical_debt'

export interface WorldTransaction {
  id: string
  at: number
  kind: WorldTransactionKind
  fromId: string
  toId: string
  amount: number
  memo: string
}

export interface WorldArea {
  id: string
  name: string
  now: number
  claim?: WorldAreaClaim
  citizens: WorldCitizen[]
  businesses: WorldBusiness[]
  transactions: WorldTransaction[]
}

export interface WorldAreaSummary {
  purchases: number
  wagesPaid: number
  hospitalizations: number
  debtsIssued: number
  revenueByBusiness: Record<string, number>
}

export interface AdvanceWorldAreaResult {
  area: WorldArea
  summary: WorldAreaSummary
}

export type FirstBuildPriority = 'critical' | 'high' | 'medium' | 'low'

export interface FirstBuildRecommendation {
  kind: WorldBusinessKind
  priority: FirstBuildPriority
  score: number
  licensed: boolean
  saturated: boolean
  reason: string
}

export interface AreaJobsDashboard {
  employedCitizens: number
  unemployedCitizens: number
  openPositions: number
  understaffedBusinesses: number
}

export interface AreaNeedsDashboard {
  population: number
  simPopulation: number
  realPopulation: number
  demand: Record<WorldBusinessKind, number>
  simDemand: Record<WorldBusinessKind, number>
  realDemand: Record<WorldBusinessKind, number>
  supply: Record<WorldBusinessKind, number>
  licenseSlots: Record<WorldBusinessKind, number>
  saturation: Record<WorldBusinessKind, number>
  jobs: AreaJobsDashboard
  firstBuild: FirstBuildRecommendation[]
}

export type ClaimWorldAreaError =
  | 'area_already_claimed'
  | 'founder_not_found'
  | 'invalid_location'
  | 'area_too_small'
  | 'area_too_large'

export type ClaimWorldAreaResult =
  | { ok: true; area: WorldArea }
  | { ok: false; area: WorldArea; error: ClaimWorldAreaError }

export interface WorldBusinessBlueprint {
  kind: WorldBusinessKind
  name: string
  buildCost: number
  price?: number
  wagePerHour?: number
  quality?: number
}

export type WorldIntent =
  | {
    type: 'buildBusiness'
    actorCitizenId: string
    businessId: string
    blueprint: WorldBusinessBlueprint
  }
  | {
    type: 'buyWater'
    actorCitizenId: string
  }
  | {
    type: 'buyFood'
    actorCitizenId: string
  }
  | {
    type: 'hireWorker'
    actorCitizenId: string
    businessId: string
    workerCitizenId: string
  }
  | {
    type: 'buyInsurance'
    actorCitizenId: string
    insuranceBusinessId: string
  }

export type WorldIntentError =
  | 'area_not_claimed'
  | 'actor_not_found'
  | 'actor_not_area_founder'
  | 'actor_not_business_owner'
  | 'actor_unavailable'
  | 'business_id_taken'
  | 'business_not_found'
  | 'business_saturated'
  | 'already_insured'
  | 'insufficient_funds'
  | 'invalid_business'
  | 'not_insurance_business'
  | 'service_not_available'
  | 'worker_not_found'
  | 'worker_unavailable'
  | 'worker_already_hired'

export type ApplyWorldIntentResult =
  | { ok: true; area: WorldArea }
  | { ok: false; area: WorldArea; error: WorldIntentError }

type RequireAreaFounderResult =
  | { ok: true; actor: WorldCitizen }
  | { ok: false; area: WorldArea; error: WorldIntentError }

interface StepContext {
  at: number
  hours: number
  servedByKind: Record<WorldBusinessKind, number>
  capacityUsed: Record<string, number>
  summary: WorldAreaSummary
}

interface ServiceEffect extends Partial<Needs> {
  health?: number
}

export const WORLD_SIM_HOUR_MS = 3_600_000
export const HOSPITALIZATION_HOURS = 8
export const COLLAPSE_HEALTH = 20
export const HOSPITAL_BILL = 350
export const INSURANCE_COVERAGE = 0.6
export const DEFAULT_WORKER_WAGE = 12
export const MIN_FOUNDER_AREA_RADIUS_KM = 0.25
export const MAX_FOUNDER_AREA_RADIUS_KM = 5
export const MIN_BUSINESS_QUALITY = 0.35
export const UNSTAFFED_HOSPITALIZED_OWNER_QUALITY_LOSS_PER_HOUR = 0.04

const ACTIVE_NEED_RATES: Needs = {
  hunger: 3.8,
  hydration: 4.8,
  energy: 3.0,
  hygiene: 1.1,
  fun: 0.8,
}

const WORKING_NEED_RATES: Needs = {
  hunger: 5.4,
  hydration: 6.2,
  energy: 5.8,
  hygiene: 2.0,
  fun: 1.3,
}

const DEFAULT_PRICES: Record<WorldBusinessKind, number> = {
  water: 2,
  food: 14,
  housing: 28,
  clinic: 90,
  insurance: 45,
}

export const DEFAULT_BUSINESS_BLUEPRINTS: Record<WorldBusinessKind, WorldBusinessBlueprint> = {
  water: { kind: 'water', name: 'Water Point', buildCost: 8_000, price: DEFAULT_PRICES.water, wagePerHour: 14 },
  food: { kind: 'food', name: 'Food Shop', buildCost: 12_000, price: DEFAULT_PRICES.food, wagePerHour: 15 },
  housing: { kind: 'housing', name: 'Basic Housing', buildCost: 25_000, price: DEFAULT_PRICES.housing, wagePerHour: 16 },
  clinic: { kind: 'clinic', name: 'Clinic', buildCost: 75_000, price: DEFAULT_PRICES.clinic, wagePerHour: 24 },
  insurance: { kind: 'insurance', name: 'Insurance Office', buildCost: 60_000, price: DEFAULT_PRICES.insurance, wagePerHour: 20 },
}

const SERVICE_EFFECTS: Record<WorldBusinessKind, ServiceEffect> = {
  water: { hydration: 35 },
  food: { hunger: 32, fun: 3 },
  housing: { energy: 32, hygiene: 8 },
  clinic: { health: 25 },
  insurance: {},
}

const BASE_CAPACITY_PER_HOUR: Record<WorldBusinessKind, number> = {
  water: 24,
  food: 14,
  housing: 8,
  clinic: 6,
  insurance: 8,
}

const TARGET_STAFF_BY_KIND: Record<WorldBusinessKind, number> = {
  water: 1,
  food: 2,
  housing: 1,
  clinic: 3,
  insurance: 1,
}

const LICENSE_POPULATION_STEP: Record<WorldBusinessKind, number> = {
  water: 35,
  food: 30,
  housing: 22,
  clinic: 80,
  insurance: 90,
}

const MIN_LICENSES: Record<WorldBusinessKind, number> = {
  water: 1,
  food: 1,
  housing: 1,
  clinic: 0,
  insurance: 0,
}

const BUSINESS_KINDS: WorldBusinessKind[] = ['water', 'food', 'housing', 'clinic', 'insurance']

export function claimWorldArea(input: WorldArea, claim: WorldAreaClaim): ClaimWorldAreaResult {
  const area = cloneArea(input)
  if (area.claim) return { ok: false, area, error: 'area_already_claimed' }
  if (!area.citizens.some((c) => c.id === claim.founderCitizenId && c.kind === 'real')) {
    return { ok: false, area, error: 'founder_not_found' }
  }
  if (
    !Number.isFinite(claim.centerLat) ||
    !Number.isFinite(claim.centerLng) ||
    claim.centerLat < -90 ||
    claim.centerLat > 90 ||
    claim.centerLng < -180 ||
    claim.centerLng > 180
  ) {
    return { ok: false, area, error: 'invalid_location' }
  }
  if (claim.radiusKm < MIN_FOUNDER_AREA_RADIUS_KM) return { ok: false, area, error: 'area_too_small' }
  if (claim.radiusKm > MAX_FOUNDER_AREA_RADIUS_KM) return { ok: false, area, error: 'area_too_large' }

  area.claim = { ...claim, label: claim.label.trim() }
  return { ok: true, area }
}

export function applyWorldIntent(input: WorldArea, intent: WorldIntent): ApplyWorldIntentResult {
  const area = cloneArea(input)
  switch (intent.type) {
    case 'buildBusiness':
      return buildBusinessFromIntent(area, intent)
    case 'buyWater':
      return buyServiceFromIntent(area, intent, 'water')
    case 'buyFood':
      return buyServiceFromIntent(area, intent, 'food')
    case 'hireWorker':
      return hireWorkerFromIntent(area, intent)
    case 'buyInsurance':
      return buyInsuranceFromIntent(area, intent)
  }
}

export function advanceWorldArea(input: WorldArea, toMs: number): AdvanceWorldAreaResult {
  const area = cloneArea(input)
  const summary = emptyWorldAreaSummary()
  if (toMs <= area.now) return { area, summary }

  let t = area.now
  while (t < toMs) {
    const next = Math.min(toMs, t + WORLD_SIM_HOUR_MS)
    const context: StepContext = {
      at: next,
      hours: (next - t) / WORLD_SIM_HOUR_MS,
      servedByKind: zeroKindRecord(),
      capacityUsed: {},
      summary,
    }
    advanceStep(area, context)
    area.now = next
    t = next
  }

  return { area, summary }
}

export function areaNeedsDashboard(area: WorldArea): AreaNeedsDashboard {
  const activeCitizens = area.citizens.filter((c) => c.state.kind === 'active')
  const supply = zeroKindRecord()
  for (const business of area.businesses) supply[business.kind] += 1

  const demand = zeroKindRecord()
  const simDemand = zeroKindRecord()
  const realDemand = zeroKindRecord()
  for (const citizen of activeCitizens) {
    addCitizenDemand(citizen, citizen.kind === 'sim' ? simDemand : realDemand)
  }
  for (const kind of BUSINESS_KINDS) {
    demand[kind] = simDemand[kind] + realDemand[kind]
  }

  const licenseSlots = zeroKindRecord()
  const saturation = zeroKindRecord()
  for (const kind of BUSINESS_KINDS) {
    licenseSlots[kind] = licenseSlotsForPopulation(activeCitizens.length, kind)
    saturation[kind] = supply[kind] / Math.max(1, licenseSlots[kind])
  }

  return {
    population: area.citizens.length,
    simPopulation: area.citizens.filter((c) => c.kind === 'sim').length,
    realPopulation: area.citizens.filter((c) => c.kind === 'real').length,
    demand,
    simDemand,
    realDemand,
    supply,
    licenseSlots,
    saturation,
    jobs: jobsDashboard(area, activeCitizens),
    firstBuild: firstBuildGuidance({ demand, supply, licenseSlots, saturation }),
  }
}

export function firstBuildGuidance(input: Pick<AreaNeedsDashboard, 'demand' | 'supply' | 'licenseSlots' | 'saturation'>): FirstBuildRecommendation[] {
  return BUSINESS_KINDS
    .map((kind) => buildRecommendation(kind, input))
    .sort((a, b) => b.score - a.score || BUSINESS_KINDS.indexOf(a.kind) - BUSINESS_KINDS.indexOf(b.kind))
}

export function licenseSlotsForPopulation(population: number, kind: WorldBusinessKind): number {
  return Math.max(MIN_LICENSES[kind], Math.floor(population / LICENSE_POPULATION_STEP[kind]))
}

export function effectiveBusinessQuality(business: WorldBusiness, area: WorldArea): number {
  const owner = area.citizens.find((c) => c.id === business.ownerId)
  const activeStaff = activeStaffCount(area, business)
  const ownerUnavailable = owner?.state.kind === 'hospitalized'
  const unmanagedPenalty = ownerUnavailable && activeStaff === 0 ? 0.35 : 1
  return clamp((business.quality ?? 1) * unmanagedPenalty, 0.15, 1.5)
}

function buildRecommendation(
  kind: WorldBusinessKind,
  input: Pick<AreaNeedsDashboard, 'demand' | 'supply' | 'licenseSlots' | 'saturation'>,
): FirstBuildRecommendation {
  const demand = input.demand[kind]
  const supply = input.supply[kind]
  const licensed = supply < input.licenseSlots[kind]
  const saturated = input.saturation[kind] >= 1
  const essential = kind === 'water' || kind === 'food' || kind === 'housing'
  let score = demand * 10
  if (essential && supply === 0) score += 30
  if (licensed) score += 12
  if (saturated) score -= 30

  const priority = priorityOf({ demand, supply, essential, licensed, saturated })
  return {
    kind,
    priority,
    score,
    licensed,
    saturated,
    reason: recommendationReason(kind, { demand, supply, licensed, saturated }),
  }
}

function addCitizenDemand(citizen: WorldCitizen, demand: Record<WorldBusinessKind, number>): void {
  if (citizen.needs.hydration < 70) demand.water += 1
  if (citizen.needs.hunger < 70) demand.food += 1
  if (!citizen.homeBusinessId || citizen.needs.energy < 60) demand.housing += 1
  if (citizen.health < 80) demand.clinic += 1
  if (!citizen.insuranceBusinessId) demand.insurance += 1
}

function jobsDashboard(area: WorldArea, activeCitizens: WorldCitizen[]): AreaJobsDashboard {
  let openPositions = 0
  let understaffedBusinesses = 0
  for (const business of area.businesses) {
    const targetStaff = TARGET_STAFF_BY_KIND[business.kind]
    const openForBusiness = Math.max(0, targetStaff - activeStaffCount(area, business))
    openPositions += openForBusiness
    if (openForBusiness > 0) understaffedBusinesses += 1
  }

  const employedCitizens = activeCitizens.filter((citizen) => citizen.jobBusinessId).length
  return {
    employedCitizens,
    unemployedCitizens: activeCitizens.length - employedCitizens,
    openPositions,
    understaffedBusinesses,
  }
}

function priorityOf(input: { demand: number; supply: number; essential: boolean; licensed: boolean; saturated: boolean }): FirstBuildPriority {
  if (input.essential && input.supply === 0 && input.demand > 0 && input.licensed) return 'critical'
  if (input.demand >= 3 && input.licensed && !input.saturated) return 'high'
  if (input.demand > 0 && input.licensed && !input.saturated) return 'medium'
  return 'low'
}

function recommendationReason(
  kind: WorldBusinessKind,
  input: { demand: number; supply: number; licensed: boolean; saturated: boolean },
): string {
  if (!input.licensed) return `${kind} is saturated for the current population. Grow demand before adding another.`
  if (input.supply === 0 && input.demand > 0) return `No ${kind} service exists yet, and ${input.demand} citizens need it.`
  if (input.demand > 0) return `${input.demand} citizens currently need more ${kind} capacity.`
  if (input.saturated) return `${kind} supply is already at the current license limit.`
  return `${kind} is available, but demand is not urgent yet.`
}

function buildBusinessFromIntent(
  area: WorldArea,
  intent: Extract<WorldIntent, { type: 'buildBusiness' }>,
): ApplyWorldIntentResult {
  const actorCheck = requireAreaFounder(area, intent.actorCitizenId)
  if (!actorCheck.ok) return actorCheck
  const { actor } = actorCheck
  const blueprint = normalizeBlueprint(intent.blueprint)
  if (!blueprint || !intent.businessId.trim()) return { ok: false, area, error: 'invalid_business' }
  if (area.businesses.some((business) => business.id === intent.businessId)) {
    return { ok: false, area, error: 'business_id_taken' }
  }

  const dashboard = areaNeedsDashboard(area)
  if (dashboard.supply[blueprint.kind] >= dashboard.licenseSlots[blueprint.kind]) {
    return { ok: false, area, error: 'business_saturated' }
  }
  if (actor.money < blueprint.buildCost) return { ok: false, area, error: 'insufficient_funds' }

  actor.money = roundMoney(actor.money - blueprint.buildCost)
  area.businesses.push({
    id: intent.businessId.trim(),
    name: blueprint.name,
    kind: blueprint.kind,
    ownerId: actor.id,
    cash: 0,
    staffCitizenIds: [],
    price: blueprint.price,
    wagePerHour: blueprint.wagePerHour,
    quality: blueprint.quality,
    createdBy: actor.id,
  })
  recordTransaction(area, area.now, {
    kind: 'business_build',
    fromId: actor.id,
    toId: 'system:builders',
    amount: blueprint.buildCost,
    memo: `${actor.name} built ${blueprint.name} in ${area.name}.`,
  })
  return { ok: true, area }
}

function hireWorkerFromIntent(
  area: WorldArea,
  intent: Extract<WorldIntent, { type: 'hireWorker' }>,
): ApplyWorldIntentResult {
  const actor = area.citizens.find((citizen) => citizen.id === intent.actorCitizenId)
  if (!actor) return { ok: false, area, error: 'actor_not_found' }
  if (actor.state.kind !== 'active') return { ok: false, area, error: 'actor_unavailable' }

  const business = area.businesses.find((candidate) => candidate.id === intent.businessId)
  if (!business) return { ok: false, area, error: 'business_not_found' }
  if (business.ownerId !== actor.id) return { ok: false, area, error: 'actor_not_business_owner' }
  if (business.staffCitizenIds.includes(intent.workerCitizenId)) {
    return { ok: false, area, error: 'worker_already_hired' }
  }

  const worker = area.citizens.find((citizen) => citizen.id === intent.workerCitizenId)
  if (!worker) return { ok: false, area, error: 'worker_not_found' }
  if (worker.state.kind !== 'active' || (worker.jobBusinessId && worker.jobBusinessId !== business.id)) {
    return { ok: false, area, error: 'worker_unavailable' }
  }

  worker.jobBusinessId = business.id
  business.staffCitizenIds.push(worker.id)
  return { ok: true, area }
}

function buyInsuranceFromIntent(
  area: WorldArea,
  intent: Extract<WorldIntent, { type: 'buyInsurance' }>,
): ApplyWorldIntentResult {
  const actor = area.citizens.find((citizen) => citizen.id === intent.actorCitizenId)
  if (!actor) return { ok: false, area, error: 'actor_not_found' }
  if (actor.state.kind !== 'active') return { ok: false, area, error: 'actor_unavailable' }
  if (actor.insuranceBusinessId) return { ok: false, area, error: 'already_insured' }

  const insurer = area.businesses.find((business) => business.id === intent.insuranceBusinessId)
  if (!insurer) return { ok: false, area, error: 'business_not_found' }
  if (insurer.kind !== 'insurance') return { ok: false, area, error: 'not_insurance_business' }

  const premium = insurer.price ?? DEFAULT_PRICES.insurance
  if (actor.money < premium) return { ok: false, area, error: 'insufficient_funds' }

  actor.money = roundMoney(actor.money - premium)
  actor.insuranceBusinessId = insurer.id
  insurer.cash = roundMoney(insurer.cash + premium)
  recordTransaction(area, area.now, {
    kind: 'insurance_premium',
    fromId: actor.id,
    toId: insurer.id,
    amount: premium,
    memo: `${actor.name} bought insurance from ${insurer.name}.`,
  })
  return { ok: true, area }
}

function buyServiceFromIntent(
  area: WorldArea,
  intent: Extract<WorldIntent, { type: 'buyWater' | 'buyFood' }>,
  kind: 'water' | 'food',
): ApplyWorldIntentResult {
  const actor = area.citizens.find((citizen) => citizen.id === intent.actorCitizenId)
  if (!actor) return { ok: false, area, error: 'actor_not_found' }
  if (actor.state.kind !== 'active') return { ok: false, area, error: 'actor_unavailable' }

  const context: StepContext = {
    at: area.now,
    hours: 1,
    servedByKind: zeroKindRecord(),
    capacityUsed: {},
    summary: emptyWorldAreaSummary(),
  }
  const business = chooseBusiness(area, kind, context)
  if (!business) return { ok: false, area, error: 'service_not_available' }

  const price = business.price ?? DEFAULT_PRICES[kind]
  if (actor.money < price) return { ok: false, area, error: 'insufficient_funds' }

  completeServicePurchase(area, actor, business, kind, context)
  return { ok: true, area }
}

function requireAreaFounder(area: WorldArea, actorCitizenId: string): RequireAreaFounderResult {
  if (!area.claim) return { ok: false, area, error: 'area_not_claimed' }
  const actor = area.citizens.find((citizen) => citizen.id === actorCitizenId)
  if (!actor) return { ok: false, area, error: 'actor_not_found' }
  if (actor.state.kind !== 'active') return { ok: false, area, error: 'actor_unavailable' }
  if (actor.id !== area.claim.founderCitizenId) return { ok: false, area, error: 'actor_not_area_founder' }
  return { ok: true, actor }
}

function normalizeBlueprint(blueprint: WorldBusinessBlueprint): WorldBusinessBlueprint | null {
  if (!BUSINESS_KINDS.includes(blueprint.kind)) return null
  if (!blueprint.name.trim()) return null
  if (!Number.isFinite(blueprint.buildCost) || blueprint.buildCost <= 0) return null
  if (blueprint.price !== undefined && (!Number.isFinite(blueprint.price) || blueprint.price <= 0)) return null
  if (blueprint.wagePerHour !== undefined && (!Number.isFinite(blueprint.wagePerHour) || blueprint.wagePerHour <= 0)) return null
  if (blueprint.quality !== undefined && (!Number.isFinite(blueprint.quality) || blueprint.quality <= 0)) return null
  return {
    ...blueprint,
    name: blueprint.name.trim(),
    buildCost: roundMoney(blueprint.buildCost),
    price: blueprint.price !== undefined ? roundMoney(blueprint.price) : undefined,
    wagePerHour: blueprint.wagePerHour !== undefined ? roundMoney(blueprint.wagePerHour) : undefined,
    quality: blueprint.quality !== undefined ? roundMoney(blueprint.quality) : undefined,
  }
}

function advanceStep(area: WorldArea, context: StepContext): void {
  for (const citizen of area.citizens) {
    if (citizen.state.kind === 'hospitalized') {
      recoverIfReady(citizen, context.at)
    }
  }

  degradeUnmanagedBusinesses(area, context.hours)
  payWorkerWages(area, context)

  for (const citizen of area.citizens) {
    if (citizen.state.kind !== 'active') continue
    decayCitizen(citizen, context.hours)
    buyNeededServices(area, citizen, context)
    if (shouldHospitalize(citizen)) hospitalize(area, citizen, context)
  }
}

function recoverIfReady(citizen: WorldCitizen, at: number): void {
  if (citizen.state.kind !== 'hospitalized' || citizen.state.until > at) return
  citizen.state = { kind: 'active' }
  citizen.health = Math.max(citizen.health, 55)
  citizen.needs = {
    ...citizen.needs,
    hunger: Math.max(citizen.needs.hunger, 45),
    hydration: Math.max(citizen.needs.hydration, 45),
    energy: Math.max(citizen.needs.energy, 35),
  }
}

function degradeUnmanagedBusinesses(area: WorldArea, hours: number): void {
  if (hours <= 0) return
  const loss = UNSTAFFED_HOSPITALIZED_OWNER_QUALITY_LOSS_PER_HOUR * hours
  for (const business of area.businesses) {
    const owner = area.citizens.find((citizen) => citizen.id === business.ownerId)
    if (owner?.state.kind !== 'hospitalized' || activeStaffCount(area, business) > 0) continue
    business.quality = roundMoney(Math.max(MIN_BUSINESS_QUALITY, (business.quality ?? 1) - loss))
  }
}

function payWorkerWages(area: WorldArea, context: StepContext): void {
  for (const business of area.businesses) {
    const wage = business.wagePerHour ?? DEFAULT_WORKER_WAGE
    const due = roundMoney(wage * context.hours)
    if (due <= 0) continue
    for (const workerId of business.staffCitizenIds) {
      const worker = area.citizens.find((c) => c.id === workerId)
      if (!worker || worker.state.kind !== 'active') continue
      const paid = Math.min(due, business.cash)
      if (paid <= 0) continue
      business.cash = roundMoney(business.cash - paid)
      worker.money = roundMoney(worker.money + paid)
      context.summary.wagesPaid = roundMoney(context.summary.wagesPaid + paid)
      recordTransaction(area, context.at, {
        kind: 'worker_wage',
        fromId: business.id,
        toId: worker.id,
        amount: paid,
        memo: `${business.name} paid ${worker.name} for ${context.hours.toFixed(2)}h of work.`,
      })
    }
  }
}

function decayCitizen(citizen: WorldCitizen, hours: number): void {
  const rates = citizen.jobBusinessId ? WORKING_NEED_RATES : ACTIVE_NEED_RATES
  citizen.needs = {
    hunger: clamp(citizen.needs.hunger - rates.hunger * hours),
    hydration: clamp(citizen.needs.hydration - rates.hydration * hours),
    energy: clamp(citizen.needs.energy - rates.energy * hours),
    hygiene: clamp(citizen.needs.hygiene - rates.hygiene * hours),
    fun: clamp(citizen.needs.fun - rates.fun * hours),
  }

  if (citizen.needs.hydration <= 0) citizen.health = clamp(citizen.health - 8 * hours)
  else if (citizen.needs.hunger <= 0) citizen.health = clamp(citizen.health - 4 * hours)
  else if (citizen.needs.energy <= 0) citizen.health = clamp(citizen.health - 2 * hours)
  else if (citizen.needs.hydration > 65 && citizen.needs.hunger > 65 && citizen.needs.energy > 55) {
    citizen.health = clamp(citizen.health + 1.2 * hours)
  }
}

function buyNeededServices(area: WorldArea, citizen: WorldCitizen, context: StepContext): void {
  if (citizen.needs.hydration <= 50) purchaseService(area, citizen, 'water', context)
  if (citizen.needs.hunger <= 50) purchaseService(area, citizen, 'food', context)
  if (citizen.needs.energy <= 35) purchaseService(area, citizen, 'housing', context)
  if (citizen.health <= 65) purchaseService(area, citizen, 'clinic', context)
}

function purchaseService(
  area: WorldArea,
  citizen: WorldCitizen,
  kind: WorldBusinessKind,
  context: StepContext,
): boolean {
  const business = chooseBusiness(area, kind, context)
  if (!business) return false
  const price = business.price ?? DEFAULT_PRICES[kind]
  if (citizen.money < price) return false

  completeServicePurchase(area, citizen, business, kind, context)
  return true
}

function completeServicePurchase(
  area: WorldArea,
  citizen: WorldCitizen,
  business: WorldBusiness,
  kind: WorldBusinessKind,
  context: StepContext,
): void {
  const price = business.price ?? DEFAULT_PRICES[kind]
  citizen.money = roundMoney(citizen.money - price)
  business.cash = roundMoney(business.cash + price)
  context.summary.purchases += 1
  context.summary.revenueByBusiness[business.id] = roundMoney((context.summary.revenueByBusiness[business.id] ?? 0) + price)
  recordTransaction(area, context.at, {
    kind: 'customer_purchase',
    fromId: citizen.id,
    toId: business.id,
    amount: price,
    memo: `${citizen.name} bought ${kind} from ${business.name}.`,
  })

  applyServiceEffect(citizen, SERVICE_EFFECTS[kind], effectiveBusinessQuality(business, area))
  if (kind === 'housing') citizen.homeBusinessId = business.id
}

function chooseBusiness(area: WorldArea, kind: WorldBusinessKind, context: StepContext): WorldBusiness | null {
  const candidates = area.businesses
    .filter((business) => business.kind === kind && serviceCapacity(area, business, context.hours) > 0)
    .sort((a, b) => a.id.localeCompare(b.id))
  if (candidates.length === 0) return null

  const start = context.servedByKind[kind] % candidates.length
  for (let offset = 0; offset < candidates.length; offset++) {
    const business = candidates[(start + offset) % candidates.length]
    const capacity = serviceCapacity(area, business, context.hours)
    const used = context.capacityUsed[business.id] ?? 0
    if (used < capacity) {
      context.capacityUsed[business.id] = used + 1
      context.servedByKind[kind] += 1
      return business
    }
  }
  return null
}

function serviceCapacity(area: WorldArea, business: WorldBusiness, hours: number): number {
  const activeStaff = activeStaffCount(area, business)
  const staffMultiplier = activeStaff === 0 ? 1 : 1 + activeStaff * 0.75
  const quality = effectiveBusinessQuality(business, area)
  return Math.floor(BASE_CAPACITY_PER_HOUR[business.kind] * hours * staffMultiplier * quality)
}

function activeStaffCount(area: WorldArea, business: WorldBusiness): number {
  return business.staffCitizenIds
    .map((id) => area.citizens.find((c) => c.id === id))
    .filter((c): c is WorldCitizen => c?.state.kind === 'active').length
}

function applyServiceEffect(citizen: WorldCitizen, effect: ServiceEffect, quality: number): void {
  const nextNeeds = { ...citizen.needs }
  for (const key of Object.keys(nextNeeds) as (keyof Needs)[]) {
    const boost = effect[key]
    if (boost !== undefined) nextNeeds[key] = clamp(nextNeeds[key] + boost * quality)
  }
  citizen.needs = nextNeeds
  if (effect.health !== undefined) citizen.health = clamp(citizen.health + effect.health * quality)
}

function shouldHospitalize(citizen: WorldCitizen): boolean {
  return citizen.health <= COLLAPSE_HEALTH || (citizen.needs.hydration <= 0 && citizen.money < DEFAULT_PRICES.water)
}

function hospitalize(area: WorldArea, citizen: WorldCitizen, context: StepContext): void {
  citizen.state = { kind: 'hospitalized', until: context.at + HOSPITALIZATION_HOURS * WORLD_SIM_HOUR_MS }
  citizen.health = Math.max(citizen.health, 30)
  context.summary.hospitalizations += 1
  settleHospitalBill(area, citizen, context)
}

function settleHospitalBill(area: WorldArea, citizen: WorldCitizen, context: StepContext): void {
  const clinic = area.businesses.find((business) => business.kind === 'clinic')
  const receiverId = clinic?.id ?? 'system:hospital'
  let remaining = HOSPITAL_BILL

  const insurer = citizen.insuranceBusinessId
    ? area.businesses.find((business) => business.id === citizen.insuranceBusinessId && business.kind === 'insurance')
    : undefined
  if (insurer) {
    const coverage = Math.min(roundMoney(HOSPITAL_BILL * INSURANCE_COVERAGE), insurer.cash)
    if (coverage > 0) {
      insurer.cash = roundMoney(insurer.cash - coverage)
      if (clinic) clinic.cash = roundMoney(clinic.cash + coverage)
      remaining = roundMoney(remaining - coverage)
      recordTransaction(area, context.at, {
        kind: 'insurance_payout',
        fromId: insurer.id,
        toId: receiverId,
        amount: coverage,
        memo: `${insurer.name} covered part of ${citizen.name}'s hospital bill.`,
      })
    }
  }

  const citizenPaid = Math.min(remaining, citizen.money)
  if (citizenPaid > 0) {
    citizen.money = roundMoney(citizen.money - citizenPaid)
    if (clinic) clinic.cash = roundMoney(clinic.cash + citizenPaid)
    remaining = roundMoney(remaining - citizenPaid)
    recordTransaction(area, context.at, {
      kind: 'hospital_bill',
      fromId: citizen.id,
      toId: receiverId,
      amount: citizenPaid,
      memo: `${citizen.name} paid a hospital bill.`,
    })
  }

  if (remaining > 0) {
    citizen.debt = roundMoney(citizen.debt + remaining)
    context.summary.debtsIssued = roundMoney(context.summary.debtsIssued + remaining)
    recordTransaction(area, context.at, {
      kind: 'medical_debt',
      fromId: citizen.id,
      toId: receiverId,
      amount: remaining,
      memo: `${citizen.name} left the hospital bill as medical debt.`,
    })
  }
}

function recordTransaction(
  area: WorldArea,
  at: number,
  tx: Omit<WorldTransaction, 'id' | 'at'>,
): void {
  area.transactions.push({
    id: `${area.id}:${at}:${area.transactions.length + 1}:${tx.kind}`,
    at,
    ...tx,
    amount: roundMoney(tx.amount),
  })
}

function cloneArea(area: WorldArea): WorldArea {
  return {
    ...area,
    claim: area.claim ? { ...area.claim } : undefined,
    citizens: area.citizens.map(cloneCitizen),
    businesses: area.businesses.map((business) => ({
      ...business,
      staffCitizenIds: [...business.staffCitizenIds],
    })),
    transactions: area.transactions.map((tx) => ({ ...tx })),
  }
}

function cloneCitizen(citizen: WorldCitizen): WorldCitizen {
  return {
    ...citizen,
    needs: { ...citizen.needs },
    state: citizen.state.kind === 'hospitalized'
      ? { kind: 'hospitalized', until: citizen.state.until }
      : { kind: 'active' },
  }
}

function zeroKindRecord(): Record<WorldBusinessKind, number> {
  return { water: 0, food: 0, housing: 0, clinic: 0, insurance: 0 }
}

function emptyWorldAreaSummary(): WorldAreaSummary {
  return {
    purchases: 0,
    wagesPaid: 0,
    hospitalizations: 0,
    debtsIssued: 0,
    revenueByBusiness: {},
  }
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}
