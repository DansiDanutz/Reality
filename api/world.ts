import { createHash } from 'node:crypto'
import { list, put } from '@vercel/blob'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const AREA_STATE_VERSION = 1
const EARTH_RADIUS_KM = 6_371.0088
const AREA_BOUNDARY_EPSILON_KM = 0.000001
interface FounderAreaClaim {
  founderCitizenId: string
  centerLat: number
  centerLng: number
  radiusKm: number
}
type ReadFounderAreaClaimResult =
  | { ok: true; claim: FounderAreaClaim }
  | { ok: false; status: 403 | 409; code: 'area_not_claimed' | 'area_claim_invalid' | 'area_owner_mismatch'; error: string }
/**
 * Per-citizen daily placement cap. A citizen can place at most this many assets
 * per real day. Bounds how much one citizen can bloat the shared `world/`
 * prefix (which every player's GET scans), without limiting legitimate play
 * (a citizen rarely places more than a few homes/businesses a day). Stateless:
 * the counter is the set of `worldrate/{cid}__{day}__{ts}.json` blobs — same
 * idiom as avatar.ts's per-citizen daily generation cap.
 */
const PLACEMENTS_PER_DAY = 20
async function verifyCitizen(citizenId: string, token: string): Promise<boolean> {
  if (!UUID_RE.test(citizenId) || typeof token !== 'string' || token.length > 64) return false
  const tokenHash = createHash('sha256').update(token).digest('hex').slice(0, 24)
  const batch = await list({ prefix: `citizens/${citizenId}__${tokenHash}`, limit: 1 })
  return batch.blobs.length > 0
export function areaStatePath(citizenId: string): string {
  return `reality-areas/${citizenId}.json`
async function readFounderAreaClaim(citizenId: string): Promise<ReadFounderAreaClaimResult> {
  const batch = await list({ prefix: areaStatePath(citizenId), limit: 1 })
  const url = batch.blobs[0]?.downloadUrl
  if (!url) {
    return {
      ok: false,
      status: 409,
      code: 'area_not_claimed',
      error: 'Claim your founder area before placing shared-world assets.',
    }
  }
  const response = await fetch(url)
  if (!response.ok) {
      code: 'area_claim_invalid',
      error: 'Founder area claim could not be verified.',
  const value = await response.json() as unknown
  return normalizeFounderAreaClaim(value, citizenId)
function normalizeFounderAreaClaim(value: unknown, citizenId: string): ReadFounderAreaClaimResult {
  if (!isRecord(value) || value.version !== AREA_STATE_VERSION || !isRecord(value.claim)) {
      error: 'Founder area claim needs manual review before shared-world placement.',
  const claim = value.claim
  if (value.founderCitizenId !== citizenId || claim.founderCitizenId !== citizenId) {
      status: 403,
      code: 'area_owner_mismatch',
      error: 'Shared-world placements must use the founder who owns the claimed area.',
  const centerLat = Number(claim.centerLat)
  const centerLng = Number(claim.centerLng)
  const radiusKm = Number(claim.radiusKm)
  if (!isLatitude(centerLat) || !isLongitude(centerLng) || !Number.isFinite(radiusKm) || radiusKm <= 0) {
      error: 'Founder area claim needs valid coordinates before shared-world placement.',
  return {
    ok: true,
    claim: {
      founderCitizenId: citizenId,
      centerLat,
      centerLng,
      radiusKm,
    },
export function assessPlacementInsideFounderArea(
  claim: FounderAreaClaim,
  lat: number,
  lng: number,
): { ok: true; distanceKm: number; radiusKm: number } | { ok: false; distanceKm: number; radiusKm: number } {
  const distanceKm = distanceKmBetweenCoordinates(claim.centerLat, claim.centerLng, lat, lng)
  return distanceKm <= claim.radiusKm + AREA_BOUNDARY_EPSILON_KM
    ? { ok: true, distanceKm, radiusKm: claim.radiusKm }
    : { ok: false, distanceKm, radiusKm: claim.radiusKm }
export function distanceKmBetweenCoordinates(latA: number, lngA: number, latB: number, lngB: number): number {
  const phiA = toRadians(latA)
  const phiB = toRadians(latB)
  const deltaPhi = toRadians(latB - latA)
  const deltaLambda = toRadians(normalizeLongitudeDelta(lngB - lngA))
  const sinDeltaPhi = Math.sin(deltaPhi / 2)
  const sinDeltaLambda = Math.sin(deltaLambda / 2)
  const a = sinDeltaPhi * sinDeltaPhi +
    Math.cos(phiA) * Math.cos(phiB) * sinDeltaLambda * sinDeltaLambda
  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
function isLatitude(value: number): boolean {
  return Number.isFinite(value) && value >= -90 && value <= 90
function isLongitude(value: number): boolean {
  return Number.isFinite(value) && value >= -180 && value <= 180
function toRadians(degrees: number): number {
  return degrees * Math.PI / 180
function normalizeLongitudeDelta(delta: number): number {
  return ((delta + 540) % 360) - 180
function storedCoordinate(value: number): number {
  return Number(value.toFixed(5))
 * The shared world map. Asset data is encoded in the blob pathname —
 * `world/{cid}/{assetId}__{itemId}__{kind}__{lat}__{lng}.json` — so one
 * list() call returns the whole planet with zero content reads.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    try {
      const assets: { cid: string; itemId: string; kind: string; lat: number; lng: number }[] = []
      let cursor: string | undefined
      for (let page = 0; page < 3; page++) {
        const batch = await list({ prefix: 'world/', cursor, limit: 1000 })
        for (const blob of batch.blobs) {
          const m = blob.pathname.match(/^world\/([0-9a-f]{8})[0-9a-f-]*\/[\w-]+__([a-z_]+)__(home|business)__(-?\d+\.?\d*)__(-?\d+\.?\d*)\.json$/)
          if (m) assets.push({ cid: m[1], itemId: m[2], kind: m[3], lat: Number(m[4]), lng: Number(m[5]) })
        }
        if (!batch.hasMore || !batch.cursor) break
        cursor = batch.cursor
      }
      const founders = await list({ prefix: 'founders/', limit: 1000 })
      res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120')
      res.status(200).json({ ok: true, assets, stats: { assets: assets.length, founders: founders.blobs.length } })
    } catch {
      res.status(200).json({ ok: true, assets: [], stats: { assets: 0, founders: 0 } })
    return
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' })
  const { citizenId, token, assetId, itemId, kind, lat, lng } = (req.body ?? {}) as Record<string, unknown>
  const cleanCitizenId = String(citizenId)
  const cleanAssetId = String(assetId ?? '').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 60)
  const cleanItemId = String(itemId ?? '').replace(/[^a-z_]/g, '').slice(0, 30)
  const nLat = Number(lat)
  const nLng = Number(lng)
  if (
    !cleanAssetId ||
    !cleanItemId ||
    (kind !== 'home' && kind !== 'business') ||
    !Number.isFinite(nLat) || nLat < -90 || nLat > 90 ||
    !Number.isFinite(nLng) || nLng < -180 || nLng > 180
  ) {
    res.status(400).json({ ok: false, error: 'Invalid asset.' })
  const placementLat = storedCoordinate(nLat)
  const placementLng = storedCoordinate(nLng)
  try {
    if (!(await verifyCitizen(cleanCitizenId, String(token)))) {
      res.status(401).json({ ok: false, error: 'Not a registered citizen.' })
      return
    // Per-citizen daily placement cap. Without this, one citizen can spam the
    // shared `world/` prefix with random asset ids, slowing every player's GET.
    // The list() of dated markers IS the counter — same idiom as avatar.ts.
    const day = new Date().toISOString().slice(0, 10)
    const used = await list({ prefix: `worldrate/${citizenId}__${day}`, limit: PLACEMENTS_PER_DAY + 1 })
    if (used.blobs.length >= PLACEMENTS_PER_DAY) {
      res.status(429).json({ ok: false, error: `You've placed ${PLACEMENTS_PER_DAY} things in the world today. Come back tomorrow.` })
    const areaClaim = await readFounderAreaClaim(cleanCitizenId)
    if (!areaClaim.ok) {
      res.status(areaClaim.status).json({ ok: false, error: areaClaim.error, code: areaClaim.code })
    const boundary = assessPlacementInsideFounderArea(areaClaim.claim, placementLat, placementLng)
    if (!boundary.ok) {
      res.status(409).json({
        ok: false,
        error: 'Place this asset inside your claimed founder area.',
        code: 'placement_outside_area',
        boundary: {
          distanceKm: Number(boundary.distanceKm.toFixed(3)),
          radiusKm: boundary.radiusKm,
        },
      })
    await put(
      `world/${cleanCitizenId}/${cleanAssetId}__${cleanItemId}__${kind}__${placementLat.toFixed(5)}__${placementLng.toFixed(5)}.json`,
      '1',
      { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' },
    )
    // Record against the per-citizen daily cap. allowOverwrite:false is not
    // needed — the {ts} suffix makes each marker unique within the day.
    await put(`worldrate/${citizenId}__${day}__${Date.now()}.json`, '1', {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
    })
    res.status(200).json({ ok: true })
  } catch {
    res.status(500).json({ ok: false, error: 'The world is briefly unavailable.' })
