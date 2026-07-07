export interface WorldPlacementAsset {
  id: string
}

export interface WorldPlacementItem {
  name: string
  price: number
}

export interface WorldPlacementDailyCounters {
  mealsToday: number
  shiftsToday: number
  earnedToday: number
  sleptToday: number
  boughtToday: number
  day: number
}

export type WorldPlacementRejectionCode =
  | 'area_not_claimed'
  | 'placement_outside_area'
  | 'area_owner_mismatch'
  | 'area_claim_invalid'
  | 'not_registered'
  | 'invalid_asset'
  | 'world_unavailable'
  | 'server_rejected'

export type WorldPlacementSettlement =
  | { kind: 'accepted' }
  | { kind: 'offline_unverified' }
  | { kind: 'rejected'; code: WorldPlacementRejectionCode; message: string }

export interface RejectedWorldPlacementRollbackInput<TAsset extends WorldPlacementAsset, TItem extends WorldPlacementItem> {
  assets: readonly TAsset[]
  placing: TItem | null
  item: TItem
  assetId: string
  dailyCounters: WorldPlacementDailyCounters
  previousDailyCounters: WorldPlacementDailyCounters
  optimisticDailyCounters: WorldPlacementDailyCounters
  rejection: Extract<WorldPlacementSettlement, { kind: 'rejected' }>
}

export interface RejectedWorldPlacementRollback<TAsset extends WorldPlacementAsset, TItem extends WorldPlacementItem> {
  assets: TAsset[]
  placing: TItem | null
  dailyCounters: WorldPlacementDailyCounters
  refund: number
  message: string
  changed: boolean
}

export function settleWorldPlacementResponse(response: Record<string, unknown> | null): WorldPlacementSettlement {
  if (response === null) return { kind: 'offline_unverified' }
  if (response.ok !== false) return { kind: 'accepted' }

  const code = worldPlacementRejectionCode(response)
  return {
    kind: 'rejected',
    code,
    message: worldPlacementRejectionMessage(code),
  }
}

export function rollbackRejectedWorldPlacement<TAsset extends WorldPlacementAsset, TItem extends WorldPlacementItem>(
  input: RejectedWorldPlacementRollbackInput<TAsset, TItem>,
): RejectedWorldPlacementRollback<TAsset, TItem> {
  const assets = input.assets.filter((asset) => asset.id !== input.assetId)
  const removedAsset = assets.length !== input.assets.length
  const canRestorePlacing = input.placing === null
  const placing = removedAsset && canRestorePlacing ? input.item : input.placing
  const dailyCounters = removedAsset && sameDailyCounters(input.dailyCounters, input.optimisticDailyCounters)
    ? input.previousDailyCounters
    : input.dailyCounters
  const refund = removedAsset && !canRestorePlacing ? input.item.price : 0

  return {
    assets,
    placing,
    dailyCounters,
    refund,
    message: input.rejection.message,
    changed: removedAsset ||
      refund > 0 ||
      !sameDailyCounters(dailyCounters, input.dailyCounters),
  }
}

function worldPlacementRejectionCode(response: Record<string, unknown>): WorldPlacementRejectionCode {
  switch (response.code) {
    case 'area_not_claimed':
    case 'placement_outside_area':
    case 'area_owner_mismatch':
    case 'area_claim_invalid':
      return response.code
    default:
      break
  }

  switch (response.error) {
    case 'Not a registered citizen.':
      return 'not_registered'
    case 'Invalid asset.':
      return 'invalid_asset'
    case 'The world is briefly unavailable.':
      return 'world_unavailable'
    default:
      return 'server_rejected'
  }
}

function worldPlacementRejectionMessage(code: WorldPlacementRejectionCode): string {
  switch (code) {
    case 'area_not_claimed':
      return 'Claim your founder area before placing shared-world assets.'
    case 'placement_outside_area':
      return 'Place this asset inside your claimed founder area.'
    case 'area_owner_mismatch':
      return 'This claimed area belongs to another founder.'
    case 'area_claim_invalid':
      return 'Your founder area claim needs manual review before placement.'
    case 'not_registered':
      return 'Register your citizen before placing shared-world assets.'
    case 'invalid_asset':
      return 'This asset cannot be placed by the server.'
    case 'world_unavailable':
      return 'The world server is briefly unavailable; try placing again.'
    case 'server_rejected':
      return 'The server rejected this placement.'
  }
}

function sameDailyCounters(a: WorldPlacementDailyCounters, b: WorldPlacementDailyCounters): boolean {
  return a.mealsToday === b.mealsToday &&
    a.shiftsToday === b.shiftsToday &&
    a.earnedToday === b.earnedToday &&
    a.sleptToday === b.sleptToday &&
    a.boughtToday === b.boughtToday &&
    a.day === b.day
}
