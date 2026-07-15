export const FOUNDER_AREA_SAVE_SQL = `
  SELECT reality_save_founder_area($1, $2, $3, $4::jsonb, $5, $6) AS revision
`.trim()

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function areaStatePathFromBlob(blob) {
  return typeof blob?.pathname === 'string' ? blob.pathname : 'unknown'
}

export function migratableFounderAreaSnapshot(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const state = value
  if (!UUID_RE.test(String(state.founderCitizenId)) || typeof state.areaId !== 'string' || !state.areaId) return null
  if (!Number.isFinite(Number(state.founderNumber)) || !Number.isFinite(Number(state.balance))) return null
  if (!Array.isArray(state.businesses) || !Array.isArray(state.citizens) || !Array.isArray(state.transactions)) return null
  if (typeof state.updatedAt !== 'string' || !Number.isFinite(Date.parse(state.updatedAt))) return null
  const simulationAt = typeof state.simulationAt === 'string' && Number.isFinite(Date.parse(state.simulationAt))
    ? state.simulationAt
    : null
  return {
    citizenId: state.founderCitizenId,
    areaId: state.areaId,
    state,
    simulationAt,
    updatedAt: state.updatedAt,
  }
}

export function isRevisionConflict(error) {
  return typeof error?.message === 'string' && error.message.includes('founder_area_revision_conflict')
}
