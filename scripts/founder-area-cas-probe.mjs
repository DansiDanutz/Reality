/**
 * Guarded live proof for Founder Area revision/CAS serialization.
 *
 * Required: POSTGRES_URL or DATABASE_URL, REALITY_CUTOVER_CITIZEN_ID,
 * REALITY_CUTOVER_AREA_ID, and REALITY_CUTOVER_STATE_JSON. Set
 * REALITY_CUTOVER_ALLOW_WRITE=1 only for a dedicated test citizen/area.
 */
import { neon } from '@neondatabase/serverless'

const databaseUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL
const required = ['REALITY_CUTOVER_CITIZEN_ID', 'REALITY_CUTOVER_AREA_ID', 'REALITY_CUTOVER_STATE_JSON']
const missing = [
  ...(!databaseUrl ? ['POSTGRES_URL or DATABASE_URL'] : []),
  ...required.filter((name) => !process.env[name]),
]
if (missing.length > 0) {
  console.error(`Missing cutover probe inputs: ${missing.join(', ')}`)
  process.exit(1)
}
if (process.env.REALITY_CUTOVER_ALLOW_WRITE !== '1') {
  console.error('Refusing live CAS writes. Set REALITY_CUTOVER_ALLOW_WRITE=1 for a dedicated test citizen/area.')
  process.exit(1)
}

let state
try {
  state = JSON.parse(process.env.REALITY_CUTOVER_STATE_JSON)
} catch {
  console.error('REALITY_CUTOVER_STATE_JSON must be valid JSON.')
  process.exit(1)
}

const sql = neon(databaseUrl)
const citizenId = process.env.REALITY_CUTOVER_CITIZEN_ID
const areaId = process.env.REALITY_CUTOVER_AREA_ID
const current = await sql.query(
  'SELECT revision, simulation_at, updated_at FROM founder_area_snapshots WHERE citizen_id = $1 AND area_id = $2 LIMIT 1',
  [citizenId, areaId],
)
if (current.length === 0) {
  console.error('No Founder Area snapshot found for the supplied dedicated test citizen/area.')
  process.exit(1)
}

const expectedRevision = Number(current[0].revision)
const now = new Date().toISOString()
const attempt = () => sql.query(
  'SELECT reality_save_founder_area($1, $2, $3, $4::jsonb, $5::timestamptz, $6::timestamptz) AS revision',
  [citizenId, areaId, expectedRevision, JSON.stringify(state), current[0].simulation_at ?? now, now],
)
const results = await Promise.allSettled([attempt(), attempt()])
const fulfilled = results.filter((result) => result.status === 'fulfilled')
const conflicts = results.filter((result) => result.status === 'rejected' && String(result.reason).includes('founder_area_revision_conflict'))
if (fulfilled.length !== 1 || conflicts.length !== 1) {
  console.error(`CAS probe failed: expected one success and one revision conflict; got ${fulfilled.length} successes and ${conflicts.length} conflicts.`)
  process.exit(1)
}
console.log(JSON.stringify({ ok: true, expectedRevision, winnerRevision: fulfilled[0].value[0]?.revision, concurrentAttempts: 2, conflicts: 1 }))
