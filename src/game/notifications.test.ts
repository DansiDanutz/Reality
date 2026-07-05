import { describe, expect, test } from 'vitest'
import {
  decideNotifications,
  markNotified,
  NOTIFICATION_REASONS,
  type NotificationLog,
  type NotificationSnapshot,
} from './notifications'

const DAY_MS = 86_400_000

const base = (over: Partial<NotificationSnapshot> = {}): NotificationSnapshot => ({
  now: 19_000 * DAY_MS + 20 * 60_000, // 20:00 local on day 19000
  todayDay: 19_000,
  streakLastClaimDay: 19_000,
  streakLength: 5,
  activity: null,
  needs: { hunger: 80, hydration: 80, energy: 80, hygiene: 80, fun: 80 },
  money: 1000,
  dailyDone: 0,
  dailyTotal: 3,
  dailyBonusClaimed: false,
  ...over,
})

const ok = (s: NotificationSnapshot, log: NotificationLog = {}) =>
  decideNotifications(s, log)

describe('decideNotifications — activity completion', () => {
  test('fires when an activity has ended', () => {
    const ended = 19_000 * DAY_MS + 60 * 60_000
    const s = base({
      now: ended + 1000,
      activity: { kind: 'shift', startedAt: ended - 30 * 60_000, endsAt: ended, wage: 100, title: 'Cafe' },
    })
    const out = ok(s)
    expect(out).toHaveLength(1)
    expect(out[0].tag).toBe('activity')
    expect(out[0].title).toContain('Shift done')
  })

  test('does not fire while the activity is still running', () => {
    const ends = 19_000 * DAY_MS + 60 * 60_000
    const s = base({
      now: ends - 60_000, // 1 min before end
      activity: { kind: 'shift', startedAt: ends - 30 * 60_000, endsAt: ends, wage: 100, title: 'Cafe' },
    })
    expect(ok(s)).toHaveLength(0)
  })

  test('does not fire when no activity is set', () => {
    expect(ok(base({ activity: null }))).toHaveLength(0)
  })

  test('sleep and cook get their own verbs', () => {
    const ended = 19_000 * DAY_MS
    const sleep = base({
      now: ended + 1000,
      activity: { kind: 'sleep', startedAt: ended - 8 * 3_600_000, endsAt: ended, wage: 0, title: 'Sleep' },
    })
    expect(ok(sleep)[0].title).toContain('rested')
    const cook = base({
      now: ended + 1000,
      activity: { kind: 'cook', startedAt: ended - 30 * 60_000, endsAt: ended, wage: 0, title: 'Dinner' },
    })
    expect(ok(cook)[0].title).toContain('meal is ready')
  })
})

describe('decideNotifications — streak at risk', () => {
  test('fires in the final 3 hours before midnight if unclaimed', () => {
    // 22:00 local (2h to midnight), streak not yet claimed today
    const s = base({
      now: 19_000 * DAY_MS + 22 * 3_600_000,
      todayDay: 19_000,
      streakLastClaimDay: 18_999, // claimed yesterday, not today
      streakLength: 7,
    })
    const out = ok(s)
    expect(out).toHaveLength(1)
    expect(out[0].tag).toBe('streak')
    expect(out[0].title).toMatch(/2h to midnight/)
  })

  test('does not fire if already claimed today', () => {
    const s = base({
      now: 19_000 * DAY_MS + 22 * 3_600_000,
      todayDay: 19_000,
      streakLastClaimDay: 19_000, // claimed today
      streakLength: 7,
    })
    expect(ok(s)).toHaveLength(0)
  })

  test('does not fire more than 3h before midnight', () => {
    // 18:00 local (6h to midnight) — too early
    const s = base({
      now: 19_000 * DAY_MS + 18 * 3_600_000,
      streakLastClaimDay: 18_999,
      streakLength: 7,
    })
    expect(ok(s)).toHaveLength(0)
  })

  test('does not fire for a streak < 2 (not worth protecting yet)', () => {
    const s = base({
      now: 19_000 * DAY_MS + 22 * 3_600_000,
      streakLastClaimDay: 18_999,
      streakLength: 1,
    })
    expect(ok(s)).toHaveLength(0)
  })

  test('respects the 3-hour cooldown', () => {
    const s = base({
      now: 19_000 * DAY_MS + 22 * 3_600_000,
      streakLastClaimDay: 18_999,
      streakLength: 7,
    })
    // Fired 1 hour ago → still in cooldown
    const log: NotificationLog = { 'streak-at-risk': s.now - 60 * 60_000 }
    expect(ok(s, log)).toHaveLength(0)
  })
})

