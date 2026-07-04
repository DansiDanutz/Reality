import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Citizen, Needs, Pet, PlacedAsset, ShopItem } from '../game/types'
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
import { track } from '../lib/analytics'
import { type AvatarParams } from '../lib/avatarPrompt'
import { detectLocation, type SpawnLocation } from '../lib/geo'

export type PanelId = 'shop' | 'work' | 'assets' | 'top' | 'profile' | 'health' | 'cook' | null

const SAVE_KEY = 'reality-save-v1'

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
  /** One-time "How Reality works" targets screen */
  targetsSeen: boolean
  /** Territorial progression: highest reach tier celebrated so far */
  reachTier: number
  /** Welcome-back card content after time away (not persisted) */
  awayReport: string | null
  dismissAwayReport: () => void
  /** Feedback toasts (not persisted) */
  toasts: { id: number; text: string; tone: 'gold' | 'ok' | 'sky' | 'meal' }[]
  popToast: (id: number) => void
  soundOn: boolean
  toggleSound: () => void
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
  placeAt: (lat: number, lng: number) => void
  cancelPlacing: () => void
  collectIncome: () => void
  claimTutorial: (stepId: string, xp: number) => void
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
  targetsSeen: false,
  reachTier: 1,
  awayReport: null as string | null,
  toasts: [] as { id: number; text: string; tone: 'gold' | 'ok' | 'sky' | 'meal' }[],
  // Optimistic: assume online until an /api/* call proves otherwise. The banner
  // only surfaces when something actually fails, so a cold start in airplane
  // mode isn't greeted with a false "offline" claim before any fetch.
  online: true,
  dismissedOfflineAt: 0,
  soundOn: true,
  hudLayout: {} as Record<string, { x?: number; y?: number; w?: number; min?: boolean }>,
  hudDockOrder: ['objectives', 'citizen', 'vitals', 'guide', 'finance'] as string[],
}

const note = (log: string[], msg: string) => [msg, ...log].slice(0, 30)

let toastId = 0
const withToast = (
  toasts: { id: number; text: string; tone: 'gold' | 'ok' | 'sky' | 'meal' }[],
  text: string,
  tone: 'gold' | 'ok' | 'sky' | 'meal',
) => [...toasts.slice(-3), { id: ++toastId, text, tone }]

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
          },
          from,
          now,
        )

        let log = s.log
        let toasts = s.toasts
        let { level, xp } = s
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
          pets: out.pets,
          inventory: out.inventory,
          groceryRestockedAt: out.groceryRestockedAt,
          timesEaten,
          reachTier,
          awayReport,
          toasts,
          log,
        })
      },

      dismissAwayReport: () => set({ awayReport: null }),
      popToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
      toggleSound: () => set({ soundOn: !get().soundOn }),
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

      consume: (itemId) => {
        const s = get()
        if (s.activity?.kind === 'sleep') return
        const item = itemById(itemId)
        if (!item || !item.effects) return
        const owned = s.inventory[itemId] ?? 0
        if (owned <= 0) return
        set({
          needs: applyEffects(s.needs, item.effects),
          inventory: item.durable ? s.inventory : { ...s.inventory, [itemId]: owned - 1 },
          timesEaten: (item.effects.hunger ?? 0) > 0 ? s.timesEaten + 1 : s.timesEaten,
          log: note(s.log, `${item.name} — done.`),
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

      claimTutorial: (stepId, xp) => {
        const s = get()
        if (s.tutorialClaimed.includes(stepId)) return
        const prog = applyXp(s.level, s.xp, xp)
        set({
          tutorialClaimed: [...s.tutorialClaimed, stepId],
          xp: prog.xp,
          level: prog.level,
          log: note(
            s.log,
            prog.levelsGained > 0
              ? `Objective complete: +${xp} XP — level ${prog.level}!`
              : `Objective complete: +${xp} XP.`,
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
      version: 3,
      // v2 adds hydration; v3 adds pets — old saves get an empty menagerie
      migrate: (persisted) => {
        const state = persisted as GameState
        if (state?.needs && state.needs.hydration === undefined) {
          state.needs = { ...state.needs, hydration: 75 }
        }
        if (state && !state.pets) state.pets = []
        return state
      },
      partialize: (state) =>
        Object.fromEntries(
          Object.entries(state).filter(
            ([key]) =>
              key !== 'streetMode' &&
              key !== 'awayReport' &&
              key !== 'toasts' &&
              key !== 'online' &&
              key !== 'dismissedOfflineAt',
          ),
        ) as GameState,
    },
  ),
)
