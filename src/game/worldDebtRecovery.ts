import type { WorldCitizenState, WorldDebtKind } from './worldSim'

export type WorldDebtRecoveryBlocker =
  | 'debt_recovery_execution_disabled'
  | 'automatic_collection_disabled'
  | 'citizen_identity_required'
  | 'active_citizen_required'
  | 'debt_required'
  | 'valid_debt_required'
  | 'payment_capacity_required'

export type WorldDebtRecoveryExclusionReason =
  | 'debt_id_required'
  | 'supported_debt_kind_required'
  | 'creditor_required'
  | 'positive_amount_required'
  | 'issued_at_required'

export interface WorldDebtRecoveryDebtInput {
  id?: string | null
  kind?: WorldDebtKind | string | null
  creditorId?: string | null
  amount?: number | null
  issuedAt?: number | null
  memo?: string | null
}

export interface WorldDebtRecoveryPolicyInput {
  citizenId?: string | null
  citizenState?: WorldCitizenState | null
  citizenMoney?: number | null
  protectedReserve?: number | null
  maxPayment?: number | null
  debts?: readonly WorldDebtRecoveryDebtInput[] | null
}

export interface WorldDebtRecoveryDebtLine {
  id: string
  kind: WorldDebtKind
  creditorId: string
  amount: number
  issuedAt: number
  memo: string | null
}

export interface ExcludedWorldDebtRecoveryDebt {
  id: string | null
  kind: string | null
  creditorId: string | null
  amount: number
  issuedAt: number | null
  reasons: readonly WorldDebtRecoveryExclusionReason[]
}

export interface WorldDebtRecoveryPaymentDraft {
  kind: 'world_debt_repayment'
  executionEnabled: false
  payerCitizenId: string
  receiverId: string
  debtId: string
  debtKind: WorldDebtKind
  amount: number
  currency: 'game_credits'
  blockers: readonly WorldDebtRecoveryBlocker[]
}

export interface WorldDebtRecoveryPolicyAssessment {
  sourceOfTruth: 'reality_server_ledger'
  debtRecoveryExecutionEnabled: false
  automaticCollectionsEnabled: false
  payoutWithholdingEnabled: false
  creditReportingEnabled: false
  citizenId: string
  active: boolean
  citizenMoney: number
  protectedReserve: number
  paymentCapacity: number
  totalDebt: number
  validDebtCount: number
  excludedDebtCount: number
  debts: readonly WorldDebtRecoveryDebtLine[]
  excludedDebts: readonly ExcludedWorldDebtRecoveryDebt[]
  recommendedPaymentTotal: number
  paymentDrafts: readonly WorldDebtRecoveryPaymentDraft[]
  readyForManualReview: boolean
  blockers: readonly WorldDebtRecoveryBlocker[]
}

const BASE_BLOCKERS: readonly WorldDebtRecoveryBlocker[] = [
  'debt_recovery_execution_disabled',
  'automatic_collection_disabled',
]

export function assessWorldDebtRecoveryPolicy(
  input: WorldDebtRecoveryPolicyInput = {},
): WorldDebtRecoveryPolicyAssessment {
  const citizenId = input.citizenId?.trim() ?? ''
  const active = input.citizenState?.kind === 'active'
  const citizenMoney = normalizeMoney(input.citizenMoney)
  const protectedReserve = normalizeMoney(input.protectedReserve)
  const maxPayment = normalizeOptionalMoney(input.maxPayment)
  const rawDebts = input.debts ?? []
  const normalized = normalizeDebts(rawDebts)
  const debts = normalized.debts.sort(compareDebtLines)
  const totalDebt = roundMoney(debts.reduce((total, debt) => total + debt.amount, 0))
  const paymentCapacity = active
    ? roundMoney(Math.max(0, Math.min(citizenMoney - protectedReserve, maxPayment ?? Number.POSITIVE_INFINITY)))
    : 0
  const readinessBlockers = debtRecoveryReadinessBlockers({
    citizenId,
    active,
    rawDebtCount: rawDebts.length,
    validDebtCount: debts.length,
    paymentCapacity,
  })
  const blockers = uniqueBlockers([...BASE_BLOCKERS, ...readinessBlockers])
  const paymentDrafts = readinessBlockers.length === 0
    ? allocatePaymentDrafts({
      citizenId,
      debts,
      paymentCapacity,
      blockers,
    })
    : []
  const recommendedPaymentTotal = roundMoney(paymentDrafts.reduce((total, draft) => total + draft.amount, 0))

  return {
    sourceOfTruth: 'reality_server_ledger',
    debtRecoveryExecutionEnabled: false,
    automaticCollectionsEnabled: false,
    payoutWithholdingEnabled: false,
    creditReportingEnabled: false,
    citizenId,
    active,
    citizenMoney,
    protectedReserve,
    paymentCapacity,
    totalDebt,
    validDebtCount: debts.length,
    excludedDebtCount: normalized.excludedDebts.length,
    debts,
    excludedDebts: normalized.excludedDebts,
    recommendedPaymentTotal,
    paymentDrafts,
    readyForManualReview: readinessBlockers.length === 0,
    blockers,
  }
}

