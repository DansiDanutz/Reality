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
  actionsToday: number
  actionDay: number
  reliableShifts: number
  workRespectDay: number
  workRespectToday: number
  seriousWorkStreak: number
  seriousWorkBest: number
  seriousWorkLastDay: number
}

const DAY_MS = 24 * 3_600_000
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

export function communityDay(now = Date.now()): number {
  return Math.floor(now / DAY_MS)
}

export function freshCommunityStats(now = Date.now()): CommunityStats {
  return {
    respect: 0,
    friendship: 0,
    trust: 0,
    actionsThisWeek: 0,
    week: communityWeek(now),
    actionsToday: 0,
    actionDay: communityDay(now),
    reliableShifts: 0,
    workRespectDay: communityDay(now),
    workRespectToday: 0,
    seriousWorkStreak: 0,
    seriousWorkBest: 0,
    seriousWorkLastDay: 0,
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
    actionsToday: Math.max(0, Math.floor(stats.actionsToday ?? 0)),
    actionDay: Number.isFinite(stats.actionDay) ? Math.floor(stats.actionDay ?? communityDay(now)) : communityDay(now),
    reliableShifts: Math.max(0, Math.floor(stats.reliableShifts ?? 0)),
    workRespectDay: Number.isFinite(stats.workRespectDay) ? Math.floor(stats.workRespectDay ?? communityDay(now)) : communityDay(now),
    workRespectToday: Math.max(0, Math.floor(stats.workRespectToday ?? 0)),
    seriousWorkStreak: Math.max(0, Math.floor(stats.seriousWorkStreak ?? 0)),
    seriousWorkBest: Math.max(0, Math.floor(stats.seriousWorkBest ?? 0)),
    seriousWorkLastDay: Number.isFinite(stats.seriousWorkLastDay) ? Math.max(0, Math.floor(stats.seriousWorkLastDay ?? 0)) : 0,
  }
}

export function resetCommunityWeekIfNeeded(stats: CommunityStats, now = Date.now()): CommunityStats {
  const week = communityWeek(now)
  return stats.week === week ? stats : { ...stats, actionsThisWeek: 0, week }
}

export function resetCommunityWorkDayIfNeeded(stats: CommunityStats, now = Date.now()): CommunityStats {
  const day = communityDay(now)
  return stats.workRespectDay === day ? stats : { ...stats, workRespectDay: day, workRespectToday: 0 }
}

export function resetCommunityActionDayIfNeeded(stats: CommunityStats, now = Date.now()): CommunityStats {
  const day = communityDay(now)
  return stats.actionDay === day ? stats : { ...stats, actionDay: day, actionsToday: 0 }
}

export function canStartCommunityAction(stats: CommunityStats, now = Date.now()): boolean {
  return resetCommunityActionDayIfNeeded(stats, now).actionsToday <= 0
}

export function communityActionById(actionId: CommunityActionId): CommunityAction | null {
  return COMMUNITY_ACTIONS.find((action) => action.id === actionId) ?? null
}

export function completeCommunityAction(stats: CommunityStats, action: CommunityAction, now = Date.now()): CommunityStats {
  const current = resetCommunityActionDayIfNeeded(resetCommunityWeekIfNeeded(stats, now), now)
  if (current.actionsToday > 0) return current
  return {
    ...current,
    respect: current.respect + action.rewards.respect,
    friendship: current.friendship + action.rewards.friendship,
    trust: current.trust + action.rewards.trust,
    actionsThisWeek: current.actionsThisWeek + 1,
    actionsToday: current.actionsToday + 1,
  }
}

export function completeReliableShift(stats: CommunityStats, now = Date.now()): CommunityStats {
  const current = resetCommunityWorkDayIfNeeded(stats, now)
  const respectGained = current.workRespectToday > 0 ? 0 : 1
  const day = communityDay(now)
  const seriousWorkStreak =
    current.seriousWorkLastDay === day
      ? current.seriousWorkStreak
      : current.seriousWorkLastDay === day - 1
        ? current.seriousWorkStreak + 1
        : 1
  return {
    ...current,
    respect: current.respect + respectGained,
    trust: current.trust + respectGained,
    reliableShifts: current.reliableShifts + 1,
    workRespectToday: current.workRespectToday + respectGained,
    seriousWorkStreak,
    seriousWorkBest: Math.max(current.seriousWorkBest, seriousWorkStreak),
    seriousWorkLastDay: day,
  }
}

export function missedSeriousWorkYesterday(stats: CommunityStats, now = Date.now()): boolean {
  const day = communityDay(now)
  if (stats.reliableShifts <= 0 || stats.seriousWorkLastDay <= 0) return false
  return stats.seriousWorkLastDay < day - 1
}
