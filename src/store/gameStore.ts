import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Citizen, Illness, NeedKey, Needs, Pet, PlacedAsset, ShopItem } from '../game/types'
import {
  GIG_MINUTES,
  GIG_WAGE,
  SHIFT_HOURS,
  SLEEP_HOURS,
  applyEffects,
  applyXp,
  canCook,
  careerRankOf,
  COOK_MINUTES,
  distanceKm,
  feedPet,
  fluBlocksWork,
  formatMoney,
  hasKitchen,
  liveRealtime,
  netWorthOf,
  petFunBonus,
  reachOf,
  rollEvent,
  wageBonusFrom,
  type Activity,
} from '../game/engine'
import type { ShopCategory } from '../game/types'
import { CITIZEN_BALANCE, FOUNDER_BALANCE, itemById, jobById, recipeById } from '../game/catalog'
import { zoneFor } from '../game/clock'
import { TUTORIAL_STEPS } from '../game/tutorial'
import { ACHIEVEMENTS, newlyUnlocked, type AchievementSnapshot } from '../game/achievements'
import { computeStreakClaim, streakLabel, type StreakState } from '../game/streak'
import { rollLuckyMoment, pickFirstLuckyMoment, RARITY_META } from '../game/luckyMoments'
import { MAX_BUSINESS_LEVEL, upgradeOutcome } from '../game/businessUpgrades'
import { MYSTERY_BOXES, openBox, type BoxTier } from '../game/mysteryBox'
import { rollOpportunity, type GoldenOpportunity, OPPORTUNITY_WINDOW_MS } from '../game/goldenOpportunity'
import { BOOSTERS, boosterMultiplier, cleanExpiredBoosters, type BoosterType } from '../game/boosters'
import { advanceCombo, comboBonusXP, comboLabel, COMBO_WINDOW_MS } from '../game/combo'
import {
  type ConstructionProject,
  type ConstructionWorkerId,
  STARTER_HOUSE_RECIPE,
  businessConstructionRecipe,
  completeConstructionProject,
  createConstructionProject,
  createConstructionProjectFromRecipe,
  depositResources,
  hireConstructionWorker as hireConstructionWorkerForProject,
  payPermit,
  addConstructionLabor,
  totalResourceCount,
} from '../game/construction'
import {
  type CourierPackage,
  courierRequirementMet,
  shouldCreateCourierPackage,
} from '../game/courierPackages'
import {
  type ResourceInventory,
  type ResourceNode,
  RESOURCE_META,
  addResources,
  formatResourceList,
  freshResources,
} from '../game/resources'
import { DEFAULT_MAP_ANCHOR } from '../game/mapAnchor'
import {
  challengesForDay,
  challengeProgress,
  challengeSetSummary,
  CHALLENGE_REWARD,
  DAILY_COMPLETE_BONUS,
  type DailyChallengeSnapshot,
} from '../game/dailyChallenges'
import { track } from '../lib/analytics'
import { thoughtForDay } from '../game/thoughts'
import { setSoundVolume as applySoundVolume } from '../lib/sound'
import { type AvatarParams } from '../lib/avatarPrompt'
import { detectLocation, type SpawnLocation } from '../lib/geo'
import {
  authenticateTelegramMiniApp,
  citizenWithTelegramSession,
  telegramDisplayName,
  telegramMiniAppInitData,
} from '../lib/telegram'

export type PanelId = 'shop' | 'work' | 'assets' | 'home' | 'business' | 'founder' | 'operator' | 'top' | 'profile' | 'health' | 'cook' | 'achievements' | 'journal' | 'boxes' | 'construction' | null

export type MapTarget =
  | { kind: 'asset'; id: string }
  | { kind: 'construction'; id: string }

/**
 * Toast tone — drives both the visual toast color and the chime. Widened
 * from the original 4 (gold/sky/ok/meal) to give achievements, lucky
 * moments, streaks, and legendary jackpots their own distinct sound. The
 * sound module's ChimeKind must match this union exactly.
 */
export type ToastTone = 'gold' | 'ok' | 'sky' | 'meal' | 'achieve' | 'streak' | 'lucky' | 'legendary' | 'blocked'

const SAVE_KEY = 'reality-save-v1'

/**
 * The persist schema version. zustand/persist only calls migrateSave when a
 * stored save's version differs from this — adding a persisted field WITHOUT
 * bumping this makes its backfill dead code for every existing save.
 * Exported so migrateSave.test.ts can pin it to the latest migration.
 */
export const SAVE_VERSION = 9

/**
 * Save migration — backfills fields added in later versions onto older
 * persisted states. Extracted from the persist config so it can be tested
 * in isolation (a regression here would silently corrupt every old save).
 *
 * Version history:
 *   v1 → v2: hydration need (default 75)
 *   v2 → v3: pets array (default [])
 *   v3 → v4: illness + lastIllnessRollAt
 *   v4 → v5: streak (length, lastClaimDay, best) + luckyMomentsSeen(+Ids)
 *   v6 → v7: courier packages + resource inventory + construction projects
 *   v7 → v8: construction worker labor ledger
 *   v8 → v9: construction projects produce homes or businesses
 *
 * The function mutates and returns its input (matching zustand/persist's
 * migrate signature). Every field added after v1 MUST have a backfill here,
 * or old saves load with `undefined` and crash at first read.
 */
export function migrateSave(persisted: unknown): GameState {
  // Defensive: localStorage can contain anything (hand-edited, corrupted,
  // a value from a totally different app reusing the key). A thrown migrate
  // would brick the app on load, so bail out cleanly on non-object input
  // and let the store's merge/FRESH logic recover.
  if (persisted === null || typeof persisted !== 'object') {
    return { ...FRESH, citizen: null } as GameState
  }
  const state = persisted as GameState
  if (state?.needs && (state.needs as { hydration?: number }).hydration === undefined) {
    state.needs = { ...state.needs, hydration: 75 }
  }
  if (state && !state.pets) state.pets = []
  if (state && state.illness === undefined) state.illness = null
  if (state && !state.lastIllnessRollAt) state.lastIllnessRollAt = 0
  if (state && state.streakLength === undefined) state.streakLength = 0
  if (state && state.streakLastClaimDay === undefined) state.streakLastClaimDay = 0
  if (state && state.streakBest === undefined) state.streakBest = 0
  if (state && state.luckyMomentsSeen === undefined) state.luckyMomentsSeen = 0
        if (state && !state.luckyMomentsSeenIds) state.luckyMomentsSeenIds = []
        if (state && !state.milestonesCelebrated) state.milestonesCelebrated = []
        if (state && state.mysteryBoxesOpened === undefined) state.mysteryBoxesOpened = 0
        if (state && !state.activeBoosters) state.activeBoosters = []
        if (state && state.combo === undefined) state.combo = 0
        if (state && state.comboLastActionAt === undefined) state.comboLastActionAt = 0
        if (state && state.savingsGoal === undefined) state.savingsGoal = 0
        if (state && state.savingsGoalReached === undefined) state.savingsGoalReached = false
        // sawAchievementsPanel: existing players who've completed the original
        // 8-step tutorial shouldn't be re-nudged to "discover achievements".
        // If they've claimed ≥7 tutorial steps (the original count), mark this
        // as seen so the new 9th step doesn't re-appear for veterans.
        if (state && state.sawAchievementsPanel === undefined) {
          const claimedCount = state.tutorialClaimed?.length ?? 0
          state.sawAchievementsPanel = claimedCount >= 7
        }
        if (state && state.sawStreetMode === undefined) {
          // Veterans who've entered Street Mode before shouldn't see the
          // controls overlay again. We can't know for sure, so default to
          // true (seen) for any citizen past the tutorial, false for new.
          const claimedCount = state.tutorialClaimed?.length ?? 0
          state.sawStreetMode = claimedCount >= 7
        }
        if (state && !state.dailyCounters) {
          state.dailyCounters = { mealsToday: 0, shiftsToday: 0, earnedToday: 0, sleptToday: 0, boughtToday: 0, day: 0 }
        }
        if (state && !state.dailyClaimed) state.dailyClaimed = []
        if (state && state.dailyBonusClaimed === undefined) state.dailyBonusClaimed = false
        if (state && !state.resources) state.resources = freshResources()
        if (state && !state.resourceNodes) state.resourceNodes = []
        if (state && !state.constructionProjects) state.constructionProjects = []
        if (state && state.constructionProjects) {
          state.constructionProjects = state.constructionProjects.map((project) => ({
            ...project,
            itemId: project.itemId ?? STARTER_HOUSE_RECIPE.itemId,
            resultKind: project.resultKind ?? 'home',
            incomePerDay: project.incomePerDay ?? 0,
            hiredLaborMinutes: project.hiredLaborMinutes ?? 0,
          }))
        }
        if (state && state.placingConstruction === undefined) state.placingConstruction = null
        if (state && state.selectedMapTarget === undefined) state.selectedMapTarget = null
        if (state && state.activeCourierPackage === undefined) state.activeCourierPackage = null
        if (state && state.courierLastDay === undefined) state.courierLastDay = 0
        if (state && !state.courierOpenedDays) state.courierOpenedDays = []
        if (state && !state.completedCourierDays) state.completedCourierDays = []
        return state
}

/**
 * Calendar day index in the citizen's local timezone — the basis for the
 * daily streak. Two timestamps on the same local day return the same number;
 * midnight rollover bumps it by one. Uses the same tz-lookup as clock.ts so
 * "today" matches what the player sees on the TopBar clock.
 *
 * Returns days since the Unix epoch in the citizen's local zone. 0 or
 * negative only when `now` is before the first local midnight after epoch,
 * which never happens in practice (the engine treats it as "no claim yet").
 */
function dayIndexOf(now: number, lat?: number, lng?: number): number {
  let zone: string
  try {
    // Inline import avoids a hard dependency cycle (clock.ts pulls in tz-lookup
    // at module load; this keeps the store's hot path explicit).
    zone = lat !== undefined && lng !== undefined ? zoneFor(lat, lng) : Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    zone = 'UTC'
  }
  // YYYY-MM-DD in the local zone → unique per calendar day. Counting days
  // since epoch via Date.UTC keeps the index stable and timezone-independent.
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(now))
  // en-CA gives us ISO-like YYYY-MM-DD which Date.parse understands as UTC.
  return Math.floor(Date.parse(ymd + 'T00:00:00Z') / 86_400_000)
}

/**
 * Milliseconds until the next LOCAL midnight at the citizen's anchor — the
 * companion to dayIndexOf, using the same zone so "today ends" agrees with
 * when the day index actually rolls over. Used by the notification engine
 * (streak-at-risk / daily-incomplete fire in the pre-midnight window).
 */
export function msToLocalMidnight(now: number, lat?: number, lng?: number): number {
  let zone: string
  try {
    zone = lat !== undefined && lng !== undefined ? zoneFor(lat, lng) : Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    zone = 'UTC'
  }
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: zone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(new Date(now))
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
    const elapsedMs = ((get('hour') * 60 + get('minute')) * 60 + get('second')) * 1000
    return 86_400_000 - elapsedMs
  } catch {
    return 86_400_000 - (now % 86_400_000)
  }
}

/** Today's dailyCounters with boughtToday bumped — day-rollover aware. */
function bumpBoughtToday(s: Pick<GameState, 'assets' | 'citizen' | 'dailyCounters'>): GameState['dailyCounters'] {
  const home = s.assets.find((a) => a.kind === 'home')
  const anchorLat = home ? home.lat : s.citizen?.spawnLat
  const anchorLng = home ? home.lng : s.citizen?.spawnLng
  const todayDay = dayIndexOf(Date.now(), anchorLat, anchorLng)
  return s.dailyCounters.day === todayDay
    ? { ...s.dailyCounters, boughtToday: s.dailyCounters.boughtToday + 1 }
    : { mealsToday: 0, shiftsToday: 0, earnedToday: 0, sleptToday: 0, boughtToday: 1, day: todayDay }
}

/**
 * Post to the live world, silently tolerating offline/dev environments.
 * Reports connection health to the store so the offline banner can surface.
 * (Defined before the store; reaches in via useGame.getState() at call time.)
 */
async function tryPost(path: string, body: unknown): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = (await res.json()) as Record<string, unknown>
    useGame.getState().markApiOk()
    return data
  } catch {
    useGame.getState().markApiOffline()
    return null
  }
}

function publishPlacedAsset(citizen: Citizen | null, asset: PlacedAsset): void {
  if (!citizen?.token) return
  void tryPost('/api/world', {
    citizenId: citizen.citizenId,
    token: citizen.token,
    assetId: asset.id,
    itemId: asset.itemId,
    kind: asset.kind,
    lat: asset.lat,
    lng: asset.lng,
  })
}