function normalizeDebts(
  debts: readonly WorldDebtRecoveryDebtInput[],
): {
  debts: WorldDebtRecoveryDebtLine[]
  excludedDebts: ExcludedWorldDebtRecoveryDebt[]
} {
  const validDebts: WorldDebtRecoveryDebtLine[] = []
  const excludedDebts: ExcludedWorldDebtRecoveryDebt[] = []

  for (const input of debts) {
    const id = input.id?.trim() || null
    const kind = normalizeDebtKind(input.kind)
    const creditorId = input.creditorId?.trim() || null
    const amount = normalizeMoney(input.amount)
    const issuedAt = normalizeInstant(input.issuedAt)
    const reasons: WorldDebtRecoveryExclusionReason[] = []

    if (!id) reasons.push('debt_id_required')
    if (!kind) reasons.push('supported_debt_kind_required')
    if (!creditorId) reasons.push('creditor_required')
    if (amount <= 0) reasons.push('positive_amount_required')
    if (issuedAt === null) reasons.push('issued_at_required')

    if (reasons.length > 0 || !id || !kind || !creditorId || issuedAt === null) {
      excludedDebts.push({
        id,
        kind: typeof input.kind === 'string' ? input.kind.trim() || null : null,
        creditorId,
        amount,
        issuedAt,
        reasons,
      })
      continue
    }

    validDebts.push({
      id,
      kind,
      creditorId,
      amount,
      issuedAt,
      memo: input.memo?.trim() || null,
    })
  }

  return { debts: validDebts, excludedDebts }
}

function allocatePaymentDrafts(input: {
  citizenId: string
  debts: readonly WorldDebtRecoveryDebtLine[]
  paymentCapacity: number
  blockers: readonly WorldDebtRecoveryBlocker[]
}): WorldDebtRecoveryPaymentDraft[] {
  let remaining = input.paymentCapacity
  const drafts: WorldDebtRecoveryPaymentDraft[] = []

  for (const debt of input.debts) {
    if (remaining <= 0) break
    const amount = roundMoney(Math.min(remaining, debt.amount))
    if (amount <= 0) continue
    drafts.push({
      kind: 'world_debt_repayment',
      executionEnabled: false,
      payerCitizenId: input.citizenId,
      receiverId: debt.creditorId,
      debtId: debt.id,
      debtKind: debt.kind,
      amount,
      currency: 'game_credits',
      blockers: input.blockers,
    })
    remaining = roundMoney(remaining - amount)
  }

  return drafts
}

function debtRecoveryReadinessBlockers(input: {
  citizenId: string
  active: boolean
  rawDebtCount: number
  validDebtCount: number
  paymentCapacity: number
}): WorldDebtRecoveryBlocker[] {
  const blockers: WorldDebtRecoveryBlocker[] = []
  if (!input.citizenId) blockers.push('citizen_identity_required')
  if (!input.active) blockers.push('active_citizen_required')
  if (input.rawDebtCount === 0) blockers.push('debt_required')
  if (input.rawDebtCount > 0 && input.validDebtCount === 0) blockers.push('valid_debt_required')
  if (input.paymentCapacity <= 0) blockers.push('payment_capacity_required')
  return blockers
}

function normalizeDebtKind(kind: WorldDebtRecoveryDebtInput['kind']): WorldDebtKind | null {
  const normalizedKind = typeof kind === 'string' ? kind.trim() : kind
  return normalizedKind === 'medical' ? normalizedKind : null
}

function normalizeMoney(value: number | null | undefined): number {
  if (!Number.isFinite(value) || value! < 0) return 0
  return roundMoney(value!)
}

function normalizeOptionalMoney(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  return normalizeMoney(value)
}

function normalizeInstant(value: number | null | undefined): number | null {
  if (!Number.isFinite(value) || value! < 0) return null
  return value!
}

function compareDebtLines(a: WorldDebtRecoveryDebtLine, b: WorldDebtRecoveryDebtLine): number {
  return a.issuedAt - b.issuedAt || a.id.localeCompare(b.id)
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

function uniqueBlockers(blockers: readonly WorldDebtRecoveryBlocker[]): readonly WorldDebtRecoveryBlocker[] {
  return [...new Set(blockers)]
}
