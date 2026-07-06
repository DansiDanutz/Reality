import type { WorldArea } from './worldSim'
import { decodeWorldAreaSnapshot, encodeWorldAreaSnapshot } from './worldSimCodec'
import type {
  SaveWorldAreaOptions,
  SaveWorldAreaResult,
  WorldAreaRecord,
  WorldAreaRepository,
} from './worldSimServer'

export interface MemoryWorldAreaRepository extends WorldAreaRepository {
  loadAreaRecord: (areaId: string) => Promise<WorldAreaRecord | null>
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
