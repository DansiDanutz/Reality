import { describe, expect, test } from 'vitest'
import { decodeWorldAreaSnapshot, encodeWorldAreaSnapshot, WORLD_AREA_SNAPSHOT_VERSION } from './worldSimCodec'
import type { WorldArea } from './worldSim'

const area = (): WorldArea => ({
  id: 'area-1',
  name: 'Founder District',
  now: 1_000,
  claim: {
    founderCitizenId: 'founder',
    label: 'Founder District',
    centerLat: 44.45,
    centerLng: 26.08,
    radiusKm: 2,
    claimedAt: 1_000,
    source: 'telegram',
  },
  citizens: [{
    id: 'founder',
    name: 'Founder',
    kind: 'real',
    money: 200_000,
    debt: 250,
    debts: [{
      id: 'debt1',
      kind: 'medical',
      creditorId: 'system:hospital',
      amount: 250,
      issuedAt: 1_000,
      memo: 'Founder owes medical debt to system:hospital.',
    }],
    needs: { hunger: 90, hydration: 90, energy: 90, hygiene: 90, fun: 90 },
    health: 100,
    state: { kind: 'active' },
    insuranceBusinessId: 'ins1',
    insurancePaidUntil: 30_000,
    heirCitizenId: 'heir1',
  }, {
    id: 'heir1',
    name: 'Heir',
    kind: 'real',
    money: 1_000,
    debt: 0,
    needs: { hunger: 80, hydration: 80, energy: 80, hygiene: 80, fun: 80 },
    health: 100,
    state: { kind: 'active' },
  }, {
    id: 'sim1',
    name: 'Demo Citizen',
    kind: 'sim',
    money: 100,
    debt: 0,
    needs: { hunger: 80, hydration: 75, energy: 85, hygiene: 70, fun: 65 },
    health: 95,
    state: { kind: 'active' },
  }],
  businesses: [{
    id: 'ins1',
    name: 'Insurance Office',
    kind: 'insurance',
    ownerId: 'founder',
    cash: 45,
    staffCitizenIds: [],
    price: 45,
    wagePerHour: 20,
    quality: 1,
    createdBy: 'founder',
  }],
  transactions: [
    {
      id: 'tx1',
      at: 1_000,
      kind: 'founder_credit',
      payoutEligibility: 'game_only',
      fromId: 'system:founder-credit',
      toId: 'founder',
      amount: 200_000,
      memo: 'Founder received founder starting game credit.',
    },
    {
      id: 'tx2',
      at: 1_000,
      kind: 'sim_citizen_credit',
      payoutEligibility: 'game_only',
      fromId: 'system:sim-credit',
      toId: 'sim1',
      amount: 100,
      memo: 'Demo Citizen received simulated resident game credit.',
    },
    {
      id: 'tx3',
      at: 1_000,
      kind: 'insurance_premium',
      payoutEligibility: 'game_only',
      fromId: 'founder',
      toId: 'ins1',
      amount: 45,
      memo: 'Founder bought insurance.',
    },
    {
      id: 'tx4',
      at: 2_000,
      kind: 'debt_repayment',
      payoutEligibility: 'game_only',
      fromId: 'founder',
      toId: 'system:hospital',
      amount: 25,
      memo: 'Founder repaid debt to system:hospital.',
    },
  ],
  areaEvents: [{
    id: 'event1',
    at: 3_000,
    kind: 'sim_citizen_departure',
    severity: 'warning',
    citizenId: 'sim-left',
    citizenName: 'Demo Former Resident',
    simulated: true,
    reason: 'food_unserved',
    serviceKind: 'food',
    health: 20,
    needs: { hunger: 0, hydration: 75, energy: 85, hygiene: 70, fun: 65 },
    message: 'Demo Former Resident left the area because food stayed unserved while health was low.',
  }],
})

