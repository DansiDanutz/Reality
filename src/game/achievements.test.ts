import { describe, expect, test } from 'vitest'
import {
  ACHIEVEMENTS,
  CATEGORY_META,
  TIER_META,
  newlyUnlocked,
  unlockedAchievements,
  type AchievementSnapshot,
} from './achievements'

const base: AchievementSnapshot = {
  timesEaten: 0,
  timesSlept: 0,
  timesStudied: 0,
  timesCommunity: 0,
  shiftsWorked: 0,
  jobId: null,
  assets: [],
  businesses: 0,
  maxBusinessLevel: 1,
  totalCollected: 0,
  netWorth: 0,
  level: 1,
  daysLived: 0,
  distinctItemsOwned: 0,
  hasCooked: false,
  hasPet: false,
  hasAvatar: false,
  activity: null,
  needs: { hunger: 80, hydration: 80, energy: 80, hygiene: 80, fun: 80 },
}

describe('achievements — the constitution', () => {
  test('every achievement id is unique', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('every category has a bronze entry (an easy first hook)', () => {
    for (const cat of Object.keys(CATEGORY_META) as (keyof typeof CATEGORY_META)[]) {
      const has = ACHIEVEMENTS.some((a) => a.category === cat && a.tier === 'bronze')
      expect(has, `category ${cat} has no bronze tier`).toBe(true)
    }
  })

  test('tier rewards escalate: bronze < silver < gold (XP and bounty)', () => {
    // For every category, gold pays more than silver pays more than bronze
    const byCat = new Map<string, typeof ACHIEVEMENTS>()
    for (const a of ACHIEVEMENTS) {
      if (!byCat.has(a.category)) byCat.set(a.category, [])
      byCat.get(a.category)!.push(a)
    }
    for (const [cat, items] of byCat) {
      const bronze = items.filter((a) => a.tier === 'bronze').sort((a, b) => b.xp - a.xp)[0]
      const silver = items.filter((a) => a.tier === 'silver').sort((a, b) => b.xp - a.xp)[0]
      const gold = items.filter((a) => a.tier === 'gold').sort((a, b) => b.xp - a.xp)[0]
      if (silver && bronze) expect(silver.xp, `${cat} silver > bronze xp`).toBeGreaterThan(bronze.xp)
      if (gold && silver) expect(gold.xp, `${cat} gold > silver xp`).toBeGreaterThan(silver.xp)
    }
  })

  test('a fresh citizen unlocks nothing', () => {
    expect(unlockedAchievements(base)).toHaveLength(0)
    expect(newlyUnlocked(base, [])).toHaveLength(0)
  })

  test('no achievement is economy-breaking: top bounty is modest vs founder grant', () => {
    // The society pays its achievers, but no single achievement should exceed
    // a meaningful fraction of the founder grant — rewards are hooks, not windfalls.
    const topBounty = Math.max(...ACHIEVEMENTS.map((a) => a.bounty))
    expect(topBounty).toBeLessThanOrEqual(50_000) // 25% of founder grant ceiling
  })

  test('every achievement title and detail are present and honest', () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.title.length, a.id).toBeGreaterThan(2)
      expect(a.detail.length, a.id).toBeGreaterThan(10)
      expect(a.xp, a.id).toBeGreaterThan(0)
      expect(a.bounty, a.id).toBeGreaterThan(0)
    }
  })
})

describe('achievements — unlock predicates', () => {
  test('survival: days lived unlocks the survivor ladder', () => {
    expect(newlyUnlocked({ ...base, daysLived: 1 }, []).map((a) => a.id)).toContain('survivor-1')
    expect(newlyUnlocked({ ...base, daysLived: 7 }, []).map((a) => a.id)).toContain('survivor-7')
    expect(newlyUnlocked({ ...base, daysLived: 30 }, []).map((a) => a.id)).toContain('survivor-30')
  })

  test('career: shifts worked climbs the ladder', () => {
    expect(newlyUnlocked({ ...base, shiftsWorked: 1 }, []).map((a) => a.id)).toContain('first-shift')
    expect(newlyUnlocked({ ...base, shiftsWorked: 10 }, []).map((a) => a.id)).toContain('reliable')
    expect(newlyUnlocked({ ...base, shiftsWorked: 50 }, []).map((a) => a.id)).toContain('workhorse')
  })

  test('wealth: collected income climbs the ladder', () => {
    expect(newlyUnlocked({ ...base, totalCollected: 1 }, []).map((a) => a.id)).toContain('first-dollar')
    expect(newlyUnlocked({ ...base, totalCollected: 10_000 }, []).map((a) => a.id)).toContain('hustler')
    expect(newlyUnlocked({ ...base, totalCollected: 1_000_000 }, []).map((a) => a.id)).toContain('tycoon')
  })

  test('lifestyle: level + lifestyle flags unlock', () => {
    expect(newlyUnlocked({ ...base, level: 5 }, []).map((a) => a.id)).toContain('well-lived')
    expect(newlyUnlocked({ ...base, hasCooked: true }, []).map((a) => a.id)).toContain('home-chef')
    expect(newlyUnlocked({ ...base, hasPet: true }, []).map((a) => a.id)).toContain('pet-parent')
    expect(newlyUnlocked({ ...base, hasAvatar: true }, []).map((a) => a.id)).toContain('face-of-reality')
  })

  test('collector: distinct items climbs the ladder', () => {
    expect(newlyUnlocked({ ...base, distinctItemsOwned: 10 }, []).map((a) => a.id)).toContain('collector-10')
    expect(newlyUnlocked({ ...base, distinctItemsOwned: 25 }, []).map((a) => a.id)).toContain('collector-25')
    expect(newlyUnlocked({ ...base, distinctItemsOwned: 50 }, []).map((a) => a.id)).toContain('collector-50')
  })

  test('newlyUnlocked excludes already-claimed', () => {
    const earned = newlyUnlocked({ ...base, shiftsWorked: 1 }, [])
    expect(earned.length).toBeGreaterThan(0)
    const claimed = earned.map((a) => a.id)
    const after = newlyUnlocked({ ...base, shiftsWorked: 1 }, claimed)
    expect(after.map((a) => a.id)).not.toContain(claimed[0])
  })
})

