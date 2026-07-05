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
      creditorId: 'clinic1',
      amount: 250,
      issuedAt: 1_000,
      memo: 'Founder owes medical debt to clinic1.',
    }],
    needs: { hunger: 90, hydration: 90, energy: 90, hygiene: 90, fun: 90 },
    health: 100,
    state: { kind: 'active' },
    insuranceBusinessId: 'ins1',
    insurancePaidUntil: 30_000,
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
      kind: 'insurance_premium',
      fromId: 'founder',
      toId: 'ins1',
      amount: 45,
      memo: 'Founder bought insurance.',
    },
    {
      id: 'tx2',
      at: 2_000,
      kind: 'debt_repayment',
      fromId: 'founder',
      toId: 'clinic1',
      amount: 25,
      memo: 'Founder repaid debt to clinic1.',
    },
  ],
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
  })

  test('rejects invalid citizen state and business shape', () => {
    const badState = area()
    badState.citizens[0].state = { kind: 'hospitalized', until: Number.NaN }
    expect(decodeWorldAreaSnapshot(JSON.stringify({ version: WORLD_AREA_SNAPSHOT_VERSION, area: badState }))).toEqual({ ok: false, error: 'invalid_area' })

    const badBusiness = area()
    badBusiness.businesses[0].staffCitizenIds = ['']
    expect(decodeWorldAreaSnapshot(JSON.stringify({ version: WORLD_AREA_SNAPSHOT_VERSION, area: badBusiness }))).toEqual({ ok: false, error: 'invalid_area' })

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