const founderReview = (): NonNullable<WorldArea['founderReviewHistory']>[number] => ({
  id: 'review1',
  at: 4_000,
  reviewerId: 'reviewer-1',
  actionKind: 'record_review',
  summary: 'Manual founder covenant review recorded.',
  authorityGate: {
    requiredRole: 'area_reviewer',
    status: 'evidence_only',
    approvedById: null,
    approvedAt: null,
    executionEnabled: false,
  },
  decision: {
    status: 'watch',
    nextAction: 'warn_founder',
    manualReviewRequired: false,
  },
  signals: [{
    kind: 'sim_departure',
    severity: 'warning',
    message: 'A Sim Citizen left after the latest review.',
    businessKinds: ['food'],
    amount: 1,
  }],
  activityReview: null,
  reviewQueue: {
    evidenceOnly: true,
    automationEnabled: false,
    executionEnabled: false,
    nextStep: 'record_review',
    recordReviewEnabled: true,
    recommendedActionKinds: ['record_review'],
    pendingApprovalKinds: [],
    pendingApprovalCount: 0,
    pendingNotificationKinds: [],
    pendingNotificationCount: 0,
    blockerCount: 0,
    blockers: [],
  },
  reviewInputs: [],
  stages: [],
  reviewChecklist: [],
  manualActions: [],
  approvalRequests: [],
  reviewSchedule: null,
})

