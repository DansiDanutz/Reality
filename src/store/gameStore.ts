import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Citizen, Illness, Needs, Pet, PlacedAsset, ShopItem } from '../game/types'
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
import { rollLuckyMoment, pickLuckyMoment, RARITY_META } from '../game/luckyMoments'
import { upgradeOutcome } from '../game/businessUpgrades'
import {
  challengesForDay,
  challengeProgress,
  challengeSetSummary,
  CHALLENGE_REWARD,
  DAILY_COMPLETE_BONUS,
  type DailyChallengeSnapshot,
} from '../game/dailyChallenges'
import { track } from '../lib/analytics'
import { setSoundVolume as applySoundVolume } from '../lib/sound'
import { type AvatarParams } from '../lib/avatarPrompt'
import { detectLocation, type SpawnLocation } from '../lib/geo'

export type PanelId = 'shop' | 'work' | 'assets' | 'top' | 'profile' | 'health' | 'cook' | 'achievements' | 'journal' | null

/**
 * Toast tone — drives both the visual toast color and the chime. Widened
 * from the original 4 (gold/sky/ok/meal) to give achievements, lucky
 * moments, streaks, and legendary jackpots their own distinct sound. The
 * sound module's ChimeKind must match this union exactly.
 */
export type ToastTone = 'gold' | 'ok' | 'sky' | 'meal' | 'achieve' | 'streak' | 'lucky' | 'legendary'