interface GameState {
  citizen: Citizen | null
  money: number
  needs: Needs
  health: number
  level: number
  xp: number
  jobId: string | null
  shiftsWorked: number
  timesEaten: number
  timesSlept: number
  totalCollected: number
  tutorialClaimed: string[]
  tutorialHidden: boolean
  /** Achievement ids already claimed (XP + bounty granted). Idempotent. */
  achievementsClaimed: string[]
  /** What the citizen is doing right now, in real time */
  activity: Activity | null
  lastSeenAt: number
  inventory: Record<string, number>
  assets: PlacedAsset[]
  /** Construction resources gathered from the map. */
  resources: ResourceInventory
  /** Resource nodes discovered around the citizen's anchor. */
  resourceNodes: ResourceNode[]
  setResourceNodes: (nodes: ResourceNode[]) => void
  /** Active build projects placed on the map before they become assets. */
  constructionProjects: ConstructionProject[]
  /** Pets the citizen owns — each alive on its own hunger meter (issue #9) */
  pets: Pet[]
  /** ms timestamp each grocery id was last restocked — the spoilage clock */
  groceryRestockedAt: Record<string, number>
  /** Item awaiting a map click for placement */
  placing: ShopItem | null
  /** Construction recipe awaiting a map click for placement. */
  placingConstruction: 'starter-house' | null
  /** Map target selected from menus/markers. Drives camera focus. */
  selectedMapTarget: MapTarget | null
  panel: PanelId
  log: string[]
  cloudSyncedAt: number | null
  /** First-person Street Mode (not persisted) */
  streetMode: boolean
  /** Category the Market should open on (set by quick actions) */
  marketFocus: ShopCategory | null
  /** Vital the Market should filter to (set by clicking a Vitals bar) */
  marketNeed: NeedKey | null
  /** Recovery-floor cooldowns */
  lastFountainAt: number
  lastFoodBankAt: number
  /** Active illness — cold or flu, at most one (docs/ILLNESS-RFC.md, #8) */
  illness: Illness | null
  /** ms timestamp of the last daily illness roll */
  lastIllnessRollAt: number
  /** One-time "How Reality works" targets screen */
  targetsSeen: boolean
  /** True once the player has opened the Achievements panel (tutorial discovery) */
  sawAchievementsPanel: boolean
  /** True once the player has entered Street Mode (one-time controls overlay). */
  sawStreetMode: boolean
  /** Daily challenge counters — reset at local midnight. See dailyChallenges.ts */
  dailyCounters: { mealsToday: number; shiftsToday: number; earnedToday: number; sleptToday: number; boughtToday: number; day: number }
  /** Daily challenge ids already claimed today (idempotent — no double-grant). */
  dailyClaimed: string[]
  /** True once today's all-3-complete bonus has been granted. */
  dailyBonusClaimed: boolean
  /** Daily courier package campaign state — one package per local day. */
  activeCourierPackage: CourierPackage | null
  courierLastDay: number
  courierOpenedDays: number[]
  completedCourierDays: number[]
  openCourierPackage: () => void
  completeCourierPackage: () => void
  dismissCourierPackage: () => void
  /** Territorial progression: highest reach tier celebrated so far */
  reachTier: number
  /** Daily streak length (days). 0 before the first claim. See src/game/streak.ts */
  streakLength: number
  /** Calendar day index of the last streak claim. 0 = never claimed. */
  streakLastClaimDay: number
  /** Longest streak this citizen has ever reached — for the "personal best" badge. */
  streakBest: number
  /** Lifetime count of lucky moments witnessed (Loop C) — for the stats panel. */
  luckyMomentsSeen: number
  /** Unique ids of lucky moments ever witnessed — drives the collection view. */
  luckyMomentsSeenIds: string[]
  /** Week milestones already celebrated (1, 2, 4, 8, ...). Prevents re-firing. */
  milestonesCelebrated: number[]
  /** Player-set savings goal (cash target, 0 = none). */
  savingsGoal: number
  /** True once the savings goal was reached + celebrated (idempotent). */
  savingsGoalReached: boolean
  /** Set or clear the savings goal. */
  setSavingsGoal: (target: number) => void
  /** Welcome-back card content after time away (not persisted) */
  awayReport: string | null
  dismissAwayReport: () => void
  /** Transient celebration overlay (not persisted) — set for the biggest moments only. */
  celebration: { icon: string; title: string; detail?: string; reward?: string; tone: 'legendary' | 'gold' | 'level' | 'daily' } | null
  /** Queue of pending celebrations (not persisted) — shown one at a time, FIFO. */
  celebrationQueue: { icon: string; title: string; detail?: string; reward?: string; tone: 'legendary' | 'gold' | 'level' | 'daily' }[]
  dismissCelebration: () => void
  /** Feedback toasts (not persisted) */
  toasts: { id: number; text: string; tone: ToastTone }[]
  popToast: (id: number) => void
  soundOn: boolean
  toggleSound: () => void
  /** Master sound volume 0..1 (persisted). Applied live via setSoundVolume. */
  soundVolume: number
  setSoundVolume: (v: number) => void
  /** Per-type notification opt-ins (only honored when system permission is granted). */
  notificationPrefs: { activity: boolean; streak: boolean; needs: boolean }
  setNotificationPref: (type: 'activity' | 'streak' | 'needs', on: boolean) => void
  /** Connection health (not persisted) — set by /api/* call sites via markApiOk/markApiOffline */
  online: boolean
  /** ms timestamp the user dismissed the current offline banner (not persisted) */
  dismissedOfflineAt: number
  markApiOk: () => void
  markApiOffline: () => void
  dismissOffline: () => void
  /** Player-owned HUD layout: card positions (% of viewport), width, minimized */
  hudLayout: Record<string, { x?: number; y?: number; w?: number; min?: boolean }>
  hudDockOrder: string[]
  patchCard: (id: string, patch: { x?: number; y?: number; w?: number; min?: boolean }) => void
  setDockOrder: (order: string[]) => void
  resetHudLayout: () => void

  setStreetMode: (on: boolean) => void
  openMarket: (focus?: ShopCategory) => void
  /** Open the Market filtered to items that restore a specific vital */
  openMarketForNeed: (need: NeedKey) => void
  startGatherResource: (nodeId: string) => void
  startPlacingConstruction: () => void
  placeConstructionAt: (lat: number, lng: number) => void
  cancelPlacingConstruction: () => void
  depositConstructionResources: (projectId: string) => void
  payConstructionPermit: (projectId: string) => void
  startConstructionWork: (projectId: string) => void
  hireConstructionWorker: (projectId: string, workerId: ConstructionWorkerId, hours?: number) => void
  completeConstructionIfReady: (projectId: string) => void
  quickDrink: () => void
  startGig: () => void
  markTargetsSeen: () => void
  markAchievementsSeen: () => void
  markStreetModeSeen: () => void
  createCitizen: (name: string, spawn?: SpawnLocation | null) => void
  ensureSpawn: () => Promise<void>
  /** Re-run IP hometown detection and move the citizen's spawn — null on success, error text otherwise */
  redetectSpawn: () => Promise<string | null>
  generateAvatar: (params: AvatarParams) => Promise<string | null>
  linkTelegram: () => Promise<string | null>
  registerOnline: () => Promise<void>
  reportScore: () => Promise<void>
  linkGoogle: (credential: string) => Promise<string | null>
  pushCloudSave: () => Promise<void>
  tick: () => void
  consume: (itemId: string) => void
  /** Feed one pet — tops up its hunger, charges the daily food cost */
  feedPet: (petId: string) => void
  /** Play with a pet — grants fun scaled by how well-fed it is */
  playWithPet: (petId: string) => void
  cook: (recipeId: string) => void
  startSleep: () => void
  startShift: () => void
  leaveActivity: () => void
  takeJob: (jobId: string) => void
  buy: (itemId: string) => void
  /** Upgrade a business to the next level — multiplies its income. */
  upgradeBusiness: (assetId: string) => void
  /** Open a mystery box — the gacha loop. Returns the reward for reveal. */
  openMysteryBox: (tier: BoxTier) => void
  /** The most recent mystery box result (transient — for the reveal animation). */
  lastBoxReward: { label: string; cash: number; xp: number; rarity: string; icon: string; tier: BoxTier } | null
  /** Clear the reveal once it has played, so a panel remount doesn't replay it. */
  clearBoxReward: () => void
  /** Lifetime count of boxes opened. */
  mysteryBoxesOpened: number
  /** Active temporary boosters (wage/xp/income multipliers). */
  activeBoosters: { type: BoosterType; expiresAt: number }[]
  /** Current combo count (0 = no active chain). */
  combo: number
  /** ms timestamp of the last combo-advancing action. */
  comboLastActionAt: number
  /** Buy a temporary booster (2x multiplier for 30 min). */
  buyBooster: (type: BoosterType) => void
  /** Active golden opportunity (transient — null when none active or expired). */
  goldenOpportunity: (GoldenOpportunity & { spawnedAt: number }) | null
  /** Tap the active golden opportunity to claim it. */
  claimGoldenOpportunity: () => void
  placeAt: (lat: number, lng: number) => void
  cancelPlacing: () => void
  collectIncome: () => void
  claimTutorial: (stepId: string, xp: number) => void
  /** Claim one achievement's XP + cash bounty (idempotent by id) */
  claimAchievement: (achievementId: string) => void
  toggleTutorial: () => void
  selectMapTarget: (target: MapTarget | null) => void
  setPanel: (panel: PanelId) => void
  reset: () => void
}

const FRESH = {
  money: 0,
  needs: { hunger: 85, hydration: 85, energy: 90, hygiene: 90, fun: 70 } as Needs,
  health: 100,
  level: 1,
  xp: 0,
  jobId: null as string | null,
  shiftsWorked: 0,
  timesEaten: 0,
  timesSlept: 0,
  totalCollected: 0,
  tutorialClaimed: [] as string[],
  tutorialHidden: false,
  achievementsClaimed: [] as string[],
  activity: null as Activity | null,
  lastSeenAt: 0,
  inventory: {} as Record<string, number>,
  assets: [] as PlacedAsset[],
  resources: freshResources(),
  resourceNodes: [] as ResourceNode[],
  constructionProjects: [] as ConstructionProject[],
  pets: [] as Pet[],
  groceryRestockedAt: {} as Record<string, number>,
  placing: null as ShopItem | null,
  placingConstruction: null as 'starter-house' | null,
  selectedMapTarget: null as MapTarget | null,
  panel: null as PanelId,
  log: [] as string[],
  cloudSyncedAt: null as number | null,
  streetMode: false,
  marketFocus: null as ShopCategory | null,
  marketNeed: null as NeedKey | null,
  lastFountainAt: 0,
  lastFoodBankAt: 0,
  illness: null as Illness | null,
  lastIllnessRollAt: 0,
  targetsSeen: false,
  sawAchievementsPanel: false,
  sawStreetMode: false,
  dailyCounters: { mealsToday: 0, shiftsToday: 0, earnedToday: 0, sleptToday: 0, boughtToday: 0, day: 0 },
  dailyClaimed: [] as string[],
  dailyBonusClaimed: false,
  activeCourierPackage: null as CourierPackage | null,
  courierLastDay: 0,
  courierOpenedDays: [] as number[],
  completedCourierDays: [] as number[],
  reachTier: 1,
  streakLength: 0,
  streakLastClaimDay: 0,
  streakBest: 0,
  luckyMomentsSeen: 0,
  luckyMomentsSeenIds: [] as string[],
  mysteryBoxesOpened: 0,
  activeBoosters: [] as { type: BoosterType; expiresAt: number }[],
  combo: 0,
  comboLastActionAt: 0,
  milestonesCelebrated: [] as number[],
  savingsGoal: 0,
  savingsGoalReached: false,
  awayReport: null as string | null,
  celebration: null as GameState['celebration'],
  lastBoxReward: null as GameState['lastBoxReward'],
  goldenOpportunity: null as GameState['goldenOpportunity'],
  celebrationQueue: [] as GameState['celebrationQueue'],
  toasts: [] as { id: number; text: string; tone: ToastTone }[],
  // Optimistic: assume online until an /api/* call proves otherwise. The banner
  // only surfaces when something actually fails, so a cold start in airplane
  // mode isn't greeted with a false "offline" claim before any fetch.
  online: true,
  dismissedOfflineAt: 0,
  soundOn: true,
  soundVolume: 1,
  notificationPrefs: { activity: true, streak: true, needs: true } as { activity: boolean; streak: boolean; needs: boolean },
  hudLayout: {} as Record<string, { x?: number; y?: number; w?: number; min?: boolean }>,
  hudDockOrder: ['objectives', 'citizen', 'vitals', 'guide', 'finance'] as string[],
}

// The life journal — capped at 100 entries so the Journal panel has weeks of
// history without bloating the save. Most-recent-first (new entries unshift).
const note = (log: string[], msg: string) => [msg, ...log].slice(0, 100)

let toastId = 0
const withToast = (
  toasts: { id: number; text: string; tone: ToastTone }[],
  text: string,
  tone: ToastTone,
) => [...toasts.slice(-3), { id: ++toastId, text, tone }]

/**
 * Advance the combo chain for a player-initiated action. Returns the bonus XP
 * to grant (on top of the action's base XP) + a combo toast if applicable.
 * The caller is responsible for applying the XP and merging the toast.
 */
function comboXP(s: GameState, baseXP: number): { bonusXP: number; comboToast: string | null; newCombo: number } {
  const now = Date.now()
  const msSince = now - s.comboLastActionAt
  const newCombo = advanceCombo(s.combo, msSince)
  const bonusXP = comboBonusXP(baseXP, newCombo)
  const comboToast = newCombo > 0 ? comboLabel(newCombo) : null
  return { bonusXP, comboToast, newCombo }
}

/**
 * Build the achievement snapshot from live game state. Centralised here so the
 * panel and the auto-claimer see the exact same view. `distinctItemsOwned`
 * counts every catalog item the citizen has ever possessed: current inventory,
 * placed assets, and pets — the completionist's total.
 */
export function achievementSnapshotOf(s: GameState): AchievementSnapshot {
  const inventoryKinds = new Set(Object.keys(s.inventory))
  const assetKinds = new Set(s.assets.map((a) => a.itemId))
  const petKinds = new Set(s.pets.map((p) => p.itemId))
  const distinctItemsOwned = new Set([...inventoryKinds, ...assetKinds, ...petKinds]).size
  const DAY_MS = 24 * 3_600_000
  const daysLived = s.citizen ? Math.floor((Date.now() - s.citizen.createdAt) / DAY_MS) : 0
  return {
    timesEaten: s.timesEaten,
    timesSlept: s.timesSlept,
    shiftsWorked: s.shiftsWorked,
    jobId: s.jobId,
    assets: s.assets,
    businesses: s.assets.filter((a) => a.kind === 'business').length,
    maxBusinessLevel: s.assets.filter((a) => a.kind === 'business').reduce((m, a) => Math.max(m, a.level ?? 1), 1),
    totalCollected: s.totalCollected,
    netWorth: netWorthOf(s.money, s.inventory, s.assets),
    level: s.level,
    daysLived,
    distinctItemsOwned,
    hasCooked: s.groceryRestockedAt && Object.keys(s.groceryRestockedAt).length > 0,
    hasPet: s.pets.length > 0,
    hasAvatar: !!s.citizen?.avatarUrl,
    activity: s.activity,
    needs: s.needs,
  }
}

