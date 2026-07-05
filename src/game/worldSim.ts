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
  | 'worker_wage'
  | 'hospital_bill'
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

export interface AreaNeedsDashboard {
  population: number
  simPopulation: number
  realPopulation: number
  demand: Record<WorldBusinessKind, number>
  supply: Record<WorldBusinessKind, number>
  licenseSlots: Record<WorldBusinessKind, number>
  saturation: Record<WorldBusinessKind, number>
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

export function advanceWorldArea(input: WorldArea, toMs: number): AdvanceWorldAreaResult {
  const area = cloneArea(input)
  const summary: WorldAreaSummary = {
    purchases: 0,
    wagesPaid: 0,
    hospitalizations: 0,
    debtsIssued: 0,
    revenueByBusiness: {},
  }
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
  for (const citizen of activeCitizens) {
    if (citizen.needs.hydration < 70) demand.water += 1
    if (citizen.needs.hunger < 70) demand.food += 1
    if (!citizen.homeBusinessId || citizen.needs.energy < 60) demand.housing += 1
    if (citizen.health < 80) demand.clinic += 1
    if (!citizen.insuranceBusinessId) demand.insurance += 1
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
    supply,
    licenseSlots,
    saturation,
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
  const activeStaff = business.staffCitizenIds
    .map((id) => area.citizens.find((c) => c.id === id))
    .filter((c): c is WorldCitizen => c?.state.kind === 'active').length
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

function advanceStep(area: WorldArea, context: StepContext): void {
  for (const citizen of area.citizens) {
    if (citizen.state.kind === 'hospitalized') {
      recoverIfReady(citizen, context.at)
    }
  }

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
  return true
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
  const activeStaff = business.staffCitizenIds
    .map((id) => area.citizens.find((c) => c.id === id))
    .filter((c): c is WorldCitizen => c?.state.kind === 'active').length
  const staffMultiplier = activeStaff === 0 ? 1 : 1 + activeStaff * 0.75
  const quality = effectiveBusinessQuality(business, area)
  return Math.floor(BASE_CAPACITY_PER_HOUR[business.kind] * hours * staffMultiplier * quality)
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

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}
