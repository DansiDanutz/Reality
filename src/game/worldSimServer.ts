import {
  advanceWorldArea,
  applyWorldIntent,
  areaNeedsDashboard,
  claimWorldArea,
  FOUNDER_STARTING_BALANCE,
  type AdvanceWorldAreaResult,
  type AreaNeedsDashboard,
  type ClaimWorldAreaError,
  type WorldArea,
  type WorldAreaClaim,
  type WorldCitizen,
  type WorldIntent,
  type WorldIntentError,
  type WorldTransaction,
} from './worldSim'

export interface WorldAreaRepository {
  loadArea: (areaId: string) => Promise<WorldArea | null>
  saveArea: (area: WorldArea) => Promise<void>
}

export type WorldServerCommand =
  | {
    type: 'createClaimedArea'
    areaId: string
    name: string
    now: number
    authenticatedFounderId: string
    founder: WorldCitizen
    claim: WorldAreaClaim
  }
  | {
    type: 'advance'
    areaId: string
    now: number
  }
  | {
    type: 'applyIntent'
    areaId: string
    now: number
    authenticatedCitizenId: string
    intent: WorldIntent
  }

export type WorldServerCommandError =
  | 'area_exists'
  | 'area_not_found'
  | 'invalid_area_identity'
  | 'founder_mismatch'
  | 'actor_mismatch'
  | 'time_moved_backward'
  | ClaimWorldAreaError
  | WorldIntentError

export type WorldServerCommandResult =
  | {
    ok: true
    area: WorldArea
    dashboard: AreaNeedsDashboard
    summary?: AdvanceWorldAreaResult['summary']
  }
  | {
    ok: false
    error: WorldServerCommandError
    area?: WorldArea
    dashboard?: AreaNeedsDashboard
    summary?: AdvanceWorldAreaResult['summary']
  }

export async function runWorldServerCommand(
  repo: WorldAreaRepository,
  command: WorldServerCommand,
): Promise<WorldServerCommandResult> {
  switch (command.type) {
    case 'createClaimedArea':
      return createClaimedArea(repo, command)
    case 'advance':
      return advanceStoredArea(repo, command.areaId, command.now)
    case 'applyIntent':
      return applyIntentToStoredArea(repo, command.areaId, command.now, command.authenticatedCitizenId, command.intent)
  }
}

async function createClaimedArea(
  repo: WorldAreaRepository,
  command: Extract<WorldServerCommand, { type: 'createClaimedArea' }>,
): Promise<WorldServerCommandResult> {
  if (
    command.founder.id !== command.authenticatedFounderId ||
    command.claim.founderCitizenId !== command.authenticatedFounderId
  ) {
    return { ok: false, error: 'founder_mismatch' }
  }
  const areaId = command.areaId.trim()
  const name = command.name.trim()
  if (!areaId || !name) return { ok: false, error: 'invalid_area_identity' }

  if (await repo.loadArea(areaId)) return { ok: false, error: 'area_exists' }

  const seed: WorldArea = {
    id: areaId,
    name,
    now: command.now,
    citizens: [newAreaFounder(command.founder)],
    businesses: [],
    transactions: [founderCreditTransaction(areaId, command.now, command.founder)],
  }
  const claimed = claimWorldArea(seed, command.claim)
  if (!claimed.ok) return { ok: false, error: claimed.error, area: claimed.area, dashboard: areaNeedsDashboard(claimed.area) }

  await repo.saveArea(claimed.area)
  return { ok: true, area: claimed.area, dashboard: areaNeedsDashboard(claimed.area) }
}

async function advanceStoredArea(
  repo: WorldAreaRepository,
  areaId: string,
  now: number,
): Promise<WorldServerCommandResult> {
  const normalizedAreaId = areaId.trim()
  if (!normalizedAreaId) return { ok: false, error: 'invalid_area_identity' }

  const area = await repo.loadArea(normalizedAreaId)
  if (!area) return { ok: false, error: 'area_not_found' }
  if (now < area.now) return { ok: false, error: 'time_moved_backward', area, dashboard: areaNeedsDashboard(area) }

  const advanced = advanceWorldArea(area, now)
  await repo.saveArea(advanced.area)
  return {
    ok: true,
    area: advanced.area,
    dashboard: areaNeedsDashboard(advanced.area),
    summary: advanced.summary,
  }
}

function founderCreditTransaction(areaId: string, at: number, founder: WorldCitizen): WorldTransaction {
  return {
    id: `${areaId}:${at}:1:founder_credit`,
    at,
    kind: 'founder_credit',
    fromId: 'system:founder-credit',
    toId: founder.id,
    amount: FOUNDER_STARTING_BALANCE,
    memo: `${founder.name} received founder starting game credit.`,
  }
}

function newAreaFounder(founder: WorldCitizen): WorldCitizen {
  return {
    id: founder.id,
    name: founder.name,
    kind: founder.kind,
    money: FOUNDER_STARTING_BALANCE,
    debt: 0,
    needs: { ...founder.needs },
    health: founder.health,
    state: { kind: 'active' },
  }
}

async function applyIntentToStoredArea(
  repo: WorldAreaRepository,
  areaId: string,
  now: number,
  authenticatedCitizenId: string,
  intent: WorldIntent,
): Promise<WorldServerCommandResult> {
  if (intent.actorCitizenId !== authenticatedCitizenId) {
    return { ok: false, error: 'actor_mismatch' }
  }

  const advanced = await advanceStoredArea(repo, areaId, now)
  if (!advanced.ok) return advanced

  const applied = applyWorldIntent(advanced.area, intent)
  if (!applied.ok) {
    return {
      ok: false,
      error: applied.error,
      area: advanced.area,
      dashboard: advanced.dashboard,
      summary: advanced.summary,
    }
  }

  await repo.saveArea(applied.area)
  return {
    ok: true,
    area: applied.area,
    dashboard: areaNeedsDashboard(applied.area),
    summary: advanced.summary,
  }
}