const SAVE_KEY = 'reality-save-v1'

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
        // sawAchievementsPanel: existing players who've completed the original
        // 8-step tutorial shouldn't be re-nudged to "discover achievements".
        // If they've claimed ≥7 tutorial steps (the original count), mark this
        // as seen so the new 9th step doesn't re-appear for veterans.
        if (state && state.sawAchievementsPanel === undefined) {
          const claimedCount = state.tutorialClaimed?.length ?? 0
          state.sawAchievementsPanel = claimedCount >= 7
        }
        if (state && !state.dailyCounters) {
          state.dailyCounters = { mealsToday: 0, shiftsToday: 0, earnedToday: 0, sleptToday: 0, boughtToday: 0, day: 0 }
        }
        if (state && !state.dailyClaimed) state.dailyClaimed = []
        if (state && state.dailyBonusClaimed === undefined) state.dailyBonusClaimed = false
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
  /** Pets the citizen owns — each alive on its own hunger meter (issue #9) */
  pets: Pet[]
  /** ms timestamp each grocery id was last restocked — the spoilage clock */
  groceryRestockedAt: Record<string, number>
  /** Item awaiting a map click for placement */
  placing: ShopItem | null
  panel: PanelId
  log: string[]
  cloudSyncedAt: number | null
  /** First-person Street Mode (not persisted) */
  streetMode: boolean
  /** Category the Market should open on (set by quick actions) */
  marketFocus: ShopCategory | null
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
  /** Daily challenge counters — reset at local midnight. See dailyChallenges.ts */
  dailyCounters: { mealsToday: number; shiftsToday: number; earnedToday: number; sleptToday: number; boughtToday: number; day: number }
  /** Daily challenge ids already claimed today (idempotent — no double-grant). */
  dailyClaimed: string[]
  /** True once today's all-3-complete bonus has been granted. */
  dailyBonusClaimed: boolean
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
  /** Welcome-back card content after time away (not persisted) */
  awayReport: string | null
  dismissAwayReport: () => void
  /** Transient celebration overlay (not persisted) — set for the biggest moments only. */
  celebration: { icon: string; title: string; detail?: string; reward?: string; tone: 'legendary' | 'gold' | 'level' | 'daily' } | null
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
  quickDrink: () => void
  startGig: () => void
  markTargetsSeen: () => void
  markAchievementsSeen: () => void
  createCitizen: (name: string, spawn?: SpawnLocation | null) => void
  ensureSpawn: () => Promise<void>
  generateAvatar: (params: AvatarParams) => Promise<string | null>
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
  placeAt: (lat: number, lng: number) => void
  cancelPlacing: () => void
  collectIncome: () => void
  claimTutorial: (stepId: string, xp: number) => void
  /** Claim one achievement's XP + cash bounty (idempotent by id) */
  claimAchievement: (achievementId: string) => void
  toggleTutorial: () => void
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
  pets: [] as Pet[],
  groceryRestockedAt: {} as Record<string, number>,
  placing: null as ShopItem | null,
  panel: null as PanelId,
  log: [] as string[],
  cloudSyncedAt: null as number | null,
  streetMode: false,
  marketFocus: null as ShopCategory | null,
  lastFountainAt: 0,
  lastFoodBankAt: 0,
  illness: null as Illness | null,
  lastIllnessRollAt: 0,
  targetsSeen: false,
  sawAchievementsPanel: false,
  dailyCounters: { mealsToday: 0, shiftsToday: 0, earnedToday: 0, sleptToday: 0, boughtToday: 0, day: 0 },
  dailyClaimed: [] as string[],
  dailyBonusClaimed: false,
  reachTier: 1,
  streakLength: 0,
  streakLastClaimDay: 0,
  streakBest: 0,
  luckyMomentsSeen: 0,
  luckyMomentsSeenIds: [] as string[],
  awayReport: null as string | null,
  celebration: null as GameState['celebration'],
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

      registerOnline: async () => {
        const s = get()
        if (!s.citizen || s.citizen.token) return
        let d = await tryPost('/api/register', { name: s.citizen.name })
        const cur = get()
        if (!cur.citizen || cur.citizen.token) return

        if (!d?.ok) {
          // Unique names: on collision, take a numbered variant and retry once
          if (d?.code === 'name_taken') {
            const variant = `${cur.citizen.name.slice(0, 19)}-${Math.floor(100 + Math.random() * 900)}`
            set({
              citizen: { ...cur.citizen, name: variant },
              log: note(cur.log, `"${cur.citizen.name}" was already a citizen — you are ${variant}.`),
            })
            const retry = await tryPost('/api/register', { name: variant })
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
          void tryPost('/api/world', {
            citizenId: citizen?.citizenId,
            token: citizen?.token,
            assetId: a.id,
            itemId: a.itemId,
            kind: a.kind,
            lat: a.lat,
            lng: a.lng,
          })
        }
        void get().reportScore()
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
        if (out.xpGained > 0) {
          const prog = applyXp(level, xp, out.xpGained)
          if (prog.level > level) toasts = withToast(toasts, `Level ${prog.level} reached!`, 'sky')
          level = prog.level
          xp = prog.xp
        }
        if (out.shiftsCompleted > 0 && !wasAway) {
          log = note(log, `Shift complete: +${formatMoney(out.wagesEarned)}.`)
          toasts = withToast(toasts, `Shift complete +${formatMoney(out.wagesEarned)}`, 'gold')
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
        let money = out.money
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
          const needsFirstWin = s.luckyMomentsSeen === 0 && isNew
          // 5% per tick for 20 min => ~100% chance the first session lands one.
          // Uses pickLuckyMoment (no chance gate) so the weighted pick + cash
          // roll use the real RNG, undistorted by the boosted gate.
          const lucky = needsFirstWin
            ? (Math.random() < 0.05 ? pickLuckyMoment() : null)
            : rollLuckyMoment()
          if (lucky) {
            const prog = applyXp(level, xp, lucky.xp)
            level = prog.level
            xp = prog.xp
            money += lucky.money
            s.luckyMomentsSeen = s.luckyMomentsSeen + 1
            if (!s.luckyMomentsSeenIds.includes(lucky.id)) {
              s.luckyMomentsSeenIds = [...s.luckyMomentsSeenIds, lucky.id]
            }
            const icon = RARITY_META[lucky.rarity].icon
            const label = RARITY_META[lucky.rarity].label.toUpperCase()
            toasts = withToast(toasts, `${icon} ${label}! ${lucky.text} (+${formatMoney(lucky.money)}, +${lucky.xp} XP)`, lucky.rarity === 'legendary' ? 'legendary' : 'lucky')
            log = note(log, `${label} lucky moment: ${lucky.text} (+${formatMoney(lucky.money)}, +${lucky.xp} XP)`)
            // Legendary jackpots earn a full celebration overlay — they're
            // once-in-a-lifetime events that deserve more than a toast.
            if (lucky.rarity === 'legendary') {
              s.celebration = {
                icon: '🌟',
                title: 'LEGENDARY!',
                detail: lucky.text,
                reward: `+${formatMoney(lucky.money)} · +${lucky.xp} XP`,
                tone: 'legendary',
              }
            }
          }
        }

        // Auto-claim newly-unlocked achievements — the dopamine hit lands the
        // instant the player earns it (e.g. the 10th shift flips "Reliable"),
        // not on a manual panel visit. XP + bounty granted here, idempotently.
        const postState = { ...s, shiftsWorked: s.shiftsWorked + out.shiftsCompleted, level, timesEaten, money, needs, assets: out.assets, inventory: out.inventory }
        const newlyEarned = newlyUnlocked(achievementSnapshotOf(postState), s.achievementsClaimed)
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
            log = note(log, `Achievement unlocked: ${a.title} — ${a.detail}`)
          }
          // Gold-tier achievements earn a celebration overlay — they're the
          // long-term grails (level 20, 30-day streak, 10 businesses...).
          const gold = newlyEarned.find((a) => a.tier === 'gold')
          if (gold && !s.celebration) {
            s.celebration = {
              icon: '🥇',
              title: gold.title,
              detail: gold.detail,
              reward: `+${gold.xp} XP · ${formatMoney(gold.bounty)}`,
              tone: 'gold',
            }
          }
          s.achievementsClaimed = [...s.achievementsClaimed, ...earnedIds]
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
        const streakPrev: StreakState = { length: s.streakLength, lastClaimDay: s.streakLastClaimDay }
        const streakOut = computeStreakClaim(streakPrev, todayDay)
        if (streakOut) {
          streakLength = streakOut.length
          streakLastClaimDay = todayDay
          if (streakOut.length > s.streakBest) s.streakBest = streakOut.length
          // Day 1 (spawn day) and grace-day holds pay nothing and stay quiet.
          if (streakOut.advanced && (streakOut.cash > 0 || streakOut.xp > 0)) {
            const prog = applyXp(level, xp, streakOut.xp)
            level = prog.level
            xp = prog.xp
            money += streakOut.cash
            const label = streakLabel(streakOut.length)
            toasts = withToast(toasts, `🔥 ${label}! +${formatMoney(streakOut.cash)}, +${streakOut.xp} XP`, 'streak')
            log = note(log, `Day ${streakOut.length} streak — claimed ${formatMoney(streakOut.cash)} and ${streakOut.xp} XP.`)
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
            log = note(log, `Streak reset after a long absence (was ${prev} days). Day 1 of a new streak. Best streak ${s.streakBest} days is preserved.`)
          }
        }

        // Level-up celebration — fires at milestone levels (every 5th). A
        // regular level-up gets a toast; a 5th, 10th, 15th, 20th... gets the
        // full overlay. Checked here (end of tick) so it catches level-ups
        // from any XP source (engine, achievements, lucky, streak, daily).
        if (level > startingLevel && level % 5 === 0 && level >= 5 && !s.celebration) {
          s.celebration = {
            icon: '⭐',
            title: `Level ${level}!`,
            detail: 'A new tier of achievements and reach may have unlocked.',
            tone: 'level',
          }
        }

        // Daily challenges — counters reset at local midnight, increment by
        // this tick's deltas, auto-grant on completion. See dailyChallenges.ts.
        let dailyCounters = s.dailyCounters
        let dailyClaimed = s.dailyClaimed
        let dailyBonusClaimed = s.dailyBonusClaimed
        if (dailyCounters.day !== todayDay) {
          // Midnight rollover (or first tick of a new citizen): fresh slate.
          dailyCounters = { mealsToday: 0, shiftsToday: 0, earnedToday: 0, sleptToday: 0, boughtToday: 0, day: todayDay }
          dailyClaimed = []
          dailyBonusClaimed = false
        }
        // Increment by this tick's deltas. mealsCooked is the per-tick meal
        // count; shiftsCompleted is per-tick shifts; wagesEarned + collected
        // income is the cash earned this tick. Sleeps are inferred from
        // activity kind transitions (a finished sleep activity).
        const mealsDelta = out.mealsCooked
        const shiftsDelta = out.shiftsCompleted
        const cashDelta = out.wagesEarned + Math.max(0, money - s.money)
        const sleptDelta = s.activity?.kind === 'sleep' && out.activity?.kind !== 'sleep' ? 1 : 0
        if (mealsDelta || shiftsDelta || cashDelta || sleptDelta) {
          dailyCounters = {
            ...dailyCounters,
            mealsToday: dailyCounters.mealsToday + mealsDelta,
            shiftsToday: dailyCounters.shiftsToday + shiftsDelta,
            earnedToday: dailyCounters.earnedToday + cashDelta,
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
                toasts = withToast(toasts, `🎯 All 3 daily challenges! Bonus +${formatMoney(DAILY_COMPLETE_BONUS.cash)}, +${DAILY_COMPLETE_BONUS.xp} XP`, 'achieve')
                log = note(log, `All daily challenges complete — bonus ${formatMoney(DAILY_COMPLETE_BONUS.cash)} + ${DAILY_COMPLETE_BONUS.xp} XP.`)
                if (!s.celebration) {
                  s.celebration = {
                    icon: '🎯',
                    title: 'All 3 daily challenges!',
                    detail: 'A perfect day. Come back tomorrow for a fresh set.',
                    reward: `+${formatMoney(DAILY_COMPLETE_BONUS.cash)} · +${DAILY_COMPLETE_BONUS.xp} XP`,
                    tone: 'daily',
                  }
                }
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
          groceryRestockedAt: out.groceryRestockedAt,
          timesEaten,
          achievementsClaimed: s.achievementsClaimed,
          reachTier,
          streakLength,
          streakLastClaimDay,
          streakBest: s.streakBest,
          luckyMomentsSeen: s.luckyMomentsSeen,
          luckyMomentsSeenIds: s.luckyMomentsSeenIds,
          dailyCounters,
          dailyClaimed,
          dailyBonusClaimed,
          awayReport,
          celebration: s.celebration,
          toasts,
          log,
        })
      },

      dismissAwayReport: () => set({ awayReport: null }),
      dismissCelebration: () => set({ celebration: null }),
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

      openMarket: (focus) => set({ marketFocus: focus ?? null, panel: 'shop' }),

      // One tap, one dollar, half the water bar — hydration without friction
      quickDrink: () => {
        const s = get()
        if (s.activity?.kind === 'sleep') return
        const water = itemById('water')
        if (!water?.effects || s.money < water.price) return
        set({
          money: s.money - water.price,
          needs: applyEffects(s.needs, water.effects),
          log: note(s.log, 'Water. Your body says thanks.'),
        })
      },

      // A half-hour delivery gig — no employer needed, always available
      startGig: () => {
        const s = get()
        if (s.activity) return
        if (fluBlocksWork(s.illness)) {
          set({ log: note(s.log, 'Down with the flu — rest it out, or Flu Medicine ($35) is on the Health shelf.') })
          return
        }
        if (s.needs.energy < 15 || s.health < 20) {
          set({ log: note(s.log, 'Too worn down even for a gig. Drink, eat, rest.') })
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
        // Daily challenge counter: every successful purchase bumps boughtToday.
        const home = s.assets.find((a) => a.kind === 'home')
        const anchorLat = home ? home.lat : s.citizen?.spawnLat
        const anchorLng = home ? home.lng : s.citizen?.spawnLng
        const todayDay = dayIndexOf(Date.now(), anchorLat, anchorLng)
        const dailyCounters = s.dailyCounters.day === todayDay
          ? { ...s.dailyCounters, boughtToday: s.dailyCounters.boughtToday + 1 }
          : { mealsToday: 0, shiftsToday: 0, earnedToday: 0, sleptToday: 0, boughtToday: 1, day: todayDay }
        const dailyCountersPatch = { dailyCounters }

        if (item.placeable) {
          set({
            ...dailyCountersPatch,
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
          set({
            money: s.money - item.price,
            pets: [...s.pets, newPet],
            log: note(s.log, `Adopted ${item.name}. Feed it ${formatMoney(item.pet.foodCostPerDay)}/day or it goes quiet.`),
          })
          return
        }

        set({
          money: s.money - item.price,
          inventory: { ...s.inventory, [itemId]: (s.inventory[itemId] ?? 0) + 1 },
          // A fresh purchase resets the spoilage clock — groceries only
          groceryRestockedAt: item.shelfLifeDays
            ? { ...s.groceryRestockedAt, [itemId]: Date.now() }
            : s.groceryRestockedAt,
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
            : s.assets[0] ?? null
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
        const asset: PlacedAsset = {
          id: `${item.id}-${Date.now()}`,
          itemId: item.id,
          kind: item.category === 'home' ? 'home' : 'business',
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
          log: note(s.log, `${item.name} opened at ${lat.toFixed(1)}°, ${lng.toFixed(1)}°.`),
        })
        track(asset.kind === 'home' ? 'first_home_placed' : 'first_business_placed')
        if (s.citizen?.token) {
          void tryPost('/api/world', {
            citizenId: s.citizen.citizenId,
            token: s.citizen.token,
            assetId: asset.id,
            itemId: asset.itemId,
            kind: asset.kind,
            lat: asset.lat,
            lng: asset.lng,
          })
        }
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
        set({
          money: s.money + Math.floor(total),
          assets: s.assets.map((a) => ({ ...a, pendingIncome: 0 })),
          totalCollected: s.totalCollected + Math.floor(total),
          toasts: withToast(s.toasts, `Collected ${formatMoney(Math.floor(total))}`, 'gold'),
          log: note(s.log, `Collected ${formatMoney(Math.floor(total))} from your businesses.`),
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
          set({ log: note(s.log, `Upgrade needs ${formatMoney(out.cost)} — you have ${formatMoney(s.money)}.`) })
          return
        }
        set({
          money: s.money - out.cost,
          assets: s.assets.map((a) =>
            a.id === assetId
              ? { ...a, level: out.newLevel, incomePerDay: out.newIncome }
              : a,
          ),
          toasts: withToast(s.toasts, `📈 ${asset.name} upgraded to L${out.newLevel}! +${formatMoney(out.incomeDelta)}/day`, 'gold'),
          log: note(s.log, `${asset.name} upgraded to level ${out.newLevel} (income ${formatMoney(out.newIncome)}/day) for ${formatMoney(out.cost)}.`),
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
      setPanel: (panel) => set({ panel }),
      reset: () => set({ citizen: null, ...FRESH }),
    }),
    {
      name: SAVE_KEY,
      version: 5,
      // v2 adds hydration; v3 adds pets; v4 adds illness; v5 adds daily streak + lucky moments.
      // Extracted to migrateSave() above so it can be regression-tested.
      migrate: migrateSave,
      partialize: (state) =>
        Object.fromEntries(
          Object.entries(state).filter(
            ([key]) =>
              key !== 'streetMode' &&
              key !== 'awayReport' &&
              key !== 'celebration' &&
              key !== 'toasts' &&
              key !== 'online' &&
              key !== 'dismissedOfflineAt',
          ),
        ) as GameState,
    },
  ),
)
