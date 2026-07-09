import { neon } from '@neondatabase/serverless'

/**
 * Postgres access (Phase 1b, cut over in issue #902). Underscore prefix
 * keeps Vercel from exposing this file as an endpoint — it is a shared
 * helper for api/ only.
 *
 * Since the Phase 1b.6 cutover, Postgres IS the database: registry, world
 * and leaderboard reads are served from it and the POSTGRES_ENABLED flag is
 * gone. A deployment without a connection string fails loudly at first use.
 */

type NeonClient = ReturnType<typeof neon>

let client: NeonClient | null = null

/** Pooled connection string — the right one for per-request serverless queries. */
export function databaseUrl(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return env.POSTGRES_URL ?? env.DATABASE_URL ?? undefined
}

/** Lazy singleton Neon client. */
export function db(env: NodeJS.ProcessEnv = process.env): NeonClient {
  const url = databaseUrl(env)
  if (!url) {
    throw new Error('POSTGRES_URL (or DATABASE_URL) is not configured')
  }
  if (!client) {
    client = neon(url)
  }
  return client
}

/** Test hook — drops the cached client so env changes take effect. */
export function resetDbForTest(): void {
  client = null
}
