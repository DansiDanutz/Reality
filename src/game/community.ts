import type { Needs } from './types'

export type CommunityActionId = 'check-neighbor' | 'help-errand' | 'block-cleanup'

export interface CommunityAction {
  id: CommunityActionId
  title: string
  detail: string
  minutes: number
  effects: Partial<Needs>
  rewards: {
    respect: number
    friendship: number
    trust: number
    xp: number
  }
}

export interface CommunityStats {
  respect: number
  friendship: number
  trust: number
  actionsThisWeek: number
  week: number
}

const WEEK_MS = 7 * 24 * 3_600_000

export const COMMUNITY_ACTIONS: CommunityAction[] = [
  {
    id: 'check-neighbor',
    title: 'Check on a neighbor',
    detail: 'A short visit builds friendship before it ever becomes profit.',
    minutes: 20,
    effects: { energy: -3, fun: 2 },
    rewards: { respect: 1, friendship: 3, trust: 1, xp: 20 },
  },
  {
    id: 'help-errand',
    title: 'Help with an errand',
    detail: 'Carry something, fix something small, show up when asked.',
    minutes: 35,
    effects: { energy: -6, hygiene: -2 },
    rewards: { respect: 2, friendship: 2, trust: 2, xp: 30 },
  },
  {
    id: 'block-cleanup',
    title: 'Clean the block',
    detail: 'Community trust grows when the street is better after you leave.',
    minutes: 50,
    effects: { energy: -9, hygiene: -5, fun: -1 },
    rewards: { respect: 3, friendship: 1, trust: 4, xp: 45 },
  },
]

export function communityWeek(now = Date.now()): number {
  return Math.floor(now / WEEK_MS)
}

export function freshCommunityStats(now = Date.now()): CommunityStats {
  return {
    respect: 0,
    friendship: 0,
    trust: 0,
    actionsThisWeek: 0,
    week: communityWeek(now),
  }
}

export function normalizeCommunityStats(stats: Partial<CommunityStats> | null | undefined, now = Date.now()): CommunityStats {
  if (!stats) return freshCommunityStats(now)
  return {
    respect: Math.max(0, Math.floor(stats.respect ?? 0)),
    friendship: Math.max(0, Math.floor(stats.friendship ?? 0)),
    trust: Math.max(0, Math.floor(stats.trust ?? 0)),
    actionsThisWeek: Math.max(0, Math.floor(stats.actionsThisWeek ?? 0)),
    week: Number.isFinite(stats.week) ? Math.floor(stats.week ?? communityWeek(now)) : communityWeek(now),
  }
}

export function resetCommunityWeekIfNeeded(stats: CommunityStats, now = Date.now()): CommunityStats {
  const week = communityWeek(now)
  return stats.week === week ? stats : { ...stats, actionsThisWeek: 0, week }
}

export function communityActionById(actionId: CommunityActionId): CommunityAction | null {
  return COMMUNITY_ACTIONS.find((action) => action.id === actionId) ?? null
}

export function completeCommunityAction(stats: CommunityStats, action: CommunityAction, now = Date.now()): CommunityStats {
  const current = resetCommunityWeekIfNeeded(stats, now)
  return {
    respect: current.respect + action.rewards.respect,
    friendship: current.friendship + action.rewards.friendship,
    trust: current.trust + action.rewards.trust,
    actionsThisWeek: current.actionsThisWeek + 1,
    week: current.week,
  }
}
