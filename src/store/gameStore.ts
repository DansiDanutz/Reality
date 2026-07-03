import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Citizen, Needs, PlacedAsset, ShopItem } from '../game/types'
import {
  SHIFT_HOURS,
  SLEEP_HOURS,
  applyEffects,
  applyXp,
  formatMoney,
  liveRealtime,
  netWorthOf,
  rollEvent,
  wageBonusFrom,
  type Activity,
} from '../game/engine'
import { CITIZEN_BALANCE, FOUNDER_BALANCE, itemById, jobById } from '../game/catalog'
import { type AvatarParams } from '../lib/avatarPrompt'
import { detectLocation, type SpawnLocation } from '../lib/geo'

export type PanelId = 'shop' | 'work' | 'assets' | 'top' | 'profile' | 'health' | null

const SAVE_KEY = 'reality-save-v1'

/** Post to the live world, silently tolerating offline/dev environments */
async function tryPost(path: string, body: unknown): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return (await res.json()) as Record<string, unknown>
  } catch {
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
  /** Item awaiting a map click for placement */
  placing: ShopItem | null
  panel: PanelId
  log: string[]
  cloudSyncedAt: number | null
  /** First-person Street Mode (not persisted) */
  streetMode: boolean

  setStreetMode: (on: boolean) => void
  createCitizen: (name: string, spawn?: SpawnLocation | null) => void
  ensureSpawn: () => Promise<void>
  generateAvatar: (params: AvatarParams) => Promise<string | null>
  registerOnline: () => Promise<void>
  reportScore: () => Promise<void>
  linkGoogle: (credential: string) => Promise<string | null>
  pushCloudSave: () => Promise<void>
  tick: () => void
  consume: (itemId: string) => void
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
  placing: null as ShopItem | null,
  panel: null as PanelId,
  log: [] as string[],
  cloudSyncedAt: null as number | null,
  streetMode: false,
}

const note = (log: string[], msg: string) => [msg, ...log].slice(0, 30)

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
        const d = await tryPost('/api/register', { name: s.citizen.name })
        const cur = get()
        if (!cur.citizen || cur.citizen.token) return

        if (!d?.ok) {
          set({ citizen: { ...cur.citizen, online: false } })
          return
        }

        const founderNumber = (d.founderNumber as number | null) ?? 0
        const isFounder = founderNumber > 0
        set({
          citizen: {
            ...cur.citizen,
            citizenId: d.citizenId as string,
            token: d.token as string,
            founderNumber,
            online: true,
          },
          money: isFounder ? cur.money : Math.min(cur.money, CITIZEN_BALANCE),
          log: note(
            cur.log,
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
          },
          from,
          now,
        )

        let log = s.log
        let { level, xp } = s
        if (out.xpGained > 0) {
          const prog = applyXp(level, xp, out.xpGained)
          level = prog.level
          xp = prog.xp
        }
        if (out.shiftsCompleted > 0 && !wasAway) {
          log = note(log, `Shift complete: +${formatMoney(out.wagesEarned)}.`)
        }
        if (wasAway && (out.summary.length > 0 || out.assets.some((a) => a.pendingIncome > 1))) {
          const income = out.assets.reduce((sum, a) => sum + a.pendingIncome, 0) - s.assets.reduce((sum, a) => sum + a.pendingIncome, 0)
          const parts = [...out.summary]
          if (income >= 1) parts.push(`businesses earned ${formatMoney(Math.floor(income))}`)
          if (parts.length > 0) log = note(log, `While you were away, your citizen ${parts.join(', ')}.`)
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
          log,
        })
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
        const now = Date.now()
        set({
          activity: { kind: 'shift', startedAt: now, endsAt: now + SHIFT_HOURS * 3_600_000, wage: job.wage, title: job.title },
          log: note(s.log, `Clocked in as ${job.title}. ${SHIFT_HOURS}-hour shift — pay lands when it ends.`),
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

        set({
          money: s.money - item.price,
          inventory: { ...s.inventory, [itemId]: (s.inventory[itemId] ?? 0) + 1 },
          log: note(s.log, `Bought ${item.name}.`),
        })
      },

      placeAt: (lat, lng) => {
        const s = get()
        const item = s.placing
        if (!item) return
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
        set({
          money: s.money + Math.floor(total),
          assets: s.assets.map((a) => ({ ...a, pendingIncome: 0 })),
          totalCollected: s.totalCollected + Math.floor(total),
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
        void get().pushCloudSave()
        return null
      },

      toggleTutorial: () => set({ tutorialHidden: !get().tutorialHidden }),
      setStreetMode: (on) => set({ streetMode: on, panel: null }),
      setPanel: (panel) => set({ panel }),
      reset: () => set({ citizen: null, ...FRESH }),
    }),
    {
      name: SAVE_KEY,
      version: 2,
      // v2 adds hydration — give citizens from older saves a healthy default
      migrate: (persisted) => {
        const state = persisted as GameState
        if (state?.needs && state.needs.hydration === undefined) {
          state.needs = { ...state.needs, hydration: 75 }
        }
        return state
      },
      partialize: (state) =>
        Object.fromEntries(Object.entries(state).filter(([key]) => key !== 'streetMode')) as GameState,
    },
  ),
)
