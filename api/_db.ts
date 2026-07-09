import { neon } from '@neondatabase/serverless'

/**
 * Phase 1b database access (issue #896). Underscore prefix keeps Vercel from
 * exposing this file as an endpoint — it is a shared helper for api/ only
 * (api/ stays self-contained: never import from src/).
 *
 * Everything Postgres hides behind the POSTGRES_ENABLED flag so every
 * Phase 1b PR ships dark: with the flag off (the default), no code path
 * touches the database and the Blob implementations remain authoritative.
 */

type NeonClient = ReturnType<typeof neon>

let client: NeonClient | null = null

/** Feature flag: explicit opt-in AND a configured database. */
export function isPostgresEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const flag = (env.POSTGRES_ENABLED ?? '').toLowerCase()
  const enabled = flag === '1' || flag === 'true'
  return enabled && typeof databaseUrl(env) === 'string'
}

/** Pooled connection string — the right one for per-request serverless queries. */
export function databaseUrl(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return env.POSTGRES_URL ?? env.DATABASE_URL ?? undefined
}

/**
 * Lazy singleton Neon client. Throws if called while the flag is off —
 * callers must gate on isPostgresEnabled() so flag-off deployments can
 * never open a connection by accident.
 */
export function db(env: NodeJS.ProcessEnv = process.env): NeonClient {
  if (!isPostgresEnabled(env)) {
    throw new Error('Postgres is not enabled (set POSTGRES_ENABLED=1 and provide POSTGRES_URL)')
  }
  if (!client) {
    client = neon(databaseUrl(env)!)
  }
  return client
}

/** Test hook — drops the cached client so env changes take effect. */
export function resetDbForTest(): void {
  client = null
}