describe('worldSim snapshot codec', () => {
  test('round-trips a versioned world area snapshot', () => {
    const source = area()
    const encoded = encodeWorldAreaSnapshot(source)
    const decoded = decodeWorldAreaSnapshot(encoded)

    expect(JSON.parse(encoded)).toMatchObject({ version: WORLD_AREA_SNAPSHOT_VERSION })
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) throw new Error('expected decode to succeed')
    expect(decoded.area).toEqual(source)
    expect(decoded.area).not.toBe(source)
  })

  test('rejects invalid JSON and unsupported versions', () => {
    expect(decodeWorldAreaSnapshot('{oops')).toEqual({ ok: false, error: 'invalid_json' })
    expect(decodeWorldAreaSnapshot(JSON.stringify({ version: 999, area: area() }))).toEqual({ ok: false, error: 'invalid_version' })
    expect(decodeWorldAreaSnapshot(JSON.stringify({ area: area() }))).toEqual({ ok: false, error: 'invalid_version' })
  })

  test('rejects client-shaped or incomplete areas', () => {
    expect(decodeWorldAreaSnapshot(JSON.stringify({
      version: WORLD_AREA_SNAPSHOT_VERSION,
      area: { id: 'area-1', name: 'bad', now: 1_000 },
    }))).toEqual({ ok: false, error: 'invalid_area' })
  })

  test('accepts older snapshots without area event evidence', () => {
    const legacy = area()
    delete legacy.areaEvents
    const decoded = decodeWorldAreaSnapshot(JSON.stringify({ version: WORLD_AREA_SNAPSHOT_VERSION, area: legacy }))

    expect(decoded.ok).toBe(true)
    if (!decoded.ok) throw new Error('expected legacy snapshot to decode')
    expect(decoded.area.areaEvents).toBeUndefined()
  })

  test('round-trips founder covenant review history evidence', () => {
    const reviewed = area()
    reviewed.founderReviewHistory = [founderReview()]

    const decoded = decodeWorldAreaSnapshot(encodeWorldAreaSnapshot(reviewed))

    expect(decoded.ok).toBe(true)
    if (!decoded.ok) throw new Error('expected review history snapshot to decode')
    expect(decoded.area.founderReviewHistory).toEqual(reviewed.founderReviewHistory)
  })

  test('rejects malformed founder covenant review history', () => {
    const reviewed = area()
    reviewed.founderReviewHistory = [founderReview()]
    reviewed.founderReviewHistory[0].authorityGate.executionEnabled = true

    expect(decodeWorldAreaSnapshot(JSON.stringify({
      version: WORLD_AREA_SNAPSHOT_VERSION,
      area: reviewed,
    }))).toEqual({ ok: false, error: 'invalid_area' })
  })

  test('accepts historical ledger entries for departed Sim Citizens with event evidence', () => {
    const departed = area()
    departed.areaEvents![0] = {
      ...departed.areaEvents![0],
      citizenId: 'sim1',
      citizenName: 'Demo Citizen',
    }
    departed.citizens = departed.citizens.filter((citizen) => citizen.id !== 'sim1')

    const decoded = decodeWorldAreaSnapshot(JSON.stringify({ version: WORLD_AREA_SNAPSHOT_VERSION, area: departed }))

    expect(decoded.ok).toBe(true)
    if (!decoded.ok) throw new Error('expected departed participant ledger history to decode')
    expect(decoded.area.citizens.map((citizen) => citizen.id)).not.toContain('sim1')
    expect(decoded.area.transactions.find((transaction) => transaction.toId === 'sim1')).toMatchObject({
      kind: 'sim_citizen_credit',
      payoutEligibility: 'game_only',
    })
  })

  test('rejects duplicate persisted identities', () => {
    const duplicateCitizen = area()
    duplicateCitizen.citizens[1].id = 'founder'
    expect(decodeWorldAreaSnapshot(JSON.stringify({ version: WORLD_AREA_SNAPSHOT_VERSION, area: duplicateCitizen }))).toEqual({ ok: false, error: 'invalid_area' })

    const duplicateBusiness = area()
    duplicateBusiness.businesses.push({ ...duplicateBusiness.businesses[0] })
    expect(decodeWorldAreaSnapshot(JSON.stringify({ version: WORLD_AREA_SNAPSHOT_VERSION, area: duplicateBusiness }))).toEqual({ ok: false, error: 'invalid_area' })

    const duplicateTransaction = area()
    duplicateTransaction.transactions[1].id = 'tx1'
    expect(decodeWorldAreaSnapshot(JSON.stringify({ version: WORLD_AREA_SNAPSHOT_VERSION, area: duplicateTransaction }))).toEqual({ ok: false, error: 'invalid_area' })

    const duplicateDebt = area()
    duplicateDebt.citizens[0].debt = 500
    duplicateDebt.citizens[0].debts!.push({ ...duplicateDebt.citizens[0].debts![0] })
    expect(decodeWorldAreaSnapshot(JSON.stringify({ version: WORLD_AREA_SNAPSHOT_VERSION, area: duplicateDebt }))).toEqual({ ok: false, error: 'invalid_area' })
  })

  test('rejects invalid persisted live references', () => {
    const badClaimFounder = area()
    badClaimFounder.claim!.founderCitizenId = 'sim1'
    expect(decodeWorldAreaSnapshot(JSON.stringify({ version: WORLD_AREA_SNAPSHOT_VERSION, area: badClaimFounder }))).toEqual({ ok: false, error: 'invalid_area' })

    const badOwner = area()
    badOwner.businesses[0].ownerId = 'missing'
    expect(decodeWorldAreaSnapshot(JSON.stringify({ version: WORLD_AREA_SNAPSHOT_VERSION, area: badOwner }))).toEqual({ ok: false, error: 'invalid_area' })

    const badStaff = area()
    badStaff.businesses[0].staffCitizenIds = ['sim1']
    expect(decodeWorldAreaSnapshot(JSON.stringify({ version: WORLD_AREA_SNAPSHOT_VERSION, area: badStaff }))).toEqual({ ok: false, error: 'invalid_area' })

    const badHome = area()
    badHome.citizens[1].homeBusinessId = 'ins1'
    expect(decodeWorldAreaSnapshot(JSON.stringify({ version: WORLD_AREA_SNAPSHOT_VERSION, area: badHome }))).toEqual({ ok: false, error: 'invalid_area' })

    const badJob = area()
    badJob.citizens[1].jobBusinessId = 'missing'
    expect(decodeWorldAreaSnapshot(JSON.stringify({ version: WORLD_AREA_SNAPSHOT_VERSION, area: badJob }))).toEqual({ ok: false, error: 'invalid_area' })

    const badInsurance = area()
    badInsurance.citizens[1].insuranceBusinessId = 'missing'
    badInsurance.citizens[1].insurancePaidUntil = 2_000
    expect(decodeWorldAreaSnapshot(JSON.stringify({ version: WORLD_AREA_SNAPSHOT_VERSION, area: badInsurance }))).toEqual({ ok: false, error: 'invalid_area' })

    const markerOnlyInsurance = area()
    markerOnlyInsurance.citizens[2].insuranceBusinessId = 'ins1'
    expect(decodeWorldAreaSnapshot(JSON.stringify({ version: WORLD_AREA_SNAPSHOT_VERSION, area: markerOnlyInsurance }))).toEqual({ ok: false, error: 'invalid_area' })

    const missingHeir = area()
    missingHeir.citizens[0].heirCitizenId = 'missing'
    expect(decodeWorldAreaSnapshot(JSON.stringify({ version: WORLD_AREA_SNAPSHOT_VERSION, area: missingHeir }))).toEqual({ ok: false, error: 'invalid_area' })

    const simHeir = area()
    simHeir.citizens[0].heirCitizenId = 'sim1'
    expect(decodeWorldAreaSnapshot(JSON.stringify({ version: WORLD_AREA_SNAPSHOT_VERSION, area: simHeir }))).toEqual({ ok: false, error: 'invalid_area' })

    const selfHeir = area()
    selfHeir.citizens[0].heirCitizenId = 'founder'
    expect(decodeWorldAreaSnapshot(JSON.stringify({ version: WORLD_AREA_SNAPSHOT_VERSION, area: selfHeir }))).toEqual({ ok: false, error: 'invalid_area' })
  })

  test('accepts clinic and system hospital accounts as medical creditors', () => {
    const withClinicCreditor = area()
    withClinicCreditor.businesses.push({
      id: 'clinic1',
      name: 'Clinic',
      kind: 'clinic',
      ownerId: 'founder',
      cash: 0,
      staffCitizenIds: [],
      price: 90,
      wagePerHour: 24,
      quality: 1,
      createdBy: 'founder',
    })
    withClinicCreditor.citizens[0].debts![0].creditorId = 'clinic1'
    withClinicCreditor.transactions[3].toId = 'clinic1'

    const decoded = decodeWorldAreaSnapshot(JSON.stringify({
      version: WORLD_AREA_SNAPSHOT_VERSION,
      area: withClinicCreditor,
    }))

    expect(decoded.ok).toBe(true)
  })

  test('rejects ledger entries whose payer or receiver is not a valid account', () => {
    const missingReceiver = area()
    missingReceiver.transactions[2].toId = 'missing-business'
    expect(decodeWorldAreaSnapshot(JSON.stringify({ version: WORLD_AREA_SNAPSHOT_VERSION, area: missingReceiver }))).toEqual({ ok: false, error: 'invalid_area' })

    const unknownSystemAccount = area()
    unknownSystemAccount.transactions[0].fromId = 'system:free-money'
    expect(decodeWorldAreaSnapshot(JSON.stringify({ version: WORLD_AREA_SNAPSHOT_VERSION, area: unknownSystemAccount }))).toEqual({ ok: false, error: 'invalid_area' })

    const missingDebtCreditor = area()
    missingDebtCreditor.citizens[0].debts![0].creditorId = 'missing-clinic'
    expect(decodeWorldAreaSnapshot(JSON.stringify({ version: WORLD_AREA_SNAPSHOT_VERSION, area: missingDebtCreditor }))).toEqual({ ok: false, error: 'invalid_area' })
  })

  test('rejects impossible needs, money, claim coordinates, and transaction kinds', () => {
    const badNeeds = area()
    badNeeds.citizens[0].needs.hydration = 101
    expect(decodeWorldAreaSnapshot(JSON.stringify({ version: WORLD_AREA_SNAPSHOT_VERSION, area: badNeeds }))).toEqual({ ok: false, error: 'invalid_area' })

    const badMoney = area()
    badMoney.citizens[0].money = -1
    expect(decodeWorldAreaSnapshot(JSON.stringify({ version: WORLD_AREA_SNAPSHOT_VERSION, area: badMoney }))).toEqual({ ok: false, error: 'invalid_area' })

    const badClaim = area()
    badClaim.claim!.centerLat = 120
    expect(decodeWorldAreaSnapshot(JSON.stringify({ version: WORLD_AREA_SNAPSHOT_VERSION, area: badClaim }))).toEqual({ ok: false, error: 'invalid_area' })

    const badTransaction = area()
    badTransaction.transactions[0].kind = 'free_money' as never
    expect(decodeWorldAreaSnapshot(JSON.stringify({ version: WORLD_AREA_SNAPSHOT_VERSION, area: badTransaction }))).toEqual({ ok: false, error: 'invalid_area' })

    const zeroTransaction = area()
    zeroTransaction.transactions[0].amount = 0
    expect(decodeWorldAreaSnapshot(JSON.stringify({ version: WORLD_AREA_SNAPSHOT_VERSION, area: zeroTransaction }))).toEqual({ ok: false, error: 'invalid_area' })

    const payoutEligibleTransaction = area()
    payoutEligibleTransaction.transactions[0].payoutEligibility = 'payout_eligible'
    expect(decodeWorldAreaSnapshot(JSON.stringify({ version: WORLD_AREA_SNAPSHOT_VERSION, area: payoutEligibleTransaction }))).toEqual({ ok: false, error: 'invalid_area' })

    const badAreaEvent = area()
    badAreaEvent.areaEvents![0].serviceKind = 'water'
    expect(decodeWorldAreaSnapshot(JSON.stringify({ version: WORLD_AREA_SNAPSHOT_VERSION, area: badAreaEvent }))).toEqual({ ok: false, error: 'invalid_area' })

    const nonSimDeparture = area()
    nonSimDeparture.areaEvents![0].simulated = false
    expect(decodeWorldAreaSnapshot(JSON.stringify({ version: WORLD_AREA_SNAPSHOT_VERSION, area: nonSimDeparture }))).toEqual({ ok: false, error: 'invalid_area' })
  })

  test('rejects invalid citizen state and business shape', () => {
    const badState = area()
    badState.citizens[0].state = { kind: 'hospitalized', until: Number.NaN }
    expect(decodeWorldAreaSnapshot(JSON.stringify({ version: WORLD_AREA_SNAPSHOT_VERSION, area: badState }))).toEqual({ ok: false, error: 'invalid_area' })

    const badBusiness = area()
    badBusiness.businesses[0].staffCitizenIds = ['']
    expect(decodeWorldAreaSnapshot(JSON.stringify({ version: WORLD_AREA_SNAPSHOT_VERSION, area: badBusiness }))).toEqual({ ok: false, error: 'invalid_area' })

    const freeBusiness = area()
    freeBusiness.businesses[0].price = 0
    expect(decodeWorldAreaSnapshot(JSON.stringify({ version: WORLD_AREA_SNAPSHOT_VERSION, area: freeBusiness }))).toEqual({ ok: false, error: 'invalid_area' })

    const unpaidBusiness = area()
    unpaidBusiness.businesses[0].wagePerHour = 0
    expect(decodeWorldAreaSnapshot(JSON.stringify({ version: WORLD_AREA_SNAPSHOT_VERSION, area: unpaidBusiness }))).toEqual({ ok: false, error: 'invalid_area' })

    const badPolicyDate = area()
    badPolicyDate.citizens[0].insurancePaidUntil = Number.POSITIVE_INFINITY
    expect(decodeWorldAreaSnapshot(JSON.stringify({ version: WORLD_AREA_SNAPSHOT_VERSION, area: badPolicyDate }))).toEqual({ ok: false, error: 'invalid_area' })

    const badDebt = area()
    badDebt.citizens[0].debts![0].creditorId = ''
    expect(decodeWorldAreaSnapshot(JSON.stringify({ version: WORLD_AREA_SNAPSHOT_VERSION, area: badDebt }))).toEqual({ ok: false, error: 'invalid_area' })

    const badDebtTotal = area()
    badDebtTotal.citizens[0].debt = 1
    expect(decodeWorldAreaSnapshot(JSON.stringify({ version: WORLD_AREA_SNAPSHOT_VERSION, area: badDebtTotal }))).toEqual({ ok: false, error: 'invalid_area' })

    const clearedDebtLine = area()
    clearedDebtLine.citizens[0].debt = 0
    clearedDebtLine.citizens[0].debts![0].amount = 0
    expect(decodeWorldAreaSnapshot(JSON.stringify({ version: WORLD_AREA_SNAPSHOT_VERSION, area: clearedDebtLine }))).toEqual({ ok: false, error: 'invalid_area' })
  })
})
