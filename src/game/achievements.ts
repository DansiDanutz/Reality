import type { Activity } from './engine'
import type { Needs, PlacedAsset } from './types'

/**
 * Achievements — the long-term completionist grid (issue: retention).
 *
 * Where the tutorial is one-pass onboarding ("first shift"), achievements are
 * the *tiered* lifetime ladder: bronze → silver → gold, across every system in
 * the game. The hook is the completionist drive — there is always one more rung,
 * always a partially-filled category nagging at the player to come back.
 *
 * Pure: takes a snapshot, returns whether each achievement is unlocked. The
 * store grants the XP + cash bounty once per achievement (idempotent by id).
 */

export interface AchievementSnapshot {
  timesEaten: number
  timesSlept: number
  timesStudied: number
  timesCommunity: number
  shiftsWorked: number
  jobId: string | null
  assets: PlacedAsset[]
  businesses: number
  /** Highest upgrade level reached across all businesses (1 if none owned/upgraded). */
  maxBusinessLevel: number
  totalCollected: number
  netWorth: number
  level: number
  /** Days since citizen creation (real time) */
  daysLived: number
  /** Distinct catalog items ever owned (inventory + assets + pets) */
  distinctItemsOwned: number
  /** Has the citizen ever cooked a meal at home? */
  hasCooked: boolean
  /** True once the citizen owns any pet */
  hasPet: boolean
  /** True once the citizen has generated an avatar in the Profile studio */
  hasAvatar: boolean
  activity: Activity | null
  needs: Needs
}

export type AchievementTier = 'bronze' | 'silver' | 'gold'

export type AchievementCategory =
  | 'survival' // staying alive
  | 'career' // work & promotion
  | 'wealth' // money & property
  | 'lifestyle' // living well
  | 'collector' // owning things
  | 'veteran' // time-in-world

export interface Achievement {
  id: string
  title: string
  detail: string
  category: AchievementCategory
  tier: AchievementTier
  /** XP granted on unlock — scales with tier */
  xp: number
  /** Small cash bounty on unlock (the society pays its achievers) */
  bounty: number
  isUnlocked: (s: AchievementSnapshot) => boolean
  /**
   * Optional numeric progress toward unlock. When present, the UI renders a
   * progress bar (`current / target`); when absent, the achievement is
   * treated as binary (locked/unlocked only).
   *
   * MUST agree with `isUnlocked`: for every snapshot, `progress(s).current >=
   * progress(s).target` iff `isUnlocked(s)`. A drift-guard test enforces this.
   */
  progress?: (s: AchievementSnapshot) => { current: number; target: number }
}

export const CATEGORY_META: Record<AchievementCategory, { label: string; icon: string }> = {
  survival: { label: 'Survival', icon: '❤️' },
  career: { label: 'Career', icon: '💼' },
  wealth: { label: 'Wealth', icon: '💰' },
  lifestyle: { label: 'Lifestyle', icon: '🌅' },
  collector: { label: 'Collector', icon: '🎒' },
  veteran: { label: 'Veteran', icon: '⭐' },
}

export const TIER_META: Record<AchievementTier, { label: string; icon: string; tone: 'ok' | 'gold' | 'sky' }> = {
  bronze: { label: 'Bronze', icon: '🥉', tone: 'ok' },
  silver: { label: 'Silver', icon: '🥈', tone: 'sky' },
  gold: { label: 'Gold', icon: '🥇', tone: 'gold' },
}

/**
 * The achievement grid. Ordered by category, then tier — the panel renders
 * this as a completionist map. Tiers within a category escalate, so a player
 * who got bronze in "Career" sees silver and gold dangling just ahead.
 *
 * Tuning philosophy: bronze is reachable in the first session (hook), silver
 * in the first week (retention), gold is a long-term grail (the "I'll come
 * back for that" drive). Every category must have at least one easy entry.
 */
