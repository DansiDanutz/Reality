import { createHash } from 'node:crypto'
import { db, databaseUrl } from './_db.js'

export const OVERPASS_IP_LIMIT = 120
export const OVERPASS_GLOBAL_LIMIT = 2_000

const CLAIM_SQL = `
  SELECT reality_claim_overpass_slot($1, now(), $2, $3) AS refusal
`.trim()

type SqlClient = { query: (statement: string, params?: unknown[]) => Promise<unknown> }

/**
 * Cross-instance admission for the public Overpass proxy. The database
 * function serializes a short rolling window and returns either `ip`,
 * `global`, or NULL when the request is admitted.
 *
 * Local previews without Postgres retain the warm-instance brake; production
 * already requires Postgres for the authoritative economy.
 */
export async function claimOverpassSlot(ip: string, env: NodeJS.ProcessEnv = process.env): Promise<'ip' | 'global' | null> {
  if (!databaseUrl(env)) return null
  const ipHash = createHash('sha256').update(ip).digest('hex').slice(0, 32)
  const rows = (await (db(env) as unknown as SqlClient).query(CLAIM_SQL, [ipHash, OVERPASS_IP_LIMIT, OVERPASS_GLOBAL_LIMIT])) as Array<{ refusal: 'ip' | 'global' | null }>
  const refusal = rows[0]?.refusal
  return refusal === 'ip' || refusal === 'global' ? refusal : null
}

