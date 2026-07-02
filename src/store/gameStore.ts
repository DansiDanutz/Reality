import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Citizen, Needs, PlacedAsset, ShopItem } from '../game/types'
import { advance, applyEffects, clamp, formatMoney, offlineEarnings, rollEvent, xpForLevel } from '../game/engine'
import { CITIZEN_BALANCE, FOUNDER_BALANCE, MINUTES_PER_TICK, itemById, jobById } from '../game/catalog'

export type PanelId = 'shop' | 'work' | 'assets' | null

interface GameState {
  citizen: Citizen | null
  money: number
  needs: Needs
  health: number
  level: number
  xp: number
  jobId: string | null
  shiftsWorked: number
  minutes: number
  lastSeenAt: number
  inventory: Record<string, number>
  assets: PlacedAsset[]
  /** Item awaiting a globe click for placement */
  placing: ShopItem | null
  panel: PanelId
  log: string[]

  createCitizen: (name: string) => void
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
        // Beta: founder slots are simulated locally. The live registry ships
        // with the server milestone (see docs/ROADMAP.md).
        const founderNumber = 1 + Math.floor(Math.random() * 500)
        set({
          citizen: { name: name.trim(), founderNumber, createdAt: Date.now() },
          ...FRESH,
          money: founderNumber > 0 ? FOUNDER_BALANCE : CITIZEN_BALANCE,
          log: [`Welcome to Reality, ${name.trim()}. Founder grant deposited: ${formatMoney(FOUNDER_BALANCE)}.`],
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
          inventory: { ...s.inventory, [itemId]: owned - 1 },
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
        const pay = job.wage * 6
        const xp = s.xp + 20
        const levelUp = xp >= xpForLevel(s.level)
        set({
          minutes: w.minutes,
          health: w.health,
          assets: w.assets,
          needs: applyEffects(w.needs, { energy: -18, hunger: -10, hygiene: -8, fun: -6 }),
          money: s.money + pay,
          xp: levelUp ? xp - xpForLevel(s.level) : xp,
          level: levelUp ? s.level + 1 : s.level,
          shiftsWorked: s.shiftsWorked + 1,
          log: note(
            s.log,
            levelUp
              ? `Shift done: +${formatMoney(pay)}. Promoted to level ${s.level + 1}!`
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
        } else {
          set({
            money: s.money - item.price,
            inventory: { ...s.inventory, [itemId]: (s.inventory[itemId] ?? 0) + 1 },
            log: note(s.log, `Bought ${item.name}.`),
          })
        }
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
          log: note(s.log, `Collected ${formatMoney(Math.floor(total))} from your businesses.`),
        })
      },

      setPanel: (panel) => set({ panel }),
      reset: () => set({ citizen: null, ...FRESH }),
    }),
    { name: 'reality-save-v1' },
  ),
)