function citizenCourierDay(citizen: Citizen, todayDay: number, anchorLat?: number, anchorLng?: number): number {
  const createdDay = dayIndexOf(citizen.createdAt, anchorLat, anchorLng)
  return Math.max(1, todayDay - createdDay + 1)
}

function courierSnapshotOf(s: Pick<GameState, 'timesEaten' | 'sawStreetMode' | 'resources' | 'constructionProjects' | 'assets'>) {
  return {
    timesEaten: s.timesEaten,
    sawStreetMode: s.sawStreetMode,
    resources: s.resources,
    constructionProjects: s.constructionProjects,
    hasHome: s.assets.some((asset) => asset.kind === 'home'),
  }
}

function completeConstructionForState(
  s: Pick<GameState, 'constructionProjects' | 'assets'>,
  projectId: string,
): { constructionProjects: ConstructionProject[]; assets: PlacedAsset[]; asset: PlacedAsset | null } {
  const project = s.constructionProjects.find((candidate) => candidate.id === projectId)
  if (!project) return { constructionProjects: s.constructionProjects, assets: s.assets, asset: null }
  const completed = completeConstructionProject(project)
  if (!completed.asset) return { constructionProjects: s.constructionProjects, assets: s.assets, asset: null }
  return {
    constructionProjects: s.constructionProjects.filter((candidate) => candidate.id !== projectId),
    assets: [...s.assets, completed.asset],
    asset: completed.asset,
  }
}

function panelForCompletedAsset(asset: PlacedAsset | null): PanelId {
  if (!asset) return null
  return asset.kind === 'business' ? 'business' : 'home'
}

function trackPlacedAsset(asset: PlacedAsset): void {
  track(asset.kind === 'home' ? 'first_home_placed' : 'first_business_placed')
}