export const ACHIEVEMENTS: Achievement[] = [
  // ── Survival ────────────────────────────────────────────
  {
    id: 'survivor-1',
    title: 'Survivor',
    detail: 'Stay alive your first full real day.',
    category: 'survival', tier: 'bronze', xp: 50, bounty: 100,
    isUnlocked: (s) => s.daysLived >= 1,
    progress: (s) => ({ current: s.daysLived, target: 1 }),
  },
  {
    id: 'survivor-7',
    title: 'A Week Alive',
    detail: 'Survive seven real days. Most citizens don\'t come back this far.',
    category: 'survival', tier: 'silver', xp: 200, bounty: 1000,
    isUnlocked: (s) => s.daysLived >= 7,
    progress: (s) => ({ current: s.daysLived, target: 7 }),
  },
  {
    id: 'survivor-30',
    title: 'A Month in Reality',
    detail: 'Thirty real days. You live here now.',
    category: 'survival', tier: 'gold', xp: 1000, bounty: 10000,
    isUnlocked: (s) => s.daysLived >= 30,
    progress: (s) => ({ current: s.daysLived, target: 30 }),
  },
  {
    id: 'well-fed',
    title: 'Well Fed',
    detail: 'Eat 25 meals.',
    category: 'survival', tier: 'bronze', xp: 75, bounty: 200,
    isUnlocked: (s) => s.timesEaten >= 25,
    progress: (s) => ({ current: s.timesEaten, target: 25 }),
  },
  {
    id: 'rested-soul',
    title: 'Rested Soul',
    detail: 'Sleep 25 nights.',
    category: 'survival', tier: 'silver', xp: 150, bounty: 500,
    isUnlocked: (s) => s.timesSlept >= 25,
    progress: (s) => ({ current: s.timesSlept, target: 25 }),
  },

  // ── Career ──────────────────────────────────────────────
  {
    id: 'first-shift',
    title: 'First Day on the Job',
    detail: 'Complete your first shift.',
    category: 'career', tier: 'bronze', xp: 50, bounty: 50,
    isUnlocked: (s) => s.shiftsWorked >= 1,
    progress: (s) => ({ current: s.shiftsWorked, target: 1 }),
  },
  {
    id: 'reliable',
    title: 'Reliable',
    detail: 'Work 10 shifts. Show up, every day.',
    category: 'career', tier: 'silver', xp: 200, bounty: 750,
    isUnlocked: (s) => s.shiftsWorked >= 10,
    progress: (s) => ({ current: s.shiftsWorked, target: 10 }),
  },
  {
    id: 'workhorse',
    title: 'Workhorse',
    detail: 'Work 50 shifts. The city runs on you.',
    category: 'career', tier: 'gold', xp: 800, bounty: 5000,
    isUnlocked: (s) => s.shiftsWorked >= 50,
    progress: (s) => ({ current: s.shiftsWorked, target: 50 }),
  },
  {
    id: 'hired-gun',
    title: 'Hired Gun',
    detail: 'Hold any job.',
    category: 'career', tier: 'bronze', xp: 25, bounty: 50,
    isUnlocked: (s) => s.jobId !== null,
  },

  // ── Wealth ──────────────────────────────────────────────
  {
    id: 'first-dollar',
    title: 'First Dollar',
    detail: 'Collect any business income.',
    category: 'wealth', tier: 'bronze', xp: 50, bounty: 100,
    isUnlocked: (s) => s.totalCollected > 0,
  },
  {
    id: 'hustler',
    title: 'Hustler',
    detail: 'Collect $10,000 in total income.',
    category: 'wealth', tier: 'silver', xp: 200, bounty: 1000,
    isUnlocked: (s) => s.totalCollected >= 10_000,
    progress: (s) => ({ current: s.totalCollected, target: 10_000 }),
  },
  {
    id: 'tycoon',
    title: 'Tycoon',
    detail: 'Collect $1,000,000 in total income.',
    category: 'wealth', tier: 'gold', xp: 1500, bounty: 25000,
    isUnlocked: (s) => s.totalCollected >= 1_000_000,
    progress: (s) => ({ current: s.totalCollected, target: 1_000_000 }),
  },
  {
    id: 'first-home',
    title: 'Homeowner',
    detail: 'Own any home.',
    category: 'wealth', tier: 'bronze', xp: 75, bounty: 250,
    isUnlocked: (s) => s.assets.some((a) => a.kind === 'home'),
  },
  {
    id: 'workers-hall',
    title: 'Hiring Floor',
    detail: 'Build a Workers Hall.',
    category: 'wealth', tier: 'silver', xp: 250, bounty: 2000,
    isUnlocked: (s) => s.assets.some((a) => a.itemId === 'workers_hall'),
    progress: (s) => ({ current: s.assets.some((a) => a.itemId === 'workers_hall') ? 1 : 0, target: 1 }),
  },
  {
    id: 'mogul',
    title: 'Mogul',
    detail: 'Reach $1,000,000 net worth.',
    category: 'wealth', tier: 'gold', xp: 1000, bounty: 15000,
    isUnlocked: (s) => s.netWorth >= 1_000_000,
    progress: (s) => ({ current: s.netWorth, target: 1_000_000 }),
  },

  // ── Lifestyle ───────────────────────────────────────────
  {
    id: 'well-lived',
    title: 'Well Lived',
    detail: 'Reach level 5.',
    category: 'lifestyle', tier: 'bronze', xp: 100, bounty: 300,
    isUnlocked: (s) => s.level >= 5,
    progress: (s) => ({ current: s.level, target: 5 }),
  },
  {
    id: 'established',
    title: 'Established',
    detail: 'Reach level 10.',
    category: 'lifestyle', tier: 'silver', xp: 300, bounty: 1500,
    isUnlocked: (s) => s.level >= 10,
    progress: (s) => ({ current: s.level, target: 10 }),
  },
  {
    id: 'pillar',
    title: 'Pillar of Society',
    detail: 'Reach level 20.',
    category: 'lifestyle', tier: 'gold', xp: 1200, bounty: 20000,
    isUnlocked: (s) => s.level >= 20,
    progress: (s) => ({ current: s.level, target: 20 }),
  },
  {
    id: 'grocer',
    title: 'Grocer',
    detail: 'Buy groceries for your home kitchen.',
    category: 'lifestyle', tier: 'bronze', xp: 75, bounty: 150,
    isUnlocked: (s) => s.hasCooked,
  },
  {
    id: 'pet-parent',
    title: 'Pet Parent',
    detail: 'Adopt any pet.',
    category: 'lifestyle', tier: 'bronze', xp: 75, bounty: 150,
    isUnlocked: (s) => s.hasPet,
  },
  {
    id: 'face-of-reality',
    title: 'Face of Reality',
    detail: 'Generate your avatar.',
    category: 'lifestyle', tier: 'bronze', xp: 50, bounty: 100,
    isUnlocked: (s) => s.hasAvatar,
  },

  // ── Collector ───────────────────────────────────────────
  {
    id: 'collector-10',
    title: 'Starting a Collection',
    detail: 'Own 10 distinct items.',
    category: 'collector', tier: 'bronze', xp: 100, bounty: 400,
    isUnlocked: (s) => s.distinctItemsOwned >= 10,
    progress: (s) => ({ current: s.distinctItemsOwned, target: 10 }),
  },
  {
    id: 'collector-25',
    title: 'Curator',
    detail: 'Own 25 distinct items.',
    category: 'collector', tier: 'silver', xp: 250, bounty: 1200,
    isUnlocked: (s) => s.distinctItemsOwned >= 25,
    progress: (s) => ({ current: s.distinctItemsOwned, target: 25 }),
  },
  {
    id: 'collector-50',
    title: 'Completionist',
    detail: 'Own 50 distinct items.',
    category: 'collector', tier: 'gold', xp: 1000, bounty: 10000,
    isUnlocked: (s) => s.distinctItemsOwned >= 50,
    progress: (s) => ({ current: s.distinctItemsOwned, target: 50 }),
  },

  // ── Veteran ─────────────────────────────────────────────
  {
    id: 'business-owner',
    title: 'Business Owner',
    detail: 'Open your first business.',
    category: 'veteran', tier: 'bronze', xp: 100, bounty: 500,
    isUnlocked: (s) => s.businesses >= 1,
    progress: (s) => ({ current: s.businesses, target: 1 }),
  },
  {
    id: 'empire-3',
    title: 'Small Empire',
    detail: 'Own 3 businesses.',
    category: 'veteran', tier: 'silver', xp: 300, bounty: 2000,
    isUnlocked: (s) => s.businesses >= 3,
    progress: (s) => ({ current: s.businesses, target: 3 }),
  },
  {
    id: 'empire-10',
    title: 'Empire Builder',
    detail: 'Own 10 businesses.',
    category: 'veteran', tier: 'gold', xp: 1500, bounty: 30000,
    isUnlocked: (s) => s.businesses >= 10,
    progress: (s) => ({ current: s.businesses, target: 10 }),
  },
  {
    id: 'upgrader-3',
    title: 'Tastemaker',
    detail: 'Upgrade any business to level 3.',
    category: 'veteran', tier: 'silver', xp: 250, bounty: 1500,
    isUnlocked: (s) => s.maxBusinessLevel >= 3,
    progress: (s) => ({ current: s.maxBusinessLevel, target: 3 }),
  },
  {
    id: 'upgrader-5',
    title: 'Empire of One',
    detail: 'Upgrade any business to level 5 — the long-term grind.',
    category: 'veteran', tier: 'gold', xp: 1000, bounty: 15000,
    isUnlocked: (s) => s.maxBusinessLevel >= 5,
    progress: (s) => ({ current: s.maxBusinessLevel, target: 5 }),
  },
]

/** All achievement ids that are currently unlocked for this snapshot */
export function unlockedAchievements(s: AchievementSnapshot): string[] {
  return ACHIEVEMENTS.filter((a) => a.isUnlocked(s)).map((a) => a.id)
}

/** Newly-unlocked achievements (not yet claimed) — what the store grants rewards for */
export function newlyUnlocked(s: AchievementSnapshot, alreadyClaimed: string[]): Achievement[] {
  return ACHIEVEMENTS.filter((a) => a.isUnlocked(s) && !alreadyClaimed.includes(a.id))
}
