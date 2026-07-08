import type { WorldArea } from './worldSim'
import { decodeWorldAreaSnapshot, encodeWorldAreaSnapshot } from './worldSimCodec'
import type {
  ListWorldAreaRecordsOptions,
  SaveWorldAreaOptions,
  SaveWorldAreaResult,
  WorldAreaRecord,
  WorldAreaRecordPage,
  WorldAreaRepository,
} from './worldSimServer'

export interface MemoryWorldAreaRepository extends WorldAreaRepository {
  loadAreaRecord: (areaId: string) => Promise<WorldAreaRecord | null>
  listAreaRecords: (options?: ListWorldAreaRecordsOptions) => Promise<WorldAreaRecordPage>
  areaIds: () => string[]
  snapshotOf: (areaId: string) => string | null
  revisionOf: (areaId: string) => string | null
}

export function createMemoryWorldAreaRepository(initialAreas: WorldArea[] = []): MemoryWorldAreaRepository {
  const snapshots = new Map<string, string>()
  const revisions = new Map<string, number>()

  const areaRecord = (areaId: string): WorldAreaRecord | null => {
    const snapshot = snapshots.get(areaId)
    if (!snapshot) return null
    const decoded = decodeWorldAreaSnapshot(snapshot)
    if (!decoded.ok) throw new Error(`invalid persisted world area snapshot: ${decoded.error}`)
    return { area: decoded.area, revision: String(revisions.get(areaId) ?? 0) }
  }

  const storeArea = (area: WorldArea): string => {
    const snapshot = encodeWorldAreaSnapshot(area)
    const decoded = decodeWorldAreaSnapshot(snapshot)
    if (!decoded.ok) throw new Error(`invalid world area snapshot: ${decoded.error}`)
    const nextRevision = (revisions.get(area.id) ?? 0) + 1
    snapshots.set(area.id, snapshot)
    revisions.set(area.id, nextRevision)
    return String(nextRevision)
  }

  const repo: MemoryWorldAreaRepository = {
    async loadArea(areaId: string): Promise<WorldArea | null> {
      return areaRecord(areaId)?.area ?? null
    },

    async loadAreaRecord(areaId: string): Promise<WorldAreaRecord | null> {
      return areaRecord(areaId)
    },

    async listAreaRecords(options: ListWorldAreaRecordsOptions = {}): Promise<WorldAreaRecordPage> {
      const sortedAreaIds = [...snapshots.keys()].sort((a, b) => a.localeCompare(b))
      const cursor = options.cursor?.trim() || null
      const limit = normalizeRecordLimit(options.limit, sortedAreaIds.length)
      const startIndex = cursor ? nextAreaIndexAfterCursor(sortedAreaIds, cursor) : 0
      const selectedAreaIds = limit > 0 ? sortedAreaIds.slice(startIndex, startIndex + limit) : []
      const hasMore = limit > 0 && startIndex + selectedAreaIds.length < sortedAreaIds.length
      return {
        records: selectedAreaIds
          .map((areaId) => {
            const record = areaRecord(areaId)
            if (!record) throw new Error(`missing stored world area: ${areaId}`)
            return record
          }),
        cursor,
        nextCursor: hasMore ? selectedAreaIds[selectedAreaIds.length - 1] ?? null : null,
        hasMore,
      }
    },

    async loadAreaByFounder(founderCitizenId: string): Promise<WorldAreaRecord | null> {
      for (const areaId of snapshots.keys()) {
        const record = areaRecord(areaId)
        if (record?.area.claim?.founderCitizenId === founderCitizenId) return record
      }
      return null
    },

    async saveArea(area: WorldArea, options: SaveWorldAreaOptions = {}): Promise<SaveWorldAreaResult> {
      const currentRevision = revisions.get(area.id)
      if (options.expectedRevision === null && currentRevision !== undefined) {
        return { ok: false, error: 'write_conflict' }
      }
      if (
        options.expectedRevision !== undefined &&
        options.expectedRevision !== null &&
        String(currentRevision ?? 0) !== options.expectedRevision
      ) {
        return { ok: false, error: 'write_conflict' }
      }
      if (options.expectedFounderAreaEmpty) {
        for (const areaId of snapshots.keys()) {
          const record = areaRecord(areaId)
          if (record?.area.claim?.founderCitizenId === options.expectedFounderAreaEmpty && areaId !== area.id) {
            return { ok: false, error: 'write_conflict' }
          }
        }
      }

      return { ok: true, revision: storeArea(area) }
    },

    areaIds(): string[] {
      return [...snapshots.keys()].sort((a, b) => a.localeCompare(b))
    },

    snapshotOf(areaId: string): string | null {
      return snapshots.get(areaId) ?? null
    },

    revisionOf(areaId: string): string | null {
      const revision = revisions.get(areaId)
      return revision === undefined ? null : String(revision)
    },
  }

  for (const area of initialAreas) storeArea(area)
  return repo
}

function normalizeRecordLimit(limit: number | undefined, fallback: number): number {
  if (limit === undefined) return fallback
  if (!Number.isFinite(limit) || limit <= 0) return 0
  return Math.floor(limit)
}

function nextAreaIndexAfterCursor(sortedAreaIds: readonly string[], cursor: string): number {
  const exactIndex = sortedAreaIds.indexOf(cursor)
  if (exactIndex >= 0) return exactIndex + 1
  const insertionIndex = sortedAreaIds.findIndex((areaId) => areaId.localeCompare(cursor) > 0)
  return insertionIndex >= 0 ? insertionIndex : sortedAreaIds.length
}
