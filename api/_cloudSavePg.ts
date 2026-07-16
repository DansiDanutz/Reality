import { db } from './_db.js'

type SqlClient = { query: (statement: string, params?: unknown[]) => Promise<unknown> }

export const CLOUD_SAVE_WRITE_SQL = `
  SELECT reality_save_cloud_snapshot($1, $2, $3::jsonb) AS accepted
`.trim()

export const CLOUD_SAVE_READ_SQL = `
  SELECT state
  FROM cloud_saves
  WHERE citizen_id = $1
  LIMIT 1
`.trim()

export async function saveCloudSnapshotPg(citizenId: string, savedAt: number, state: unknown, env: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  const sql = db(env) as unknown as SqlClient
  const rows = (await sql.query(CLOUD_SAVE_WRITE_SQL, [citizenId, savedAt, JSON.stringify(state)])) as Array<{ accepted: boolean | string }>
  const accepted = rows[0]?.accepted
  return accepted === true || accepted === 'true'
}

export async function readCloudSnapshotPg(citizenId: string, env: NodeJS.ProcessEnv = process.env): Promise<string | null> {
  const sql = db(env) as unknown as SqlClient
  const rows = (await sql.query(CLOUD_SAVE_READ_SQL, [citizenId])) as Array<{ state: unknown }>
  if (!rows[0]) return null
  return JSON.stringify(rows[0].state)
}
