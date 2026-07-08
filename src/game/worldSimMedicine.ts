import { itemById } from './catalog'
import type { Illness, Needs, ShopItem } from './types'
import type { WorldCitizenKind, WorldCitizenState } from './worldSim'

export type WorldSimMedicineBlocker =
  | 'medicine_execution_disabled'
  | 'server_authority_required'
  | 'sim_citizen_required'
  | 'active_citizen_required'
  | 'active_illness_required'
  | 'matching_medicine_required'
  | 'provider_required'
  | 'funds_required'

export interface WorldSimMedicinePolicyInput {
  citizenId?: string | null
  citizenKind?: WorldCitizenKind | null
  citizenState?: WorldCitizenState | null
  activeIllness?: Illness | null
  citizenMoney?: number | null
  providerBusinessId?: string | null
  requestedItemId?: string | null
  serverAuthorityReady?: boolean
}

export interface WorldSimMedicineOption {
  itemId: 'coldmeds' | 'flumeds'
  itemName: string
  cures: Illness['kind']
  price: number
  hours: number
  effects: Partial<Needs>
}

export interface WorldSimMedicineDraft {
  kind: 'world_sim_medicine_purchase'
  executionEnabled: false
  payerCitizenId: string
  receiverBusinessId: string
  itemId: WorldSimMedicineOption['itemId']
  itemName: string
  illnessKind: Illness['kind']
  amount: number
  currency: 'game_credits'
  hours: number
  effects: Partial<Needs>
  clearsIllness: true
  blockers: readonly WorldSimMedicineBlocker[]
}

export interface WorldSimMedicinePolicyAssessment {
  enabled: false
  medicineExecutionEnabled: false
  sourceOfTruth: 'reality_server_ledger'
  citizenId: string
  citizenKind: WorldCitizenKind | null
  simulated: boolean
  active: boolean
  activeIllness: Illness | null
  citizenMoney: number
  providerBusinessId: string | null
  requestedItemId: string | null
  medicineOptions: readonly WorldSimMedicineOption[]
  selectedMedicine: WorldSimMedicineOption | null
  readyForServerPurchase: boolean
  purchaseDraft: WorldSimMedicineDraft | null
  blockers: readonly WorldSimMedicineBlocker[]
}

const BASE_DISABLED_BLOCKERS: readonly WorldSimMedicineBlocker[] = ['medicine_execution_disabled']

export function assessWorldSimMedicinePolicy(
  input: WorldSimMedicinePolicyInput = {},
): WorldSimMedicinePolicyAssessment {
  const citizenId = input.citizenId?.trim() ?? ''
  const citizenKind = input.citizenKind ?? null
  const active = input.citizenState?.kind === 'active'
  const activeIllness = normalizeIllness(input.activeIllness)
  const citizenMoney = normalizeMoney(input.citizenMoney)
  const providerBusinessId = input.providerBusinessId?.trim() || null
  const requestedItemId = input.requestedItemId?.trim() || null
  const medicineOptions = worldSimMedicineOptions()
  const selectedMedicine = selectMedicine(medicineOptions, activeIllness, requestedItemId)
  const readinessBlockers = medicineReadinessBlockers({
    citizenId,
    citizenKind,
    active,
    activeIllness,
    selectedMedicine,
    requestedItemId,
    citizenMoney,
    providerBusinessId,
    serverAuthorityReady: input.serverAuthorityReady === true,
  })
  const blockers = uniqueBlockers([...BASE_DISABLED_BLOCKERS, ...readinessBlockers])
  const readyForServerPurchase = readinessBlockers.length === 0

  return {
    enabled: false,
    medicineExecutionEnabled: false,
    sourceOfTruth: 'reality_server_ledger',
    citizenId,
    citizenKind,
    simulated: citizenKind === 'sim',
    active,
    activeIllness,
    citizenMoney,
    providerBusinessId,
    requestedItemId,
    medicineOptions,
    selectedMedicine,
    readyForServerPurchase,
    purchaseDraft: readyForServerPurchase && selectedMedicine && activeIllness && providerBusinessId
      ? medicineDraft({
        payerCitizenId: citizenId,
        receiverBusinessId: providerBusinessId,
        medicine: selectedMedicine,
        illnessKind: activeIllness.kind,
        blockers,
      })
      : null,
    blockers,
  }
}

