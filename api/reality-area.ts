import { createHash } from 'node:crypto'
import { list, put } from '@vercel/blob'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const FOUNDER_STARTER_CREDIT = 200_000
const MIN_FOUNDER_AREA_RADIUS_KM = 0.25
const MAX_FOUNDER_AREA_RADIUS_KM = 5
const PLATFORM_BANK_ID = 'reality-founder-bank'
const AREA_STATE_VERSION = 1
const CLAIM_SOURCES = ['manual', 'ip', 'geolocation', 'telegram'] as const

type AreaClaimSource = typeof CLAIM_SOURCES[number]

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
  kind: 'founder_credit'
  fromId: string
  toId: string
  amount: number
  memo: string
}

interface FounderAreaState {
  version: typeof AREA_STATE_VERSION
  areaId: string
  founderCitizenId: string
  founderNumber: number
  balance: number
  claim: FounderAreaClaim
  businesses: []
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
      res.status(403).json({ ok: false, error: 'Founder seat required to claim an area.', code: 'founder_required' })
      return
    }
    if (existing) {
      res.status(409).json({ ok: false, error: 'Area already claimed.', code: 'area_already_claimed', state: existing })
      return
    }

    const intent = normalizeClaimAreaIntent((req.body as { intent?: unknown } | undefined)?.intent)
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
  } catch {
    res.status(500).json({ ok: false, error: 'Reality area authority is briefly unavailable.' })
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
    Array.isArray(value.transactions)
}