describe('decideNotifications — needs critical', () => {
  test('fires when hunger is critical', () => {
    const s = base({ needs: { hunger: 10, hydration: 80, energy: 80, hygiene: 80, fun: 80 } })
    const out = ok(s)
    expect(out).toHaveLength(1)
    expect(out[0].tag).toBe('needs')
    expect(out[0].title).toContain('starving')
  })

  test('does not fire when needs are healthy', () => {
    expect(ok(base())).toHaveLength(0)
  })

  test('does not fire when broke (player can\'t act on it)', () => {
    const s = base({
      money: 0,
      needs: { hunger: 5, hydration: 5, energy: 80, hygiene: 80, fun: 80 },
    })
    expect(ok(s)).toHaveLength(0)
  })

  test('respects the 30-minute cooldown', () => {
    const s = base({ needs: { hunger: 10, hydration: 80, energy: 80, hygiene: 80, fun: 80 } })
    const log: NotificationLog = { 'needs-critical': s.now - 10 * 60_000 }
    expect(ok(s, log)).toHaveLength(0)
  })
})

describe('decideNotifications — daily challenges incomplete', () => {
  test('fires in the evening if some-but-not-all challenges are done', () => {
    // 22:00 local, 1/3 done, bonus not claimed
    const s = base({
      now: 19_000 * DAY_MS + 22 * 3_600_000,
      dailyDone: 1,
      dailyTotal: 3,
      dailyBonusClaimed: false,
    })
    const out = ok(s)
    expect(out).toHaveLength(1)
    expect(out[0].title).toMatch(/1\/3 daily challenges/)
  })

  test('does not fire if all challenges are done (bonus claimed)', () => {
    const s = base({
      now: 19_000 * DAY_MS + 22 * 3_600_000,
      dailyDone: 3,
      dailyTotal: 3,
      dailyBonusClaimed: true,
    })
    expect(ok(s)).toHaveLength(0)
  })

  test('does not fire if no challenges are done (targets engaged players)', () => {
    const s = base({
      now: 19_000 * DAY_MS + 22 * 3_600_000,
      dailyDone: 0,
      dailyTotal: 3,
    })
    expect(ok(s)).toHaveLength(0)
  })

  test('does not fire more than 3h before midnight', () => {
    const s = base({
      now: 19_000 * DAY_MS + 18 * 3_600_000, // 18:00, 6h to midnight
      dailyDone: 1,
      dailyTotal: 3,
    })
    expect(ok(s)).toHaveLength(0)
  })

  test('respects the 6-hour cooldown', () => {
    const s = base({
      now: 19_000 * DAY_MS + 22 * 3_600_000,
      dailyDone: 1,
      dailyTotal: 3,
    })
    const log: NotificationLog = { 'daily-incomplete': s.now - 60 * 60_000 }
    expect(ok(s, log)).toHaveLength(0)
  })
})

describe('decideNotifications — no stacking', () => {
  test('when multiple would fire, returns only the highest-priority (activity)', () => {
    const ended = 19_000 * DAY_MS + 22 * 3_600_000
    const s = base({
      now: ended + 1000,
      activity: { kind: 'shift', startedAt: ended - 30 * 60_000, endsAt: ended, wage: 100, title: 'Cafe' },
      streakLastClaimDay: 18_999,
      streakLength: 7,
      needs: { hunger: 10, hydration: 80, energy: 80, hygiene: 80, fun: 80 },
    })
    const out = ok(s)
    expect(out).toHaveLength(1)
    expect(out[0].tag).toBe('activity') // beats streak and needs
  })

  test('streak beats needs when both fire and no activity', () => {
    const s = base({
      now: 19_000 * DAY_MS + 22 * 3_600_000,
      streakLastClaimDay: 18_999,
      streakLength: 7,
      needs: { hunger: 10, hydration: 80, energy: 80, hygiene: 80, fun: 80 },
    })
    const out = ok(s)
    expect(out).toHaveLength(1)
    expect(out[0].tag).toBe('streak')
  })
})

describe('markNotified + NOTIFICATION_REASONS', () => {
  test('markNotified returns a new log with the id+time set', () => {
    const log: NotificationLog = { foo: 100 }
    const next = markNotified(log, 'bar', 200)
    expect(next.bar).toBe(200)
    expect(next.foo).toBe(100) // preserved
    expect(log.bar).toBeUndefined() // immutable — original untouched
  })

  test('NOTIFICATION_REASONS is non-empty and human-readable', () => {
    expect(NOTIFICATION_REASONS.length).toBeGreaterThan(0)
    for (const r of NOTIFICATION_REASONS) {
      expect(typeof r).toBe('string')
      expect(r.length).toBeGreaterThan(10)
    }
  })
})