function worldSimMedicineOptions(): WorldSimMedicineOption[] {
  return [
    medicineOption(itemById('coldmeds'), 'cold'),
    medicineOption(itemById('flumeds'), 'flu'),
  ].filter((option): option is WorldSimMedicineOption => option !== null)
}

function medicineOption(item: ShopItem | undefined, cures: Illness['kind']): WorldSimMedicineOption | null {
  if (!item || item.cures !== cures || item.category !== 'health') return null
  if (item.id !== 'coldmeds' && item.id !== 'flumeds') return null
  return {
    itemId: item.id,
    itemName: item.name,
    cures,
    price: normalizeMoney(item.price),
    hours: normalizeHours(item.hours),
    effects: { ...(item.effects ?? {}) },
  }
}

function selectMedicine(
  options: readonly WorldSimMedicineOption[],
  illness: Illness | null,
  requestedItemId: string | null,
): WorldSimMedicineOption | null {
  if (requestedItemId) {
    const requested = options.find((option) => option.itemId === requestedItemId)
    if (!requested || requested.cures !== illness?.kind) return null
    return requested
  }
  if (!illness) return null
  return options.find((option) => option.cures === illness.kind) ?? null
}

function medicineDraft(input: {
  payerCitizenId: string
  receiverBusinessId: string
  medicine: WorldSimMedicineOption
  illnessKind: Illness['kind']
  blockers: readonly WorldSimMedicineBlocker[]
}): WorldSimMedicineDraft {
  return {
    kind: 'world_sim_medicine_purchase',
    executionEnabled: false,
    payerCitizenId: input.payerCitizenId,
    receiverBusinessId: input.receiverBusinessId,
    itemId: input.medicine.itemId,
    itemName: input.medicine.itemName,
    illnessKind: input.illnessKind,
    amount: input.medicine.price,
    currency: 'game_credits',
    hours: input.medicine.hours,
    effects: { ...input.medicine.effects },
    clearsIllness: true,
    blockers: input.blockers,
  }
}

function medicineReadinessBlockers(input: {
  citizenId: string
  citizenKind: WorldCitizenKind | null
  active: boolean
  activeIllness: Illness | null
  selectedMedicine: WorldSimMedicineOption | null
  requestedItemId: string | null
  citizenMoney: number
  providerBusinessId: string | null
  serverAuthorityReady: boolean
}): WorldSimMedicineBlocker[] {
  const blockers: WorldSimMedicineBlocker[] = []
  if (!input.serverAuthorityReady) blockers.push('server_authority_required')
  if (!input.citizenId || input.citizenKind !== 'sim') blockers.push('sim_citizen_required')
  if (!input.active) blockers.push('active_citizen_required')
  if (!input.activeIllness) blockers.push('active_illness_required')
  if (!input.selectedMedicine || input.selectedMedicine.cures !== input.activeIllness?.kind) {
    blockers.push('matching_medicine_required')
  }
  if (!input.providerBusinessId) blockers.push('provider_required')
  if (input.selectedMedicine && input.citizenMoney < input.selectedMedicine.price) blockers.push('funds_required')
  return blockers
}

function normalizeIllness(illness: Illness | null | undefined): Illness | null {
  if (!illness || (illness.kind !== 'cold' && illness.kind !== 'flu')) return null
  if (!Number.isFinite(illness.endsAt) || illness.endsAt < 0) return null
  return { kind: illness.kind, endsAt: illness.endsAt }
}

function normalizeMoney(value: number | null | undefined): number {
  if (!Number.isFinite(value) || value! < 0) return 0
  return roundMoney(value!)
}

function normalizeHours(value: number | undefined): number {
  if (!Number.isFinite(value) || value! < 0) return 0
  return roundMoney(value!)
}

function uniqueBlockers(blockers: readonly WorldSimMedicineBlocker[]): WorldSimMedicineBlocker[] {
  return [...new Set(blockers)]
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}