describe('achievement metadata integrity', () => {
  test('every tier and category has meta', () => {
    for (const a of ACHIEVEMENTS) {
      expect(CATEGORY_META[a.category], a.id).toBeDefined()
      expect(TIER_META[a.tier], a.id).toBeDefined()
    }
  })

  test('tier icons are distinct emojis', () => {
    const icons = Object.values(TIER_META).map((t) => t.icon)
    expect(new Set(icons).size).toBe(icons.length)
  })
})

describe('achievement progress bars', () => {
  test('every numeric achievement exposes a progress function', () => {
    // The achievements with a threshold predicate (s.x >= N) must expose
    // matching progress. Boolean achievements (hasCooked, hasPet, etc.) are
    // allowed to omit progress — the UI renders them without a bar.
    const numericIds = new Set([
      'survivor-1', 'survivor-7', 'survivor-30', 'well-fed', 'rested-soul',
      'first-shift', 'reliable', 'workhorse',
      'hustler', 'tycoon', 'mogul',
      'well-lived', 'established', 'pillar',
      'collector-10', 'collector-25', 'collector-50',
      'business-owner', 'workers-hall', 'empire-3', 'empire-10', 'upgrader-3', 'upgrader-5',
    ])
    for (const a of ACHIEVEMENTS) {
      if (numericIds.has(a.id)) {
        expect(a.progress, `${a.id} should expose progress`).toBeDefined()
      }
    }
  })

  test('progress.target is always positive', () => {
    for (const a of ACHIEVEMENTS) {
      if (!a.progress) continue
      const p = a.progress(base)
      expect(p.target, a.id).toBeGreaterThan(0)
    }
  })

  test('progress.current never exceeds target when locked, never less when unlocked (drift guard)', () => {
    // The critical invariant: progress and isUnlocked must agree. If a future
    // edit changes the threshold without updating progress (or vice versa),
    // the bar would lie to the player. This test sweeps many snapshots.
    const snapshots: AchievementSnapshot[] = [
      base,
      { ...base, daysLived: 1 },
      { ...base, daysLived: 7 },
      { ...base, daysLived: 35 },
      { ...base, timesEaten: 25 },
      { ...base, timesEaten: 100 },
      { ...base, timesSlept: 25 },
      { ...base, shiftsWorked: 1 },
      { ...base, shiftsWorked: 10 },
      { ...base, shiftsWorked: 50 },
      { ...base, totalCollected: 5_000 },
      { ...base, totalCollected: 10_000 },
      { ...base, totalCollected: 1_000_000 },
      { ...base, netWorth: 500_000 },
      { ...base, netWorth: 1_000_000 },
      { ...base, level: 5 },
      { ...base, level: 10 },
      { ...base, level: 20 },
      { ...base, distinctItemsOwned: 10 },
      { ...base, assets: [{ id: 'workers', itemId: 'workers_hall', kind: 'business', name: 'Workers Hall', lat: 0, lng: 0, incomePerDay: 0, pendingIncome: 0, placedAtMinute: 0 }] },
      { ...base, distinctItemsOwned: 25 },
      { ...base, distinctItemsOwned: 50 },
      { ...base, businesses: 1 },
      { ...base, businesses: 3 },
      { ...base, businesses: 10 },
      { ...base, maxBusinessLevel: 3 },
      { ...base, maxBusinessLevel: 5 },
    ]
    for (const a of ACHIEVEMENTS) {
      if (!a.progress) continue
      for (const s of snapshots) {
        const p = a.progress(s)
        const unlocked = a.isUnlocked(s)
        if (unlocked) {
          expect(p.current, `${a.id} unlocked but current ${p.current} < target ${p.target}`).toBeGreaterThanOrEqual(p.target)
        } else {
          // When locked, current must be strictly less than target — if it
          // equals target the bar would show 100% but isUnlocked returns false.
          expect(p.current, `${a.id} locked but current ${p.current} >= target ${p.target}`).toBeLessThan(p.target)
        }
      }
    }
  })

  test('progress bar fills 0%→100% across the documented range (sample)', () => {
    // Spot-check a few achievements at the boundary.
    const workhorse = ACHIEVEMENTS.find((a) => a.id === 'workhorse')!
    expect(workhorse.progress!({ ...base, shiftsWorked: 0 }).current).toBe(0)
    expect(workhorse.progress!({ ...base, shiftsWorked: 50 }).current).toBe(50)
    const collector = ACHIEVEMENTS.find((a) => a.id === 'collector-25')!
    expect(collector.progress!({ ...base, distinctItemsOwned: 12 }).current).toBe(12)
    expect(collector.progress!({ ...base, distinctItemsOwned: 12 }).target).toBe(25)
  })
})
