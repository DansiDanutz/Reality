import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Citizen, Needs, PlacedAsset, ShopItem } from '../game/types'
import { advance, applyEffects, applyXp, clamp, formatMoney, netWorthOf, offlineEarnings, rollEvent, wageBonusFrom } from '../game/engine'
import { CITIZEN_BALANCE, FOUNDER_BALANCE, MINUTES_PER_TICK, itemById, jobById } from '../game/catalog'

export type PanelId = 'shop' | 'work' | 'assets' | 'top' | null

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
  minutes: number
  lastSeenAt: number
  inventory: Record<string, number>
  assets: PlacedAsset[]
  /** Item awaiting a globe click for placement */
  placing: ShopItem | null
  panel: PanelId
  log: string[]

  createCitizen: (name: string) => void
  registerOnline: () => Promise<void>
  reportScore: () => Promise<void>
  tick: () => void
  applyOfflineEarnings: () => void
  consume: (itemId: string) => void
  sleep: () => void
  takeJob: (jobId: string) => void
  workShift: () => void
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
  needs: { hunger: 85, energy: 90, hygiene: 90, fun: 70 } as Needs,
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
  minutes: 8 * 60, // day 1, 08:00
  lastSeenAt: 0,
  inventory: {} as Record<string, number>,
  assets: [] as PlacedAsset[],
  placing: null as ShopItem | null,
  panel: null as PanelId,
  log: [] as string[],
}

const note = (log: string[], msg: string) => [msg, ...log].slice(0, 30)

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      citizen: null,
      ...FRESH,

      createCitizen: (name) => {
        set({
          citizen: { name: name.trim(), founderNumber: 0, createdAt: Date.now() },
          ...FRESH,
          money: FOUNDER_BALANCE,
          log: [`Welcome to Reality, ${name.trim()}. Claiming your founder slot…`],
        })
        void get().registerOnline()
      },

      registerOnline: async () => {
        const s = get()
        if (!s.citizen || s.citizen.token) return
        const d = await tryPost('/api/register', { name: s.citizen.name })
        const cur = get()
        if (!cur.citizen || cur.citizen.token) return

        if (!d?.ok) {
          // Offline or dev environment — play locally, retry on next load
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
          // Slots full → regular citizen grant (only downgrade an untouched balance)
          money: isFounder ? cur.money : Math.min(cur.money, CITIZEN_BALANCE),
          log: note(
            cur.log,
            isFounder
              ? `Founder #${String(founderNumber).padStart(4, '0')} — yours forever. ${formatMoney(FOUNDER_BALANCE)} deposited.`
              : `All 2,000 founder slots are claimed. Citizen grant: ${formatMoney(CITIZEN_BALANCE)}.`,
          ),
        })

        // Sync any assets placed before registration (migrating saves)
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

      tick: () => {
        const s = get()
        if (!s.citizen) return
        const w = advance({ minutes: s.minutes, needs: s.needs, health: s.health, assets: s.assets }, MINUTES_PER_TICK)

        const event = rollEvent(s.assets.some((a) => a.kind === 'business'))
        if (event) {
          set({
            minutes: w.minutes,
            health: w.health,
            assets: w.assets,
            needs: event.effects ? applyEffects(w.needs, event.effects) : w.needs,
            money: Math.max(0, s.money + (event.money ?? 0)),
            lastSeenAt: Date.now(),
            log: note(s.log, event.text),
          })
        } else {
          set({ minutes: w.minutes, needs: w.needs, health: w.health, assets: w.assets, lastSeenAt: Date.now() })
        }
      },

      applyOfflineEarnings: () => {
        const s = get()
        if (!s.citizen || !s.lastSeenAt) return
        const { assets, total } = offlineEarnings(s.assets, Date.now() - s.lastSeenAt)
        if (total < 1) return
        set({
          assets,
          log: note(s.log, `While you were away, your businesses earned ${formatMoney(Math.floor(total))}. Collect it in Assets.`),
        })
      },

      consume: (itemId) => {
        const s = get()
        const item = itemById(itemId)
        if (!item || !item.effects) return
        const owned = s.inventory[itemId] ?? 0
        if (owned <= 0) return
        const w = advance({ minutes: s.minutes, needs: s.needs, health: s.health, assets: s.assets }, (item.hours ?? 0) * 60)
        set({
          minutes: w.minutes,
          health: w.health,
          assets: w.assets,
          needs: applyEffects(w.needs, item.effects),
          // Durables are reusable — consumables burn one from the inventory
          inventory: item.durable ? s.inventory : { ...s.inventory, [itemId]: owned - 1 },
          timesEaten: (item.effects.hunger ?? 0) > 0 ? s.timesEaten + 1 : s.timesEaten,
          log: note(s.log, `${item.name} — done.`),
        })
      },

      sleep: () => {
        const s = get()
        const hasHome = s.assets.some((a) => a.kind === 'home')
        const w = advance({ minutes: s.minutes, needs: s.needs, health: s.health, assets: s.assets }, 7 * 60)
        set({
          minutes: w.minutes,
          health: w.health,
          assets: w.assets,
          needs: { ...w.needs, energy: hasHome ? 100 : 80, hygiene: hasHome ? clamp(w.needs.hygiene + 30) : w.needs.hygiene },
          timesSlept: s.timesSlept + 1,
          log: note(s.log, hasHome ? 'Slept at home. Fully recharged.' : 'Slept rough. A home would help.'),
        })
      },

      takeJob: (jobId) => {
        const s = get()
        const job = jobById(jobId)
        if (!job) return
        if (s.level < job.requiredLevel) return
        set({ jobId, log: note(s.log, `Hired: ${job.title} at ${formatMoney(job.wage)}/h.`) })
      },

      workShift: () => {
        const s = get()
        const job = s.jobId ? jobById(s.jobId) : undefined
        if (!job) return
        if (s.needs.energy < 25 || s.needs.hunger < 15 || s.health < 20) {
          set({ log: note(s.log, 'Too worn down to work. Eat and sleep first.') })
          return
        }
        const w = advance({ minutes: s.minutes, needs: s.needs, health: s.health, assets: s.assets }, 6 * 60)
        const bonus = wageBonusFrom(s.inventory)
        const pay = Math.round(job.wage * 6 * (1 + bonus))
        const prog = applyXp(s.level, s.xp, 20)
        set({
          minutes: w.minutes,
          health: w.health,
          assets: w.assets,
          needs: applyEffects(w.needs, { energy: -18, hunger: -10, hygiene: -8, fun: -6 }),
          money: s.money + pay,
          xp: prog.xp,
          level: prog.level,
          shiftsWorked: s.shiftsWorked + 1,
          log: note(
            s.log,
            prog.levelsGained > 0
              ? `Shift done: +${formatMoney(pay)}. Promoted to level ${prog.level}!`
              : bonus > 0
                ? `Shift done: +${formatMoney(pay)} (gear bonus +${Math.round(bonus * 100)}%).`
                : `Shift done: +${formatMoney(pay)}.`,
          ),
        })
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

        // Durables are owned once
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
          placedAtMinute: s.minutes,
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
        // Refund — nothing was placed.
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

      toggleTutorial: () => set({ tutorialHidden: !get().tutorialHidden }),

      setPanel: (panel) => set({ panel }),
      reset: () => set({ citizen: null, ...FRESH }),
    }),
    { name: 'reality-save-v1' },
  ),
)
