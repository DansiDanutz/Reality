import { db } from './_db.js'

type SqlClient = { query: (statement: string, params?: unknown[]) => Promise<unknown> }

export type FounderAreaPgRow = {
  citizenId: string
  areaId: string
  revision: number
  simulationAt: string | null
  updatedAt: string
  state: unknown
}

export type FounderAreaPgListPage = {
  citizenIds: string[]
  hasMore: boolean
  nextCursor: string | undefined
}

export const FOUNDER_AREA_SELECT_SQL = `
  SELECT citizen_id, area_id, revision, simulation_at, updated_at, state
  FROM founder_area_snapshots
  WHERE citizen_id = $1
  LIMIT 1
`.trim()

export const FOUNDER_AREA_SAVE_SQL = `
  SELECT reality_save_founder_area($1, $2, $3, $4::jsonb, $5, $6) AS revision
`.trim()

export const FOUNDER_AREA_LIST_SQL = `
  SELECT citizen_id
  FROM founder_area_snapshots
  WHERE citizen_id > $2
  ORDER BY citizen_id
  LIMIT $1
`.trim()

export function founderAreaPgEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.REALITY_FOUNDER_AREA_POSTGRES === '1'
}

export async function readFounderAreaPg(
  citizenId: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<FounderAreaPgRow | null> {
  const sql = db(env) as unknown as SqlClient
  const rows = (await sql.query(FOUNDER_AREA_SELECT_SQL, [citizenId])) as Array<{
    citizen_id: string
    area_id: string
    revision: number | string
    simulation_at: Date | string | null
    updated_at: Date | string
    state: unknown
  }>
  const row = rows[0]
  if (!row) return null
  return {
    citizenId: row.citizen_id,
    areaId: row.area_id,
    revision: Number(row.revision),
    simulationAt: row.simulation_at ? new Date(row.simulation_at).toISOString() : null,
    updatedAt: new Date(row.updated_at).toISOString(),
    state: row.state,
  }
}

export async function saveFounderAreaPg(
  row: Omit<FounderAreaPgRow, 'revision'>,
  expectedRevision: number,
  env: NodeJS.ProcessEnv = process.env,
): Promise<number> {
  const sql = db(env) as unknown as SqlClient
  const rows = (await sql.query(FOUNDER_AREA_SAVE_SQL, [
    row.citizenId,
    row.areaId,
    expectedRevision,
    JSON.stringify(row.state),
    row.simulationAt,
    row.updatedAt,
  ])) as Array<{ revision: number | string }>
  const revision = Number(rows[0]?.revision)
  if (!Number.isInteger(revision) || revision < 1) throw new Error('founder_area_revision_missing')
  return revision
}

export async function listFounderAreaPg(
  limit: number,
  cursor: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): Promise<FounderAreaPgListPage> {
  const pageSize = Math.max(1, Math.min(100, Math.floor(limit)))
  const after = cursor ?? ''
  const sql = db(env) as unknown as SqlClient
  const rows = (await sql.query(FOUNDER_AREA_LIST_SQL, [pageSize + 1, after])) as Array<{ citizen_id: string }>
  const citizenIds = rows.slice(0, pageSize).map((row) => row.citizen_id)
  const hasMore = rows.length > pageSize
  return {
    citizenIds,
    hasMore,
    nextCursor: hasMore ? citizenIds.at(-1) : undefined,
  }
}