function constructionCompleteText(asset: PlacedAsset, mode: 'materials' | 'permit' | 'workers' = 'materials'): string {
  if (asset.kind === 'business') {
    return mode === 'workers'
      ? `${asset.name} opened with hired help. Customers can find it on the map.`
      : `${asset.name} opened from local materials. The business is live on the map.`
  }
  if (mode === 'workers') return `${asset.name} completed with hired help. The map is updated.`
  if (mode === 'permit') return `${asset.name} completed after the permit cleared.`
  return `${asset.name} completed from local materials. You have a door of your own.`
}

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      citizen: null,
      ...FRESH,

      createCitizen: (name, spawn) => {
        set({
          citizen: {
            name: name.trim(),
            founderNumber: 0,
            createdAt: Date.now(),
            homeCity: spawn?.city,
            homeCountry: spawn?.country,
            spawnLat: spawn?.lat,
            spawnLng: spawn?.lng,
          },
          ...FRESH,
          money: FOUNDER_BALANCE,
          lastSeenAt: Date.now(),
          log: [
            spawn?.city
              ? `Your life begins in ${spawn.city}${spawn.country ? `, ${spawn.country}` : ''}. Claiming your founder slot…`
              : `Welcome to Reality, ${name.trim()}. Claiming your founder slot…`,
          ],
        })
        track('citizen_created')
        void get().registerOnline()
        void get().linkTelegram()
      },

      // Backfill a hometown for citizens created before IP spawn existed
      ensureSpawn: async () => {
        const s = get()
        if (!s.citizen || s.citizen.spawnLat !== undefined) return
        const spawn = await detectLocation()
        const cur = get()
        if (!spawn || !cur.citizen || cur.citizen.spawnLat !== undefined) return
        set({
          citizen: {
            ...cur.citizen,
            homeCity: spawn.city,
            homeCountry: spawn.country,
            spawnLat: spawn.lat,
            spawnLng: spawn.lng,
          },
          log: note(cur.log, `Hometown detected: ${spawn.city ?? 'your city'}${spawn.country ? `, ${spawn.country}` : ''}.`),
        })
      },

      // Fix a wrong hometown (VPNs, coarse IP databases, moved cities): re-run
      // detection and overwrite the spawn. An owned home, when present, still
      // wins everywhere an anchor is chosen — this only moves the spawn point.
      redetectSpawn: async () => {
        if (!get().citizen) return 'No citizen yet.'
        const spawn = await detectLocation()
        if (!spawn) return 'Could not detect your location right now — try again in a minute.'
        const cur = get()
        if (!cur.citizen) return 'No citizen yet.'
        set({
          citizen: {
            ...cur.citizen,
            homeCity: spawn.city,
            homeCountry: spawn.country,
            spawnLat: spawn.lat,
            spawnLng: spawn.lng,
          },
          log: note(cur.log, `Hometown updated: ${spawn.city ?? 'your city'}${spawn.country ? `, ${spawn.country}` : ''}.`),
        })
        return null
      },

      registerOnline: async () => {
        const s = get()
        if (!s.citizen || s.citizen.token) return
        const telegramInitData = telegramMiniAppInitData()
        const registrationPayload = telegramInitData
          ? { name: s.citizen.name, telegramInitData }
          : { name: s.citizen.name }
        let d = await tryPost('/api/register', registrationPayload)
        const cur = get()
        if (!cur.citizen || cur.citizen.token) return

        if (!d?.ok) {
          // Unique names: on collision, take a numbered variant and retry once
          if (d?.code === 'name_taken') {
            const variant = `${cur.citizen.name.slice(0, 19)}-${Math.floor(100 + Math.random() * 900)}`
            const retryPayload = telegramInitData
              ? { name: variant, telegramInitData }
              : { name: variant }
            set({
              citizen: { ...cur.citizen, name: variant },
              log: note(cur.log, `"${cur.citizen.name}" was already a citizen — you are ${variant}.`),
            })
            const retry = await tryPost('/api/register', retryPayload)
            if (retry?.ok) {
              d = retry
            } else {
              set({ citizen: { ...get().citizen!, online: false } })
              return
            }
          } else {
            set({ citizen: { ...cur.citizen, online: false } })
            return
          }
        }

        const founderNumber = (d.founderNumber as number | null) ?? 0
        const isFounder = founderNumber > 0
        const latest = get()
        if (!latest.citizen) return
        set({
          citizen: {
            ...latest.citizen,
            citizenId: d.citizenId as string,
            token: d.token as string,
            founderNumber,
            online: true,
            telegramUserId: typeof d.telegramUserId === 'string' ? d.telegramUserId : latest.citizen.telegramUserId,
            telegramAccountId: typeof d.telegramAccountId === 'string' ? d.telegramAccountId : latest.citizen.telegramAccountId,
            telegramUsername: typeof d.telegramUsername === 'string' ? d.telegramUsername : latest.citizen.telegramUsername,
            telegramName: typeof d.telegramName === 'string' ? d.telegramName : latest.citizen.telegramName,
            telegramLinkedAt: typeof d.telegramLinkedAt === 'number' ? d.telegramLinkedAt : latest.citizen.telegramLinkedAt,
          },
          money: isFounder ? latest.money : Math.min(latest.money, CITIZEN_BALANCE),
          log: note(
            latest.log,
            isFounder
              ? `Founder #${String(founderNumber).padStart(4, '0')} — yours forever. ${formatMoney(FOUNDER_BALANCE)} deposited.`
              : `All 2,000 founder slots are claimed. Citizen grant: ${formatMoney(CITIZEN_BALANCE)}.`,
          ),
        })

        const { citizen, assets } = get()
        for (const a of assets) {
          publishPlacedAsset(citizen, a)
        }
        void get().reportScore()
      },

      linkTelegram: async () => {
        const s = get()
        if (!s.citizen) return null
        const result = await authenticateTelegramMiniApp()
        if (!result.ok) {
          return result.reason === 'not_in_telegram' ? null : result.error ?? 'Telegram sign-in failed.'
        }

        const latest = get()
        if (!latest.citizen) return null
        const wasLinkedToSameUser = latest.citizen.telegramUserId === result.session.telegramUser.id
        set({
          citizen: citizenWithTelegramSession(latest.citizen, result.session, Date.now()),
          log: wasLinkedToSameUser
            ? latest.log
            : note(latest.log, `Telegram linked: ${telegramDisplayName(result.session.telegramUser)}.`),
        })
        if (!wasLinkedToSameUser) track('telegram_linked')
        return null
      },

      reportScore: async () => {
        const s = get()
        if (!s.citizen?.token) return
        await tryPost('/api/leaderboard', {
          citizenId: s.citizen.citizenId,
          token: s.citizen.token,
          name: s.citizen.name,
          netWorth: netWorthOf(s.money, s.inventory, s.assets),
        })
      },

      linkGoogle: async (credential) => {
        const s = get()
        if (!s.citizen?.token) return 'Connect to the world first — Google linking needs an online citizen.'
        const d = await tryPost('/api/auth-google', {
          credential,
          citizenId: s.citizen.citizenId,
          token: s.citizen.token,
        })
        if (!d?.ok) return (d?.error as string) ?? 'Google sign-in failed. Try again.'
        const profile = d.profile as { email?: string; name?: string; picture?: string; sub?: string }
        set({
          citizen: {
            ...get().citizen!,
            googleSub: profile.sub,
            googleEmail: profile.email,
            googleName: profile.name,
            googlePicture: profile.picture,
          },
          log: note(get().log, `Google account linked: ${profile.email}. Your life is backed up.`),
        })
        void get().pushCloudSave()
        return null
      },

      pushCloudSave: async () => {
        const s = get()
        if (!s.citizen?.token || !s.citizen.googleSub) return
        const save = localStorage.getItem(SAVE_KEY)
        if (!save) return
        const d = await tryPost('/api/cloud-save', {
          citizenId: s.citizen.citizenId,
          token: s.citizen.token,
          save,
        })
        if (d?.ok) set({ cloudSyncedAt: Date.now() })
      },

      // The heartbeat. One simulation path for everything: a 1-second live
      // tick and a 3-day absence run through the same realtime engine.
      tick: () => {
        const s = get()
        if (!s.citizen) return
        const now = Date.now()
        const from = s.lastSeenAt || now
        if (now <= from) {
          set({ lastSeenAt: now })
          return
        }

        const wasAway = now - from > 15 * 60_000
        const completedSpecialActivity =
          s.activity &&
          (s.activity.kind === 'gather' || s.activity.kind === 'construction') &&
          now >= s.activity.endsAt
            ? s.activity
            : null
        const out = liveRealtime(
          {
            needs: s.needs,
            health: s.health,
            assets: s.assets,
            money: s.money,
            activity: s.activity,
            hasHome: s.assets.some((a) => a.kind === 'home'),
            wageBonus: wageBonusFrom(s.inventory),
            lastFountainAt: s.lastFountainAt,
            lastFoodBankAt: s.lastFoodBankAt,
            pets: s.pets,
            inventory: s.inventory,
            groceryRestockedAt: s.groceryRestockedAt,
            illness: s.illness,
            lastIllnessRollAt: s.lastIllnessRollAt,
          },
          from,
          now,
        )

        let log = s.log
        let toasts = s.toasts
        let { level, xp } = s
        const startingLevel = s.level // captured to detect a level-up at end-of-tick for the celebration
        // These accumulate state that the tick derives. They were previously
        // MUTATED IN PLACE on the get() snapshot before the final set() — which
        // only worked because tick is synchronous. Locals honour the repo's
        // immutability rule and mean a throw mid-tick can never leave getState()
        // showing a granted reward that never persists.
        let celebration = s.celebration
        let celebrationQueue = s.celebrationQueue
        let activeBoosters = s.activeBoosters
        let combo = s.combo
        let milestonesCelebrated = s.milestonesCelebrated
        let luckyMomentsSeen = s.luckyMomentsSeen
        let luckyMomentsSeenIds = s.luckyMomentsSeenIds
        let goldenOpportunity = s.goldenOpportunity
        let achievementsClaimed = s.achievementsClaimed
        let streakBest = s.streakBest
        let savingsGoalReached = s.savingsGoalReached
        let selectedMapTarget = s.selectedMapTarget
        // Show-or-queue a celebration. Declared early so every celebration
        // site (milestone, lucky, achievement, level, daily, savings) can use
        // it regardless of order in the tick. If none is showing, show
        // immediately; otherwise push to the queue (drained by dismissCelebration).
        const celebrate = (c: { icon: string; title: string; detail?: string; reward?: string; tone: 'legendary' | 'gold' | 'level' | 'daily' }) => {
          if (!celebration) celebration = c
          else celebrationQueue = [...celebrationQueue, c]
        }
        // Clean expired boosters at the start of each tick.
        const cleanBoosters = cleanExpiredBoosters(activeBoosters, now)
        if (cleanBoosters.length !== activeBoosters.length) activeBoosters = cleanBoosters
        // Combo timeout: if the combo window expired, reset to 0.
        if (combo > 0 && now - s.comboLastActionAt >= COMBO_WINDOW_MS) combo = 0
        // Apply XP booster to engine XP gains.
        const xpMult = boosterMultiplier(cleanBoosters, 'xp', now)
        const boostedXP = out.xpGained * xpMult
        if (boostedXP > 0) {
          const prog = applyXp(level, xp, boostedXP)
          if (prog.level > level) toasts = withToast(toasts, `Level ${prog.level} reached!`, 'sky')
          level = prog.level
          xp = prog.xp
        }
        // Apply wage booster: add bonus wages on top of what the engine computed.
        // The bonus is REAL money — added to the balance below once `money` is
        // initialized from out.money (it previously appeared only in the toast).
        const wageMult = boosterMultiplier(cleanBoosters, 'wage', now)
        const wageBonusEarned = out.shiftsCompleted > 0 ? Math.round(out.wagesEarned * (wageMult - 1)) : 0
        if (out.shiftsCompleted > 0) {
          if (wageBonusEarned > 0) {
            toasts = withToast(toasts, `💪 Wage boost: +${formatMoney(wageBonusEarned)}!`, 'gold')
          }
          if (!wasAway) {
            log = note(log, `Shift complete: +${formatMoney(out.wagesEarned)}${wageBonusEarned > 0 ? ` (+${formatMoney(wageBonusEarned)} boosted)` : ''}.`)
            toasts = withToast(toasts, `Shift complete +${formatMoney(out.wagesEarned)}`, 'gold')
          }
        }
        let timesEaten = s.timesEaten
        if (out.mealsCooked > 0) {
          timesEaten += out.mealsCooked
          const name = s.activity?.kind === 'cook' ? s.activity.title : 'Dinner'
          if (!wasAway) {
            log = note(log, `${name} is ready.`)
            toasts = withToast(toasts, `${name} is ready 🍽️`, 'meal')
          }
        }
        if (out.spoiled.length > 0 && !wasAway) {
          toasts = withToast(toasts, `${out.spoiled.join(', ')} spoiled`, 'sky')
        }
        // Illness visibility (RFC amendment: full) — live play gets the toast;
        // away spans surface it through out.summary in the away report below.
        if (out.caughtIllness && !wasAway) {
          const sick =
            out.caughtIllness === 'cold'
              ? 'You caught a cold 🤧 — rest works worse for 2 days. Cold Medicine ($15) cures it.'
              : 'You came down with the flu 🤒 — no shifts until it passes. Flu Medicine ($35) cures it.'
          log = note(log, sick)
          toasts = withToast(toasts, sick, 'sky')
        }
        if (out.recoveredFrom && !out.illness && !wasAway) {
          log = note(log, `You shook off the ${out.recoveredFrom}. Back to full strength.`)
          toasts = withToast(toasts, `Recovered from the ${out.recoveredFrom} 💪`, 'sky')
        }
        let awayReport = s.awayReport
        if (wasAway && (out.summary.length > 0 || out.assets.some((a) => a.pendingIncome > 1))) {
          const income = out.assets.reduce((sum, a) => sum + a.pendingIncome, 0) - s.assets.reduce((sum, a) => sum + a.pendingIncome, 0)
          const parts = [...out.summary]
          if (income >= 1) parts.push(`businesses earned ${formatMoney(Math.floor(income))}`)
          if (parts.length > 0) {
            const report = `While you were away, your citizen ${parts.join(', ')}.`
            log = note(log, report)
            awayReport = report
          }
        }

        // Territorial progression: celebrate when the citizen's reach grows
        let reachTier = s.reachTier
        // The habit metric: still living this life a week later (Rule of retention)
        if (now - s.citizen.createdAt >= 7 * 24 * 3_600_000) track('d7_return')

        // Weekly milestone celebration — fires once when the citizen crosses
        // each milestone week (1, 2, 4, 8, 12, 26, 52). A returning player who
        // has built a multi-week life gets a moment acknowledging their
        // commitment. The curve front-loads (1, 2 weeks) and spaces out later.
        {
          const WEEK_MS = 7 * 24 * 3_600_000
          const MILESTONE_WEEKS = [1, 2, 4, 8, 12, 26, 52]
          const weeksLived = Math.floor((now - s.citizen.createdAt) / WEEK_MS)
          const nextMilestone = MILESTONE_WEEKS.find(
            (w) => w <= weeksLived && !milestonesCelebrated.includes(w),
          )
          if (nextMilestone) {
            milestonesCelebrated = [...milestonesCelebrated, nextMilestone]
            track('week_milestone')
            const label = nextMilestone === 1 ? 'one week' : nextMilestone === 52 ? 'a full year' : `${nextMilestone} weeks`
            const reward = nextMilestone >= 52 ? 'a lifetime' : nextMilestone >= 12 ? 'a season' : 'a habit'
            celebrate({
              icon: '⏳',
              title: `${label.charAt(0).toUpperCase() + label.slice(1)} in Reality`,
              detail: `You've kept this life going for ${label}. That's ${reward} — and the world is richer for it.`,
              tone: 'gold',
            })
            toasts = withToast(toasts, `⏳ ${nextMilestone === 1 ? 'A week' : nextMilestone + ' weeks'} in Reality. You've built something real.`, 'achieve')
            log = note(log, `${label.charAt(0).toUpperCase() + label.slice(1)} milestone reached.`)
          }
        }

        // Seniority: shifts finished this tick may cross a promotion threshold
        if (out.shiftsCompleted > 0) {
          const before = careerRankOf(s.shiftsWorked)
          const after = careerRankOf(s.shiftsWorked + out.shiftsCompleted)
          if (after.rank > before.rank) {
            toasts = withToast(toasts, `📈 Promoted: ${after.title} — wages +${Math.round((after.wageMultiplier - 1) * 100)}% at every job!`, 'gold')
            log = note(log, `Promotion earned: ${after.title}. Every future shift pays ${Math.round((after.wageMultiplier - 1) * 100)}% more.`)
          }
        }

        {
          const reach = reachOf(
            level,
            out.assets.filter((a) => a.kind === 'business').length,
            out.assets.some((a) => a.kind === 'home'),
            netWorthOf(out.money, s.inventory, out.assets),
          )
          if (reach.tier > reachTier) {
            reachTier = reach.tier
            toasts = withToast(toasts, `🌍 Your reach expanded: ${reach.label}!`, 'gold')
            log = note(log, `Your reach expanded — you can now build across ${reach.label}.`)
          }
        }

        // A little chaos, only during live play
        let needs = out.needs
        let money = out.money + wageBonusEarned
        let resources = s.resources
        let constructionProjects = s.constructionProjects
        if (completedSpecialActivity?.kind === 'gather' && completedSpecialActivity.resourceKind && completedSpecialActivity.resourceAmount) {
          const kind = completedSpecialActivity.resourceKind
          const amount = completedSpecialActivity.resourceAmount
          resources = addResources(resources, kind, amount)
          log = note(log, `Gathered ${amount} ${RESOURCE_META[kind].label.toLowerCase()}.`)
          if (!wasAway) toasts = withToast(toasts, `+${amount} ${RESOURCE_META[kind].label}`, 'gold')
        }
        if (completedSpecialActivity?.kind === 'construction' && completedSpecialActivity.projectId) {
          const projectId = completedSpecialActivity.projectId
          const project = constructionProjects.find((candidate) => candidate.id === projectId)
          if (project) {
            const minutes = completedSpecialActivity.laborMinutes ?? Math.round((completedSpecialActivity.endsAt - completedSpecialActivity.startedAt) / 60_000)
            const worked = addConstructionLabor(project, minutes)
            const projects = constructionProjects.map((candidate) => candidate.id === projectId ? worked : candidate)
            const completed = completeConstructionForState({ constructionProjects: projects, assets: out.assets }, projectId)
            constructionProjects = completed.constructionProjects
            out.assets = completed.assets
            if (completed.asset) {
              trackPlacedAsset(completed.asset)
              publishPlacedAsset(s.citizen, completed.asset)
              selectedMapTarget = { kind: 'asset', id: completed.asset.id }
              log = note(log, constructionCompleteText(completed.asset))
              if (!wasAway) toasts = withToast(toasts, `${completed.asset.name} complete!`, 'achieve')
            } else {
              log = note(log, `Construction labor complete: ${minutes} minutes on ${project.name}.`)
              if (!wasAway) toasts = withToast(toasts, `Construction labor +${minutes}m`, 'gold')
            }
          }
        }
        // "Earned today" accumulator for the daily challenges — WORK income
        // only (wages + business income), not windfalls. Streak cash, lucky
        // moments, achievement bounties, and challenge rewards used to feed
        // this too, which let a day-14 streak auto-complete "Earn $X today"
        // on the first tick of the day with zero play. Real-life logic: you
        // don't "earn" a lottery win. Away spans are also excluded — a
        // 3-day absence must not complete an engagement challenge on return.
        let cashEarnedThisTick = 0
        const addEarned = (amt: number) => { if (amt > 0 && !wasAway) cashEarnedThisTick += amt }
        // Wages + business pending-income accrual are baked into out.money
        // (the engine's starting cash). Capture them as earned income.
        addEarned(out.wagesEarned * wageMult) // wages with booster
        {
          const pendingDelta = out.assets.reduce((sum, a) => sum + a.pendingIncome, 0) - s.assets.reduce((sum, a) => sum + a.pendingIncome, 0)
          addEarned(pendingDelta)
          // Income booster: multiply the accrued pending income by the booster
          // multiplier, adding the bonus directly to the assets' pendingIncome.
          const incMult = boosterMultiplier(cleanBoosters, 'income', now)
          if (incMult > 1 && pendingDelta > 0) {
            const bonus = Math.round(pendingDelta * (incMult - 1))
            if (bonus > 0) {
              out.assets = out.assets.map((a) =>
                a.kind === 'business' ? { ...a, pendingIncome: a.pendingIncome + bonus * (a.pendingIncome > 0 ? 1 : 0) / Math.max(1, out.assets.filter((b) => b.kind === 'business' && b.pendingIncome > 0).length) } : a,
              )
              addEarned(bonus)
            }
          }
        }
        if (!wasAway && !s.activity) {
          const event = rollEvent(s.assets.some((a) => a.kind === 'business'))
          if (event) {
            if (event.effects) needs = applyEffects(needs, event.effects)
            money = Math.max(0, money + (event.money ?? 0))
            log = note(log, event.text)
            toasts = withToast(toasts, event.text, (event.money ?? 0) > 0 ? 'gold' : 'sky')
          }
        }

        // Rare lucky moments — the variable-ratio jackpot. Distinct from
        // rollEvent above: ~0.05%/live-tick, $1k-50k rewards. Fires regardless
        // of activity (it's *news*, not chaos) but never during away spans.
        if (!wasAway) {
          // First-win guarantee: a new citizen (< 20 min old) who has never
          // seen a lucky moment gets a dramatically boosted chance so their
          // first session includes the dopamine hit. Without this, the 0.05%
          // chance means a new player might play for days without ever
          // experiencing the system -- and never learn it exists. The boost
          // is ~5% per tick for 20 min, guaranteeing a hit in the first
          // session. After the first moment, normal rarity resumes.
          const isNew = s.citizen && (now - s.citizen.createdAt < 20 * 60_000)
          const needsFirstWin = luckyMomentsSeen === 0 && isNew
          // 5% per tick for 20 min => ~100% chance the first session lands one.
          // Uses a tier-1-only picker so the tutorial hit is exciting without
          // exceeding the citizen grant before the core economy loop starts.
          const lucky = needsFirstWin
            ? (Math.random() < 0.05 ? pickFirstLuckyMoment() : null)
            : rollLuckyMoment()
          if (lucky) {
            const prog = applyXp(level, xp, lucky.xp)
            level = prog.level
            xp = prog.xp
            money += lucky.money
            luckyMomentsSeen = luckyMomentsSeen + 1
            if (luckyMomentsSeen === 1) track('first_lucky')
            if (!luckyMomentsSeenIds.includes(lucky.id)) {
              luckyMomentsSeenIds = [...luckyMomentsSeenIds, lucky.id]
            }
            const icon = RARITY_META[lucky.rarity].icon
            const label = RARITY_META[lucky.rarity].label.toUpperCase()
            toasts = withToast(toasts, `${icon} ${label}! ${lucky.text} (+${formatMoney(lucky.money)}, +${lucky.xp} XP)`, lucky.rarity === 'legendary' ? 'legendary' : 'lucky')
            log = note(log, `${label}: ${lucky.text} Found ${formatMoney(lucky.money)} and gained ${lucky.xp} XP.`)
            // Legendary jackpots earn a full celebration overlay — they're
            // once-in-a-lifetime events that deserve more than a toast.
            if (lucky.rarity === 'legendary') {
              celebrate({
                icon: '🌟',
                title: 'LEGENDARY!',
                detail: lucky.text,
                reward: `+${formatMoney(lucky.money)} · +${lucky.xp} XP`,
                tone: 'legendary',
              })
            }
          }
        }

        // Golden opportunities — time-limited tap events during live play.
        // Rare by design (~every 30 min of live ticks — see OPPORTUNITY_CHANCE).
        // If one is already active, don't spawn another.
        if (!wasAway && !goldenOpportunity) {
          const opp = rollOpportunity()
          if (opp) {
            goldenOpportunity = { ...opp, spawnedAt: now }
            toasts = withToast(toasts, `${opp.icon} Golden opportunity! Tap to claim — ${Math.round(OPPORTUNITY_WINDOW_MS / 1000)}s left.`, 'gold')
          }
        }
        // Expire unclaimed opportunities past their window.
        if (goldenOpportunity && now - goldenOpportunity.spawnedAt > OPPORTUNITY_WINDOW_MS) {
          goldenOpportunity = null
        }

        // Auto-claim newly-unlocked achievements — the dopamine hit lands the
        // instant the player earns it (e.g. the 10th shift flips "Reliable"),
        // not on a manual panel visit. XP + bounty granted here, idempotently.
        const postState = { ...s, shiftsWorked: s.shiftsWorked + out.shiftsCompleted, level, timesEaten, money, needs, assets: out.assets, inventory: out.inventory }
        const newlyEarned = newlyUnlocked(achievementSnapshotOf(postState), achievementsClaimed)
        if (newlyEarned.length > 0) {
          const earnedIds = newlyEarned.map((a) => a.id)
          const totalXp = newlyEarned.reduce((sum, a) => sum + a.xp, 0)
          const totalBounty = newlyEarned.reduce((sum, a) => sum + a.bounty, 0)
          const prog = applyXp(level, xp, totalXp)
          level = prog.level
          xp = prog.xp
          money += totalBounty
          for (const a of newlyEarned) {
            toasts = withToast(toasts, `🏆 ${a.title} — +${a.xp} XP, ${formatMoney(a.bounty)}`, 'achieve')
            log = note(log, `🏆 Earned "${a.title}" — ${a.detail} (+${formatMoney(a.bounty)}, +${a.xp} XP).`)
          }
          // Gold-tier achievements earn a celebration overlay — they're the
          // long-term grails (level 20, 30-day streak, 10 businesses...).
          const gold = newlyEarned.find((a) => a.tier === 'gold')
          if (gold) {
            celebrate({
              icon: '🥇',
              title: gold.title,
              detail: gold.detail,
              reward: `+${gold.xp} XP · ${formatMoney(gold.bounty)}`,
              tone: 'gold',
            })
          }
          achievementsClaimed = [...achievementsClaimed, ...earnedIds]
          if (achievementsClaimed.length === newlyEarned.length) track('first_achievement')
        }

        // Daily streak — the come-back-tomorrow hook. Computed against the
        // citizen's LOCAL calendar day so the reward lands at the player's
        // midnight, not UTC. Idempotent within a day (computeStreakClaim
        // returns null after the first claim), so every subsequent tick is a
        // no-op. Reset/forgiveness rules live in src/game/streak.ts.
        let streakLength = s.streakLength
        let streakLastClaimDay = s.streakLastClaimDay
        const home = s.assets.find((a) => a.kind === 'home')
        const anchorLat = home ? home.lat : s.citizen.spawnLat
        const anchorLng = home ? home.lng : s.citizen.spawnLng
        const todayDay = dayIndexOf(now, anchorLat, anchorLng)
        let activeCourierPackage = s.activeCourierPackage
        let courierLastDay = s.courierLastDay
        const courierDay = citizenCourierDay(s.citizen, todayDay, anchorLat, anchorLng)
        const nextPackage = shouldCreateCourierPackage({
          citizenAgeDay: courierDay,
          localDay: todayDay,
          courierLastDay,
          completedDays: s.completedCourierDays,
        })
        if (nextPackage) {
          activeCourierPackage = nextPackage
          courierLastDay = todayDay
          toasts = withToast(toasts, `Courier package day ${nextPackage.day} arrived.`, 'gold')
          log = note(log, `Courier package arrived: ${nextPackage.title}.`)
        } else if (courierLastDay !== todayDay && courierDay <= 10) {
          courierLastDay = todayDay
          activeCourierPackage = null
        }
        const streakPrev: StreakState = { length: s.streakLength, lastClaimDay: s.streakLastClaimDay }
        const streakOut = computeStreakClaim(streakPrev, todayDay)
        if (streakOut) {
          streakLength = streakOut.length
          streakLastClaimDay = todayDay
          if (streakOut.length > streakBest) {
            streakBest = streakOut.length
            if (streakOut.length === 7) track('streak_7')
          }
          // Day 1 (spawn day) and grace-day holds pay nothing and stay quiet.
          if (streakOut.advanced && (streakOut.cash > 0 || streakOut.xp > 0)) {
            const prog = applyXp(level, xp, streakOut.xp)
            level = prog.level
            xp = prog.xp
            money += streakOut.cash
            const label = streakLabel(streakOut.length)
            toasts = withToast(toasts, `🔥 ${label}! +${formatMoney(streakOut.cash)}, +${streakOut.xp} XP`, 'streak')
            log = note(log, `🔥 Day ${streakOut.length} of your streak — the world rewards consistency. Claimed ${formatMoney(streakOut.cash)} and ${streakOut.xp} XP.`)
          } else if (streakOut.reset) {
            // A reset is worth surfacing — but framed as a fresh start, not a
            // loss. Returning players should feel welcomed, not punished (the
            // act of coming back is exactly what we want to reward). Only
            // mention the previous streak if it was meaningful (>= 3 days) so
            // a day-1 player doesn't get greeted with news of a "reset" they
            // never built. The previous best is preserved in streakBest and
            // shown in the panel — the loss isn't erased, just not the headline.
            const prev = s.streakLength
            const msg = prev >= 3
              ? `Welcome back. Your ${prev}-day streak reset — start fresh at day 1. 🔁`
              : `Welcome back. A new streak starts today. 🔁`
            toasts = withToast(toasts, msg, 'sky')
            log = note(log, `Your ${prev}-day streak ended after a long absence. A new streak starts today. (Best ever: ${streakBest} days.)`)
          }
        }

        // Level-up celebration — fires at milestone levels (every 5th). A
        // regular level-up gets a toast; a 5th, 10th, 15th, 20th... gets the
        // full overlay. Checked here (end of tick) so it catches level-ups
        // from any XP source (engine, achievements, lucky, streak, daily).
        // Compare 5-level BANDS, not `level % 5` — a multi-level jump (big XP
        // batch, 4→6) must still celebrate crossing the milestone it skipped.
        if (Math.floor(level / 5) > Math.floor(startingLevel / 5) && level >= 5) {
          celebrate({
            icon: '⭐',
            title: `Level ${level}!`,
            detail: 'A new tier of achievements and reach may have unlocked.',
            tone: 'level',
          })
        }

        // Daily challenges — counters reset at local midnight, increment by
        // this tick's deltas, auto-grant on completion. See dailyChallenges.ts.
        let dailyCounters = s.dailyCounters
        let dailyClaimed = s.dailyClaimed
        let dailyBonusClaimed = s.dailyBonusClaimed
        // Monotonic guard (> not !==): moving the anchor westward (first home
        // in an earlier timezone) decrements todayDay — that must NOT hand out
        // a fresh challenge slate for a day that was already claimed.
        if (todayDay > dailyCounters.day) {
          // Midnight rollover (or first tick of a new citizen): fresh slate.
          // On a genuine rollover (previous day was set, i.e. not the first
          // tick), log a day-header to the journal — gives the timeline a
          // temporal rhythm and surfaces the thought-of-the-day in context.
          const wasRollover = dailyCounters.day > 0
          dailyCounters = { mealsToday: 0, shiftsToday: 0, earnedToday: 0, sleptToday: 0, boughtToday: 0, day: todayDay }
          dailyClaimed = []
          dailyBonusClaimed = false
          if (wasRollover) {
            const thought = thoughtForDay(todayDay)
            log = note(log, `━ A new day. "${thought}"`)
          }
        }
        // Savings goal — celebrate once when net worth crosses the player's
        // self-set target. Checked here (after money is finalized by the
        // chaos/lucky/achievement blocks above) so the net-worth read is
        // current. Gives purpose to the earning loop: "I'm saving for the
        // $50k studio" is a concrete, motivating goal the player chose.
        if (s.savingsGoal > 0 && !savingsGoalReached) {
          const netWorth = netWorthOf(money, s.inventory, out.assets)
          if (netWorth >= s.savingsGoal) {
            savingsGoalReached = true
            celebrate({
              icon: '🎯',
              title: 'Savings goal reached!',
              detail: `You hit your ${formatMoney(s.savingsGoal)} target. Time to spend it — or set a new goal.`,
              tone: 'gold',
            })
            toasts = withToast(toasts, `🎯 Savings goal reached — ${formatMoney(s.savingsGoal)}!`, 'achieve')
            log = note(log, `🎯 Reached your savings goal of ${formatMoney(s.savingsGoal)}. Time to spend it — or set a new one.`)
          }
        }

        // Increment by this tick's deltas. mealsCooked is the per-tick meal
        // count; shiftsCompleted is per-tick shifts. cashEarnedThisTick is the
        // precise sum of every positive inflow (wages, lucky, bounty, streak,
        // daily, bonus, business pending) -- replacing the old imprecise
        // approximation that double-counted wages and clamped spending.
        // Sleeps are inferred from activity kind transitions.
        // Away spans never feed the challenge counters: challenges reward
        // TODAY'S engagement, and a multi-day absence compressed into one
        // tick would auto-complete "eat 2 meals" / "work a shift" on return.
        const mealsDelta = wasAway ? 0 : out.mealsCooked
        const shiftsDelta = wasAway ? 0 : out.shiftsCompleted
        const sleptDelta = !wasAway && s.activity?.kind === 'sleep' && out.activity?.kind !== 'sleep' ? 1 : 0
        if (mealsDelta || shiftsDelta || cashEarnedThisTick || sleptDelta) {
          dailyCounters = {
            ...dailyCounters,
            mealsToday: dailyCounters.mealsToday + mealsDelta,
            shiftsToday: dailyCounters.shiftsToday + shiftsDelta,
            earnedToday: dailyCounters.earnedToday + cashEarnedThisTick,
            sleptToday: dailyCounters.sleptToday + sleptDelta,
          }
        }
        // Auto-grant any newly-complete challenges (idempotent via dailyClaimed).
        if (s.citizen) {
          const dayChallenges = challengesForDay(s.citizen.citizenId ?? 'anon', todayDay)
          const csnap: DailyChallengeSnapshot = {
            mealsToday: dailyCounters.mealsToday,
            shiftsToday: dailyCounters.shiftsToday,
            earnedToday: dailyCounters.earnedToday,
            sleptToday: dailyCounters.sleptToday,
            boughtToday: dailyCounters.boughtToday,
          }
          const newlyComplete = dayChallenges.filter((c) => {
            if (dailyClaimed.includes(c.id)) return false
            return challengeProgress(c, csnap).complete
          })
          if (newlyComplete.length > 0) {
            let totalXp = 0
            let totalCash = 0
            for (const c of newlyComplete) {
              const r = CHALLENGE_REWARD[c.difficulty]
              totalXp += r.xp
              totalCash += r.cash
              toasts = withToast(toasts, `✅ Daily: ${c.label} complete! +${formatMoney(r.cash)}, +${r.xp} XP`, 'ok')
              log = note(log, `Daily challenge complete: ${c.label} (+${formatMoney(r.cash)}, +${r.xp} XP).`)
            }
            const prog = applyXp(level, xp, totalXp)
            level = prog.level
            xp = prog.xp
            money += totalCash
            dailyClaimed = [...dailyClaimed, ...newlyComplete.map((c) => c.id)]
            // All-3-complete bonus
            if (!dailyBonusClaimed) {
              const summary = challengeSetSummary(dayChallenges, csnap)
              if (summary.allComplete) {
                const bprog = applyXp(level, xp, DAILY_COMPLETE_BONUS.xp)
                level = bprog.level
                xp = bprog.xp
                money += DAILY_COMPLETE_BONUS.cash
                dailyBonusClaimed = true
                track('daily_complete')
                toasts = withToast(toasts, `🎯 All 3 daily challenges! Bonus +${formatMoney(DAILY_COMPLETE_BONUS.cash)}, +${DAILY_COMPLETE_BONUS.xp} XP`, 'achieve')
                log = note(log, `🎯 A perfect day — all three challenges done. Bonus: ${formatMoney(DAILY_COMPLETE_BONUS.cash)} and ${DAILY_COMPLETE_BONUS.xp} XP.`)
                celebrate({
                  icon: '🎯',
                  title: 'All 3 daily challenges!',
                  detail: 'A perfect day. Come back tomorrow for a fresh set.',
                  reward: `+${formatMoney(DAILY_COMPLETE_BONUS.cash)} · +${DAILY_COMPLETE_BONUS.xp} XP`,
                  tone: 'daily',
                })
              }
            }
          }
        }

        set({
          needs,
          health: out.health,
          assets: out.assets,
          money,
          activity: out.activity,
          shiftsWorked: s.shiftsWorked + out.shiftsCompleted,
          level,
          xp,
          lastSeenAt: now,
          lastFountainAt: out.lastFountainAt,
          lastFoodBankAt: out.lastFoodBankAt,
          illness: out.illness,
          lastIllnessRollAt: out.lastIllnessRollAt,
          pets: out.pets,
          inventory: out.inventory,
          resources,
          constructionProjects,
          groceryRestockedAt: out.groceryRestockedAt,
          timesEaten,
          achievementsClaimed: achievementsClaimed,
          reachTier,
          streakLength,
          streakLastClaimDay,
          streakBest: streakBest,
          luckyMomentsSeen: luckyMomentsSeen,
          luckyMomentsSeenIds: luckyMomentsSeenIds,
          milestonesCelebrated: milestonesCelebrated,
          savingsGoal: s.savingsGoal,
          savingsGoalReached: savingsGoalReached,
          dailyCounters,
          dailyClaimed,
          dailyBonusClaimed,
          activeCourierPackage,
          courierLastDay,
          awayReport,
          celebration: celebration,
          celebrationQueue: celebrationQueue,
          goldenOpportunity: goldenOpportunity,
          activeBoosters: activeBoosters,
          combo: combo,
          comboLastActionAt: s.comboLastActionAt,
          selectedMapTarget,
          toasts,
          log,
        })
      },

      dismissAwayReport: () => set({ awayReport: null }),
      dismissCelebration: () => set((state) => {
        // Drain the queue: if a celebration is queued, show it next; else clear.
        const queue = state.celebrationQueue
        if (queue.length > 0) {
          return { celebration: queue[0], celebrationQueue: queue.slice(1) }
        }
        return { celebration: null }
      }),
      popToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
      toggleSound: () => set({ soundOn: !get().soundOn }),
      setSoundVolume: (v) => {
        const clamped = Math.max(0, Math.min(1, v))
        applySoundVolume(clamped)
        set({ soundVolume: clamped })
      },
      setNotificationPref: (type, on) =>
        set({ notificationPrefs: { ...get().notificationPrefs, [type]: on } }),
      // Connection health — called by /api/* sites (tryPost, fetches in panels).
      // A single success flips back to online and re-arms the banner.
      markApiOk: () => {
        if (!get().online) set({ online: true, dismissedOfflineAt: 0 })
      },
      markApiOffline: () => set({ online: false }),
      dismissOffline: () => set({ dismissedOfflineAt: Date.now() }),
      patchCard: (id, patch) =>
        set({ hudLayout: { ...get().hudLayout, [id]: { ...get().hudLayout[id], ...patch } } }),
      setDockOrder: (order) => set({ hudDockOrder: order }),
      resetHudLayout: () => set({ hudLayout: {} }),
      setResourceNodes: (nodes) => set({ resourceNodes: nodes }),

      setSavingsGoal: (target) => set({ savingsGoal: Math.max(0, Math.floor(target)), savingsGoalReached: false }),

      openMarket: (focus) => set({ marketFocus: focus ?? null, marketNeed: null, panel: 'shop' }),
      openMarketForNeed: (need) => set({ marketNeed: need, marketFocus: null, panel: 'shop' }),

      openCourierPackage: () => {
        const s = get()
        const pkg = s.activeCourierPackage
        if (!pkg || s.courierOpenedDays.includes(pkg.day)) return
        set({
          courierOpenedDays: [...s.courierOpenedDays, pkg.day],
          log: note(s.log, `Courier package day ${pkg.day}: ${pkg.objective}`),
        })
      },

      dismissCourierPackage: () => {
        const s = get()
        const pkg = s.activeCourierPackage
        if (!pkg || s.courierOpenedDays.includes(pkg.day)) return
        set({ courierOpenedDays: [...s.courierOpenedDays, pkg.day] })
      },

      completeCourierPackage: () => {
        const s = get()
        const pkg = s.activeCourierPackage
        if (!pkg || s.completedCourierDays.includes(pkg.day)) return
        if (!courierRequirementMet(pkg, courierSnapshotOf(s))) {
          set({ toasts: withToast(s.toasts, `Package day ${pkg.day} is not ready yet.`, 'blocked') })
          return
        }
        const prog = applyXp(s.level, s.xp, pkg.rewardXp)
        set({
          activeCourierPackage: null,
          completedCourierDays: [...s.completedCourierDays, pkg.day],
          courierOpenedDays: s.courierOpenedDays.includes(pkg.day) ? s.courierOpenedDays : [...s.courierOpenedDays, pkg.day],
          money: s.money + pkg.rewardCash,
          level: prog.level,
          xp: prog.xp,
          toasts: withToast(s.toasts, `Courier day ${pkg.day} complete: +${formatMoney(pkg.rewardCash)}, +${pkg.rewardXp} XP`, 'achieve'),
          log: note(s.log, `Courier package complete: ${pkg.title} (+${formatMoney(pkg.rewardCash)}, +${pkg.rewardXp} XP).`),
        })
      },

      startGatherResource: (nodeId) => {
        const s = get()
        if (s.activity) return
        const node = s.resourceNodes.find((candidate) => candidate.id === nodeId)
        if (!node) return
        if (s.needs.energy < node.energyCost + 5 || s.health < 20) {
          set({ toasts: withToast(s.toasts, `Too worn down to gather ${RESOURCE_META[node.kind].label.toLowerCase()}. Rest first.`, 'blocked') })
          return
        }
        const now = Date.now()
        set({
          activity: {
            kind: 'gather',
            startedAt: now,
            endsAt: now + node.gatherMinutes * 60_000,
            title: `Gather ${RESOURCE_META[node.kind].label}`,
            resourceKind: node.kind,
            resourceAmount: node.yieldAmount,
          },
          needs: applyEffects(s.needs, { energy: -node.energyCost, hygiene: -2 }),
          panel: null,
          log: note(s.log, `Started gathering ${RESOURCE_META[node.kind].label.toLowerCase()} at ${node.label}.`),
        })
      },

      startPlacingConstruction: () => {
        const s = get()
        if (s.activity) return
        set({
          placingConstruction: 'starter-house',
          placing: null,
          panel: null,
          log: note(s.log, 'Choose a spot on the map for your Starter House foundation.'),
        })
      },

      placeConstructionAt: (lat, lng) => {
        const s = get()
        if (!s.placingConstruction) return
        const center =
          s.citizen?.spawnLat !== undefined
            ? { lat: s.citizen.spawnLat, lng: s.citizen.spawnLng! }
            : s.assets[0] ?? (s.citizen ? DEFAULT_MAP_ANCHOR : null)
        if (center) {
          const reach = reachOf(
            s.level,
            s.assets.filter((a) => a.kind === 'business').length,
            s.assets.some((a) => a.kind === 'home'),
            netWorthOf(s.money, s.inventory, s.assets),
          )
          const d = distanceKm(center.lat, center.lng, lat, lng)
          if (d > reach.km) {
            set({
              toasts: withToast(s.toasts, `Beyond your reach — build in ${reach.label} first`, 'sky'),
              log: note(s.log, `That foundation spot is ${Math.round(d)} km away — your reach is ${reach.label} (${reach.km} km).`),
            })
            return
          }
        }
        const project = createConstructionProject(s.placingConstruction, lat, lng)
        set({
          constructionProjects: [...s.constructionProjects, project],
          placingConstruction: null,
          selectedMapTarget: { kind: 'construction', id: project.id },
          panel: 'construction',
          log: note(s.log, `${project.name} foundation placed at ${lat.toFixed(2)}°, ${lng.toFixed(2)}°.`),
          toasts: withToast(s.toasts, `${project.name} foundation placed. Gather materials to build it.`, 'gold'),
        })
      },

      cancelPlacingConstruction: () => {
        if (!get().placingConstruction) return
        set({ placingConstruction: null, log: note(get().log, 'Construction placement cancelled.') })
      },

      depositConstructionResources: (projectId) => {
        const s = get()
        const project = s.constructionProjects.find((candidate) => candidate.id === projectId)
        if (!project) return
        const out = depositResources(project, s.resources)
        const moved = totalResourceCount(out.deposited)
        if (moved <= 0) {
          set({ toasts: withToast(s.toasts, 'No matching construction materials to deposit yet.', 'blocked') })
          return
        }
        const completed = completeConstructionForState({
          constructionProjects: s.constructionProjects.map((candidate) => candidate.id === projectId ? out.project : candidate),
          assets: s.assets,
        }, projectId)
        set({
          resources: out.inventory,
          constructionProjects: completed.constructionProjects,
          assets: completed.assets,
          selectedMapTarget: completed.asset ? { kind: 'asset', id: completed.asset.id } : { kind: 'construction', id: projectId },
          panel: completed.asset ? panelForCompletedAsset(completed.asset) : s.panel,
          log: note(s.log, completed.asset
            ? constructionCompleteText(completed.asset)
            : `Deposited ${formatResourceList(out.deposited)} into ${project.name}.`),
          toasts: withToast(s.toasts, completed.asset ? `${completed.asset.name} complete!` : `Deposited ${formatResourceList(out.deposited)}.`, completed.asset ? 'achieve' : 'gold'),
        })
        if (completed.asset) {
          trackPlacedAsset(completed.asset)
          publishPlacedAsset(s.citizen, completed.asset)
        }
      },

      payConstructionPermit: (projectId) => {
        const s = get()
        const project = s.constructionProjects.find((candidate) => candidate.id === projectId)
        if (!project) return
        const paid = payPermit(project, s.money)
        if (!paid.paid) {
          set({ toasts: withToast(s.toasts, `Permit needs ${formatMoney(project.permitFee)}.`, 'blocked') })
          return
        }
        const projects = s.constructionProjects.map((candidate) => candidate.id === projectId ? paid.project : candidate)
        const completed = completeConstructionForState({ constructionProjects: projects, assets: s.assets }, projectId)
        set({
          money: paid.money,
          constructionProjects: completed.constructionProjects,
          assets: completed.assets,
          selectedMapTarget: completed.asset ? { kind: 'asset', id: completed.asset.id } : { kind: 'construction', id: projectId },
          panel: completed.asset ? panelForCompletedAsset(completed.asset) : s.panel,
          log: note(s.log, completed.asset
            ? constructionCompleteText(completed.asset, 'permit')
            : `Permit paid for ${project.name} (${formatMoney(project.permitFee)}).`),
          toasts: withToast(s.toasts, completed.asset ? `${completed.asset.name} complete!` : `Permit paid for ${project.name}.`, completed.asset ? 'achieve' : 'gold'),
        })
        if (completed.asset) {
          trackPlacedAsset(completed.asset)
          publishPlacedAsset(s.citizen, completed.asset)
        }
      },

      startConstructionWork: (projectId) => {
        const s = get()
        if (s.activity) return
        const project = s.constructionProjects.find((candidate) => candidate.id === projectId)
        if (!project) return
        if (s.needs.energy < 20 || s.health < 20) {
          set({ toasts: withToast(s.toasts, 'Too worn down for construction work. Rest first.', 'blocked') })
          return
        }
        const remaining = Math.max(0, project.laborRequiredMinutes - project.laborDoneMinutes)
        if (remaining <= 0) {
          set({ toasts: withToast(s.toasts, 'Labor is already complete. Finish the remaining requirements.', 'sky') })
          return
        }
        const laborMinutes = Math.min(60, remaining)
        const now = Date.now()
        set({
          activity: {
            kind: 'construction',
            startedAt: now,
            endsAt: now + laborMinutes * 60_000,
            title: `Build ${project.name}`,
            projectId,
            laborMinutes,
          },
          needs: applyEffects(s.needs, { energy: -10, hygiene: -4 }),
          panel: null,
          selectedMapTarget: { kind: 'construction', id: projectId },
          log: note(s.log, `Started ${laborMinutes} minutes of construction labor on ${project.name}.`),
        })
      },

      hireConstructionWorker: (projectId, workerId, hours = 1) => {
        const s = get()
        const project = s.constructionProjects.find((candidate) => candidate.id === projectId)
        if (!project) return
        const hired = hireConstructionWorkerForProject(project, workerId, s.money, hours)
        if (!hired.hired) {
          const reason = hired.reason === 'materials'
            ? 'Workers need the materials deposited first.'
            : hired.reason === 'permit'
              ? 'Workers need the permit paid before they build.'
              : hired.reason === 'money'
                ? `Need ${formatMoney(hired.cost)} to hire that worker.`
                : hired.reason === 'labor'
                  ? 'Labor is already complete.'
                  : 'That worker is not available.'
          set({ toasts: withToast(s.toasts, reason, 'blocked'), selectedMapTarget: { kind: 'construction', id: projectId } })
          return
        }
        const projects = s.constructionProjects.map((candidate) => candidate.id === projectId ? hired.project : candidate)
        const completed = completeConstructionForState({ constructionProjects: projects, assets: s.assets }, projectId)
        set({
          money: hired.money,
          constructionProjects: completed.constructionProjects,
          assets: completed.assets,
          selectedMapTarget: completed.asset ? { kind: 'asset', id: completed.asset.id } : { kind: 'construction', id: projectId },
          panel: completed.asset ? panelForCompletedAsset(completed.asset) : s.panel,
          toasts: withToast(
            s.toasts,
            completed.asset
              ? `${completed.asset.name} complete!`
              : `Workers added ${hired.laborMinutes}m of labor for ${formatMoney(hired.cost)}.`,
            completed.asset ? 'achieve' : 'gold',
          ),
          log: note(
            s.log,
            completed.asset
              ? constructionCompleteText(completed.asset, 'workers')
              : `Hired workers for ${project.name}: ${hired.laborMinutes} minutes of labor (${formatMoney(hired.cost)}).`,
          ),
        })
        if (completed.asset) {
          trackPlacedAsset(completed.asset)
          publishPlacedAsset(s.citizen, completed.asset)
        }
      },

      completeConstructionIfReady: (projectId) => {
        const s = get()
        const completed = completeConstructionForState(s, projectId)
        if (!completed.asset) {
          set({ toasts: withToast(s.toasts, 'Construction still needs materials, labor, or the permit.', 'blocked') })
          return
        }
        set({
          constructionProjects: completed.constructionProjects,
          assets: completed.assets,
          selectedMapTarget: { kind: 'asset', id: completed.asset.id },
          panel: panelForCompletedAsset(completed.asset),
          toasts: withToast(s.toasts, `${completed.asset.name} complete!`, 'achieve'),
          log: note(s.log, constructionCompleteText(completed.asset)),
        })
        trackPlacedAsset(completed.asset)
        publishPlacedAsset(s.citizen, completed.asset)
      },

      // One tap, one dollar, half the water bar — hydration without friction
      quickDrink: () => {
        const s = get()
        if (s.activity?.kind === 'sleep') return
        const water = itemById('water')
        if (!water?.effects || s.money < water.price) return
        // Combo chain: drinking advances the combo and grants bonus XP.
        const { bonusXP, comboToast, newCombo } = comboXP(s, 5)
        const prog = bonusXP > 0 ? applyXp(s.level, s.xp, bonusXP) : { level: s.level, xp: s.xp }
        set({
          money: s.money - water.price,
          needs: applyEffects(s.needs, water.effects),
          level: prog.level,
          xp: prog.xp,
          combo: newCombo,
          comboLastActionAt: Date.now(),
          toasts: comboToast ? withToast(s.toasts, comboToast, 'gold') : s.toasts,
          log: note(s.log, 'Water. Your body says thanks.'),
        })
      },

      // A half-hour delivery gig — no employer needed, always available
      startGig: () => {
        const s = get()
        if (s.activity) return
        if (fluBlocksWork(s.illness)) {
          set({ log: note(s.log, 'Down with the flu — rest it out, or Flu Medicine ($35) is on the Health shelf.'), toasts: withToast(s.toasts, 'Down with the flu — no shifts until it passes 🤒', 'blocked') })
          return
        }
        // A gig is lighter than a full shift (lower energy floor), but a
        // starving citizen still can't work — matches the shift gate and the
        // HealthGuide's "below 15 you are too weak to start a shift."
        if (s.needs.energy < 15 || s.needs.hunger < 15 || s.health < 20) {
          set({ log: note(s.log, 'Too worn down even for a gig. Drink, eat, rest.'), toasts: withToast(s.toasts, 'Too worn down for a gig — drink, eat, rest.', 'blocked') })
          return
        }
        track('first_shift_started')
        const now = Date.now()
        set({
          activity: { kind: 'shift', startedAt: now, endsAt: now + GIG_MINUTES * 60_000, wage: GIG_WAGE, title: 'Delivery gig' },
          log: note(s.log, `Gig accepted: ${GIG_MINUTES} real minutes, ${formatMoney(Math.round((GIG_WAGE * GIG_MINUTES) / 60))} on completion.`),
        })
      },

      markTargetsSeen: () => {
        set({ targetsSeen: true })
        // One-time nudge (issue #38): once the player is past the intro, if they
        // haven't generated an avatar yet, point them at the Profile studio. This
        // is the only place it fires — markTargetsSeen is a one-shot transition.
        const s = get()
        if (s.citizen && !s.citizen.avatarUrl) {
          set({ toasts: withToast(s.toasts, 'Give yourself a face — Profile → Create your avatar', 'sky') })
        }
      },

      markAchievementsSeen: () => {
        // One-shot: only the first time the player opens the 🏆 panel. Drives
        // the final tutorial step ("Discover your achievements") and is the
        // discovery nudge for the entire retention engine.
        const s = get()
        if (s.sawAchievementsPanel) return
        set({ sawAchievementsPanel: true })
      },

      markStreetModeSeen: () => {
        if (get().sawStreetMode) return
        set({ sawStreetMode: true })
      },

      consume: (itemId) => {
        const s = get()
        if (s.activity?.kind === 'sleep') return
        const item = itemById(itemId)
        if (!item || !item.effects) return
        const owned = s.inventory[itemId] ?? 0
        if (owned <= 0) return
        // Medicine cures instantly when it matches the active illness;
        // otherwise it's just its (weak) effects — an underwhelming espresso.
        const cures = item.cures !== undefined && s.illness?.kind === item.cures
        set({
          needs: applyEffects(s.needs, item.effects),
          inventory: item.durable ? s.inventory : { ...s.inventory, [itemId]: owned - 1 },
          timesEaten: (item.effects.hunger ?? 0) > 0 ? s.timesEaten + 1 : s.timesEaten,
          illness: cures ? null : s.illness,
          log: note(s.log, cures ? `${item.name} — the ${item.cures} is gone. Like new.` : `${item.name} — done.`),
        })
      },

      // Pet care — feed one companion. No-op if it's full, broke, or missing.
      feedPet: (petId) => {
        const s = get()
        if (s.activity?.kind === 'sleep') return
        const pet = s.pets.find((p) => p.petId === petId)
        if (!pet) return
        const { pet: fed, cost } = feedPet(pet, s.money)
        if (cost === 0) return
        set({
          money: s.money - cost,
          pets: s.pets.map((p) => (p.petId === petId ? fed : p)),
          log: note(s.log, `Fed ${itemById(pet.itemId)?.name ?? 'your pet'} (−${formatMoney(cost)}). It perked right up.`),
        })
      },

      // Pet care — play with one companion. Joy scales with how fed it is;
      // a neglected pet gives nothing (it just wants to be left alone).
      playWithPet: (petId) => {
        const s = get()
        if (s.activity?.kind === 'sleep') return
        const pet = s.pets.find((p) => p.petId === petId)
        if (!pet) return
        const fun = petFunBonus(pet)
        if (fun <= 0) {
          set({ log: note(s.log, `${itemById(pet.itemId)?.name ?? 'Your pet'} is too hungry to play — feed it first.`) })
          return
        }
        set({
          needs: applyEffects(s.needs, { fun }),
          log: note(s.log, `Played with ${itemById(pet.itemId)?.name ?? 'your pet'}. +${fun} fun.`),
        })
      },

      cook: (recipeId) => {
        const s = get()
        if (s.activity) return
        const recipe = recipeById(recipeId)
        if (!recipe) return
        if (!hasKitchen(s.inventory, s.assets)) {
          set({ log: note(s.log, 'No kitchen yet — a $40 Hot Plate or any home lets you cook.') })
          return
        }
        if (!canCook(recipe, s.inventory)) {
          set({ log: note(s.log, `Missing ingredients for ${recipe.name} — stock up in Groceries.`) })
          return
        }
        // Ingredients go in now; the meal itself lands when the timer ends —
        // cooking takes real minutes, it isn't an instant snack (loop 16 debt).
        const inventory = { ...s.inventory }
        for (const [id, qty] of Object.entries(recipe.ingredients)) inventory[id] = (inventory[id] ?? 0) - qty
        const now = Date.now()
        set({
          inventory,
          activity: { kind: 'cook', startedAt: now, endsAt: now + COOK_MINUTES * 60_000, title: recipe.name, recipeId },
          log: note(s.log, `${recipe.name} ${recipe.emoji} is on the stove — ready in ${COOK_MINUTES} minutes.`),
        })
      },

      startSleep: () => {
        const s = get()
        if (s.activity) return
        const now = Date.now()
        const hasHome = s.assets.some((a) => a.kind === 'home')
        set({
          activity: { kind: 'sleep', startedAt: now, endsAt: now + SLEEP_HOURS * 3_600_000 },
          timesSlept: s.timesSlept + 1,
          log: note(s.log, hasHome ? 'Lights out at home. Energy refills through the night.' : 'Sleeping rough. A home would make this count for more.'),
        })
      },

      startShift: () => {
        const s = get()
        if (s.activity) return
        const job = s.jobId ? jobById(s.jobId) : undefined
        if (!job) return
        if (fluBlocksWork(s.illness)) {
          set({ log: note(s.log, 'Down with the flu — rest it out, or Flu Medicine ($35) is on the Health shelf.') })
          return
        }
        if (s.needs.energy < 25 || s.needs.hunger < 15 || s.health < 20) {
          set({ log: note(s.log, 'Too worn down to work. Eat and sleep first.') })
          return
        }
        track('first_shift_started')
        const now = Date.now()
        const rank = careerRankOf(s.shiftsWorked)
        set({
          activity: {
            kind: 'shift',
            startedAt: now,
            endsAt: now + SHIFT_HOURS * 3_600_000,
            wage: job.wage * rank.wageMultiplier,
            title: job.title,
          },
          log: note(
            s.log,
            `Clocked in as ${job.title}${rank.rank > 1 ? ` (${rank.title}, +${Math.round((rank.wageMultiplier - 1) * 100)}%)` : ''}. ${SHIFT_HOURS}-hour shift — pay lands when it ends.`,
          ),
        })
      },

      leaveActivity: () => {
        const s = get()
        const a = s.activity
        if (!a) return
        if (a.kind === 'sleep') {
          set({ activity: null, log: note(s.log, 'Up early. The day is yours.') })
          return
        }
        if (a.kind === 'cook') {
          // Ingredients went in already — walk away from the stove and the meal is wasted, not refunded.
          set({ activity: null, log: note(s.log, `Left the stove — ${a.title ?? 'the meal'} went to waste.`) })
          return
        }
        if (a.kind === 'gather') {
          set({ activity: null, log: note(s.log, 'Stopped gathering before anything useful was carried back.') })
          return
        }
        if (a.kind === 'construction') {
          set({ activity: null, log: note(s.log, 'Stopped construction before this work block counted.') })
          return
        }
        // Leaving a shift early: pro-rata pay, no XP
        const hoursWorked = Math.max(0, (Date.now() - a.startedAt) / 3_600_000)
        const pay = Math.round((a.wage ?? 0) * Math.min(hoursWorked, SHIFT_HOURS) * (1 + wageBonusFrom(s.inventory)))
        set({
          activity: null,
          money: s.money + pay,
          log: note(s.log, pay > 0 ? `Left the shift early: +${formatMoney(pay)}, no experience earned.` : 'Left the shift before it started paying.'),
        })
      },

      takeJob: (jobId) => {
        const s = get()
        const job = jobById(jobId)
        if (!job) return
        if (s.level < job.requiredLevel) return
        set({ jobId, log: note(s.log, `Hired: ${job.title} at ${formatMoney(job.wage)}/h.`) })
      },

      buy: (itemId) => {
        const s = get()
        const item = itemById(itemId)
        if (!item || s.money < item.price) return
        track('first_purchase')
        // Daily challenge counter: every COMPLETED purchase bumps boughtToday.
        // Placeables count at placeAt(), not here — the buy is refundable via
        // cancelPlacing, and counting refundable buys made "Buy N items"
        // challenges farmable at zero cost (buy → cancel → repeat).
        const dailyCountersPatch = { dailyCounters: bumpBoughtToday(s) }

        if (item.placeable) {
          set({
            money: s.money - item.price,
            placing: item,
            panel: null,
            log: note(s.log, `${item.name} purchased. Click anywhere on Earth to place it.`),
          })
          return
        }

        if (item.grantXp) {
          const prog = applyXp(s.level, s.xp, item.grantXp)
          set({
            ...dailyCountersPatch,
            money: s.money - item.price,
            xp: prog.xp,
            level: prog.level,
            log: note(
              s.log,
              prog.levelsGained > 0
                ? `${item.name} complete: +${item.grantXp} XP — you reached level ${prog.level}!`
                : `${item.name} complete: +${item.grantXp} XP.`,
            ),
          })
          return
        }

        if (item.durable && (s.inventory[itemId] ?? 0) > 0) return

        // A pet becomes a living companion with its own hunger meter, not an
        // inventory row — same pattern as placed assets (per-instance state).
        if (item.pet) {
          const newPet: Pet = { itemId, hunger: 100, petId: `${itemId}-${Date.now()}` }
          // First-pet celebration — the moment the citizen becomes a pet parent.
          const wasFirstPet = s.pets.length === 0
          set({
            ...dailyCountersPatch,
            money: s.money - item.price,
            pets: [...s.pets, newPet],
            toasts: wasFirstPet
              ? withToast(s.toasts, `🐾 A pet! ${item.name} joins your life. Feed it daily.`, 'achieve')
              : s.toasts,
            log: note(s.log, wasFirstPet
              ? `Adopted your first pet: ${item.name}. Feed it ${formatMoney(item.pet.foodCostPerDay)}/day or it goes quiet.`
              : `Adopted ${item.name}. Feed it ${formatMoney(item.pet.foodCostPerDay)}/day or it goes quiet.`),
          })
          return
        }

        set({
          ...dailyCountersPatch,
          money: s.money - item.price,
          inventory: { ...s.inventory, [itemId]: (s.inventory[itemId] ?? 0) + 1 },
          // A fresh purchase resets the spoilage clock — groceries only
          groceryRestockedAt: item.shelfLifeDays
            ? { ...s.groceryRestockedAt, [itemId]: Date.now() }
            : s.groceryRestockedAt,
          // Combo chain: buying advances the combo.
          combo: comboXP(get(), 5).newCombo,
          comboLastActionAt: Date.now(),
          log: note(s.log, `Bought ${item.name}.`),
        })
      },

      placeAt: (lat, lng) => {
        const s = get()
        const item = s.placing
        if (!item) return

        // Build your reality in YOUR area first. The map is visible
        // everywhere; only your earned region is buildable.
        const center =
          s.citizen?.spawnLat !== undefined
            ? { lat: s.citizen.spawnLat, lng: s.citizen.spawnLng! }
            : s.assets[0] ?? (s.citizen ? DEFAULT_MAP_ANCHOR : null)
        if (center) {
          const reach = reachOf(
            s.level,
            s.assets.filter((a) => a.kind === 'business').length,
            s.assets.some((a) => a.kind === 'home'),
            netWorthOf(s.money, s.inventory, s.assets),
          )
          const d = distanceKm(center.lat, center.lng, lat, lng)
          if (d > reach.km) {
            const where = s.citizen?.homeCity ? ` around ${s.citizen.homeCity}` : ''
            set({
              toasts: withToast(s.toasts, `Beyond your reach — build in ${reach.label} first`, 'sky'),
              log: note(
                s.log,
                `That spot is ${Math.round(d)} km away — your reach is ${reach.label} (${reach.km} km${where}). ${reach.next ?? ''}`,
              ),
            })
            return
          }
        }
        if (item.category === 'business') {
          const recipe = businessConstructionRecipe(item)
          const project = createConstructionProjectFromRecipe(recipe, lat, lng)
          set({
            constructionProjects: [...s.constructionProjects, project],
            placing: null,
            selectedMapTarget: { kind: 'construction', id: project.id },
            panel: 'construction',
            // The business purchase becomes irreversible once its foundation is
            // placed; it only starts earning after construction completes.
            dailyCounters: bumpBoughtToday(s),
            log: note(s.log, `${item.name} foundation placed at ${lat.toFixed(1)}°, ${lng.toFixed(1)}°. Build it before it can open.`),
            toasts: withToast(s.toasts, `${item.name} foundation placed. Gather materials, pay the permit, and build it.`, 'gold'),
          })
          return
        }

        const asset: PlacedAsset = {
          id: `${item.id}-${Date.now()}`,
          itemId: item.id,
          kind: 'home',
          name: item.name,
          lat,
          lng,
          incomePerDay: item.incomePerDay ?? 0,
          pendingIncome: 0,
          placedAtMinute: 0,
        }
        set({
          assets: [...s.assets, asset],
          placing: null,
          selectedMapTarget: { kind: 'asset', id: asset.id },
          // The placeable purchase COMPLETES here (buy was refundable until
          // placement) — this is where it counts for "Buy N items" challenges.
          dailyCounters: bumpBoughtToday(s),
          log: note(s.log, `${item.name} opened at ${lat.toFixed(1)}°, ${lng.toFixed(1)}°.`),
        })
        track(asset.kind === 'home' ? 'first_home_placed' : 'first_business_placed')
        publishPlacedAsset(s.citizen, asset)
      },

      cancelPlacing: () => {
        const s = get()
        if (!s.placing) return
        set({ money: s.money + s.placing.price, placing: null, log: note(s.log, `${s.placing.name} refunded.`) })
      },

      collectIncome: () => {
        const s = get()
        const total = s.assets.reduce((sum, a) => sum + a.pendingIncome, 0)
        if (total < 1) return
        track('first_collect')
        // First-collection celebration — the moment the economy "works" for
        // the player. A distinct toast so they feel the milestone.
        const wasFirst = s.totalCollected === 0
        // Combo chain: collecting advances the combo.
        const { bonusXP, comboToast, newCombo } = comboXP(s, 10)
        const xpProg = bonusXP > 0 ? applyXp(s.level, s.xp, bonusXP) : { level: s.level, xp: s.xp }
        const toasts = wasFirst
          ? withToast(withToast(s.toasts, `💰 Your first income! The economy works.`, 'achieve'), `Collected ${formatMoney(Math.floor(total))}`, 'gold')
          : withToast(s.toasts, `Collected ${formatMoney(Math.floor(total))}`, 'gold')
        const finalToasts = comboToast ? withToast(toasts, comboToast, 'gold') : toasts
        set({
          money: s.money + Math.floor(total),
          assets: s.assets.map((a) => ({ ...a, pendingIncome: 0 })),
          totalCollected: s.totalCollected + Math.floor(total),
          level: xpProg.level,
          xp: xpProg.xp,
          combo: newCombo,
          comboLastActionAt: Date.now(),
          toasts: finalToasts,
          log: note(s.log, wasFirst
            ? `Collected your first business income: ${formatMoney(Math.floor(total))}. The economy works.`
            : `Collected ${formatMoney(Math.floor(total))} from your businesses.`),
        })
      },

      upgradeBusiness: (assetId) => {
        // The incremental-depth hook: pay cash to multiply a business's
        // income. baseIncome is derived from current income / level (since
        // incomePerDay stores the level-adjusted value, the engine reads it
        // directly with no changes). See businessUpgrades.ts for the curve.
        const s = get()
        const asset = s.assets.find((a) => a.id === assetId)
        if (!asset || asset.kind !== 'business') return
        const level = asset.level ?? 1
        const baseIncome = asset.incomePerDay / level
        const out = upgradeOutcome(baseIncome, level)
        if (!out) return
        if (s.money < out.cost) {
          set({ log: note(s.log, `Upgrade needs ${formatMoney(out.cost)} — you have ${formatMoney(s.money)}.`), toasts: withToast(s.toasts, `Need ${formatMoney(out.cost)} to upgrade — you have ${formatMoney(s.money)}.`, 'blocked') })
          return
        }
        // Analytics: first upgrade + max-level milestone.
        if (level === 1) track('first_upgrade')
        if (out.newLevel >= MAX_BUSINESS_LEVEL) track('business_maxed')
        // First-upgrade celebration — the moment the player discovers the
        // upgrade system. A distinct toast so they feel the milestone.
        const wasFirstUpgrade = level === 1
        const upgradeToasts = wasFirstUpgrade
          ? withToast(withToast(s.toasts, `📈 Your first upgrade! Businesses can grow.`, 'achieve'), `📈 ${asset.name} upgraded to L${out.newLevel}! +${formatMoney(out.incomeDelta)}/day`, 'gold')
          : withToast(s.toasts, `📈 ${asset.name} upgraded to L${out.newLevel}! +${formatMoney(out.incomeDelta)}/day`, 'gold')
        set({
          money: s.money - out.cost,
          assets: s.assets.map((a) =>
            a.id === assetId
              ? { ...a, level: out.newLevel, incomePerDay: out.newIncome }
              : a,
          ),
          toasts: upgradeToasts,
          log: note(s.log, `${asset.name} upgraded to level ${out.newLevel} (income ${formatMoney(out.newIncome)}/day) for ${formatMoney(out.cost)}.`),
          // Maxing a business (L10) is a multi-month achievement — the
          // geometric cost curve means ~$millions invested. It earns the
          // gold-tier celebration overlay (queued if another is showing).
          celebration: out.newLevel >= MAX_BUSINESS_LEVEL
            ? (!s.celebration
                ? { icon: '🏭', title: `${asset.name} — MAX LEVEL!`, detail: `Fully upgraded. Earning ${formatMoney(out.newIncome)}/day — a true empire pillar.`, tone: 'gold' as const }
                : s.celebration)
            : s.celebration,
          celebrationQueue: out.newLevel >= MAX_BUSINESS_LEVEL && s.celebration
            ? [...s.celebrationQueue, { icon: '🏭', title: `${asset.name} — MAX LEVEL!`, detail: `Fully upgraded. Earning ${formatMoney(out.newIncome)}/day — a true empire pillar.`, tone: 'gold' as const }]
            : s.celebrationQueue,
        })
      },

      claimTutorial: (stepId, xp) => {
        const s = get()
        if (s.tutorialClaimed.includes(stepId)) return
        const prog = applyXp(s.level, s.xp, xp)
        const newClaimed = [...s.tutorialClaimed, stepId]
        // Completion nudge: when the player claims the FINAL tutorial step,
        // the onboarding panel will disappear. Send them off with a pointer
        // to the retention engine so the sandbox doesn't feel empty. This is
        // the hand-off from "we're teaching you" to "now chase your own goals".
        let toasts = s.toasts
        let log = s.log
        if (newClaimed.length >= TUTORIAL_STEPS.length) {
          toasts = withToast(toasts, "You've learned the basics. Now chase 25 achievements 🏆 and build a daily streak 🔥!", 'achieve')
          log = note(log, 'Tutorial complete. The retention engine — achievements, streaks, lucky moments — is now your guide.')
          track('tutorial_complete')
        }
        set({
          tutorialClaimed: newClaimed,
          xp: prog.xp,
          level: prog.level,
          toasts,
          log: note(
            log,
            prog.levelsGained > 0
              ? `Objective complete: +${xp} XP — level ${prog.level}!`
              : `Objective complete: +${xp} XP.`,
          ),
        })
      },

      buyBooster: (type) => {
        const s = get()
        const def = BOOSTERS[type]
        if (s.money < def.cost) {
          set({ toasts: withToast(s.toasts, `Need ${formatMoney(def.cost)} for a ${def.name}.`, 'blocked') })
          return
        }
        const now = Date.now()
        // Re-buying extends the timer, capped at 2 durations of remaining
        // time — the booster is a use-it-NOW session mechanic, not a bankable
        // stockpile (uncapped extension let players queue 10+ hours of 2x).
        const existing = s.activeBoosters.find((b) => b.type === type)
        const expiresAt = existing
          ? Math.min(existing.expiresAt + def.durationMs, now + def.durationMs * 2)
          : now + def.durationMs
        set({
          money: s.money - def.cost,
          activeBoosters: [
            ...s.activeBoosters.filter((b) => b.type !== type),
            { type, expiresAt },
          ],
          toasts: withToast(s.toasts, `${def.emoji} ${def.name} active! ${def.multiplier}x for 30 min.`, 'gold'),
          log: note(s.log, `Activated ${def.name} (${formatMoney(def.cost)}): ${def.description}`),
        })
      },

      claimGoldenOpportunity: () => {
        const s = get()
        if (!s.goldenOpportunity) return
        const opp = s.goldenOpportunity
        // Enforce the window at claim time too — expiry normally happens on
        // the next tick, but hidden-tab timer throttling stretches ticks to
        // ~60s, letting an expired prompt linger claimable.
        if (Date.now() - opp.spawnedAt > OPPORTUNITY_WINDOW_MS) {
          set({ goldenOpportunity: null })
          return
        }
        const prog = applyXp(s.level, s.xp, opp.xp)
        set({
          goldenOpportunity: null,
          money: s.money + opp.cash,
          level: prog.level,
          xp: prog.xp,
          toasts: withToast(s.toasts, `${opp.icon} Claimed! +${formatMoney(opp.cash)}, +${opp.xp} XP`, 'gold'),
          log: note(s.log, `Claimed a golden opportunity: ${opp.label} (+${formatMoney(opp.cash)}, +${opp.xp} XP).`),
        })
      },

      openMysteryBox: (tier) => {
        const s = get()
        const def = MYSTERY_BOXES[tier]
        if (s.money < def.cost) {
          set({ toasts: withToast(s.toasts, `Need ${formatMoney(def.cost)} for a ${def.name}.`, 'blocked') })
          return
        }
        const reward = openBox(tier)
        const prog = applyXp(s.level, s.xp, reward.xp)
        set({
          money: s.money - def.cost + reward.cash,
          level: prog.level,
          xp: prog.xp,
          mysteryBoxesOpened: s.mysteryBoxesOpened + 1,
          lastBoxReward: { ...reward, tier },
          toasts: withToast(s.toasts, `${reward.icon} ${def.name}: ${reward.label} +${formatMoney(reward.cash)}, +${reward.xp} XP`, reward.rarity === 'jackpot' ? 'legendary' : reward.rarity === 'rare' ? 'lucky' : 'gold'),
          log: note(s.log, `Opened a ${def.name} (${formatMoney(def.cost)}): ${reward.label} — ${formatMoney(reward.cash)} + ${reward.xp} XP.`),
        })
      },

      clearBoxReward: () => set({ lastBoxReward: null }),

      // Achievements: idempotent — claiming twice is a no-op. Grants XP + cash
      // bounty (the society pays its achievers). UI offers the claim button only
      // when the achievement isUnlocked and not yet claimed.
      claimAchievement: (achievementId) => {
        const s = get()
        if (s.achievementsClaimed.includes(achievementId)) return
        const ach = ACHIEVEMENTS.find((a) => a.id === achievementId)
        if (!ach) return
        const prog = applyXp(s.level, s.xp, ach.xp)
        set({
          achievementsClaimed: [...s.achievementsClaimed, achievementId],
          xp: prog.xp,
          level: prog.level,
          money: s.money + ach.bounty,
          toasts: withToast(s.toasts, `🏆 ${ach.title} — +${ach.xp} XP, ${formatMoney(ach.bounty)}`, 'gold'),
          log: note(
            s.log,
            prog.levelsGained > 0
              ? `Achievement unlocked: ${ach.title} — +${ach.xp} XP, ${formatMoney(ach.bounty)}. Level ${prog.level}!`
              : `Achievement unlocked: ${ach.title} — +${ach.xp} XP, ${formatMoney(ach.bounty)}.`,
          ),
        })
      },

      generateAvatar: async (params) => {
        // A citizen created offline (or whose first registration didn't stick)
        // has no token yet — register on demand so the studio just works instead
        // of dead-ending on "connect first".
        if (get().citizen && !get().citizen?.token) await get().registerOnline()
        const s = get()
        if (!s.citizen?.token) return 'Connect to the world first — the avatar studio needs an online citizen.'
        const d = await tryPost('/api/avatar', {
          citizenId: s.citizen.citizenId,
          token: s.citizen.token,
          params,
        })
        if (!d?.ok) return (d?.error as string) ?? 'The avatar studio is unreachable. Try again.'
        set({
          citizen: { ...get().citizen!, avatarUrl: d.url as string },
          log: note(get().log, 'Your avatar is ready — that\'s you now.'),
        })
        track('avatar_created')
        void get().pushCloudSave()
        return null
      },

      toggleTutorial: () => set({ tutorialHidden: !get().tutorialHidden }),
      setStreetMode: (on) => {
        if (on) track('walk_mode_entered')
        set({ streetMode: on, panel: null })
      },
      selectMapTarget: (target) => set({ selectedMapTarget: target }),
      setPanel: (panel) => set({ panel }),
      reset: () => set({ citizen: null, ...FRESH }),
    }),
    {
      name: SAVE_KEY,
      version: SAVE_VERSION,
      // v2 adds hydration; v3 adds pets; v4 adds illness; v5 adds daily streak +
      // lucky moments; v6 adds milestones/boxes/boosters/savings/daily-challenge
      // fields. IMPORTANT: zustand/persist only calls migrate when the stored
      // version differs — every new persisted field needs a version bump or its
      // backfill is dead code for existing saves (the v5→v6 bug: veterans were
      // re-shown the achievements nudge + street overlay because the
      // conditional backfills never ran).
      // Extracted to migrateSave() above so it can be regression-tested.
      migrate: migrateSave,
      // Re-apply the persisted volume to the audio engine on load — the module
      // inits at 1.0 and was only synced when the player touched the slider.
      onRehydrateStorage: () => (state) => {
        applySoundVolume(state?.soundVolume ?? 1)
      },
      partialize: (state) =>
        Object.fromEntries(
          Object.entries(state).filter(
            ([key]) =>
              key !== 'streetMode' &&
              key !== 'awayReport' &&
              key !== 'celebration' &&
              key !== 'celebrationQueue' &&
              key !== 'lastBoxReward' &&
              key !== 'goldenOpportunity' &&
              key !== 'toasts' &&
              key !== 'marketNeed' &&
              key !== 'selectedMapTarget' &&
              key !== 'online' &&
              key !== 'dismissedOfflineAt',
          ),
        ) as GameState,
    },
  ),
)
