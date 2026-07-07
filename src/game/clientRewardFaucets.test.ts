import { describe, expect, test } from 'vitest'
import {
  CLIENT_REWARD_FAUCET_IDS,
  CLIENT_REWARD_FAUCETS,
  clientRewardGrant,
} from './clientRewardFaucets'

describe('client reward faucets', () => {
  test('enumerates the audited browser-side money faucets', () => {
    expect([...CLIENT_REWARD_FAUCET_IDS]).toEqual([
      'achievement_bounty',
      'daily_challenge',
      'golden_opportunity',
      'lucky_moment',
      'mystery_box',
      'streak',
    ])
  })

  test('keeps every client reward source game-only until server ledger replacement', () => {
    for (const id of CLIENT_REWARD_FAUCET_IDS) {
      expect(CLIENT_REWARD_FAUCETS[id]).toEqual({
        id,
        payoutEligibility: 'game_only',
        serverLedgerRequired: true,
      })
    }
  })

  test('preserves integer cash and XP grants without making them payout eligible', () => {
    expect(clientRewardGrant('daily_challenge', { cash: 250, xp: 50 })).toEqual({
      source: 'daily_challenge',
      cash: 250,
      xp: 50,
      payoutEligibility: 'game_only',
      serverLedgerRequired: true,
    })
  })

  test('defaults missing cash or XP to zero for one-sided rewards', () => {
    expect(clientRewardGrant('streak', { cash: 50 })).toMatchObject({ cash: 50, xp: 0 })
    expect(clientRewardGrant('achievement_bounty', { xp: 75 })).toMatchObject({ cash: 0, xp: 75 })
  })

  test('rejects negative, fractional, or non-finite grants', () => {
    expect(() => clientRewardGrant('lucky_moment', { cash: -1 })).toThrow(/Invalid cash/)
    expect(() => clientRewardGrant('golden_opportunity', { xp: 1.5 })).toThrow(/Invalid xp/)
    expect(() => clientRewardGrant('mystery_box', { cash: Number.POSITIVE_INFINITY })).toThrow(/Invalid cash/)
  })
})
