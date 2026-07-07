/**
 * Client-only reward faucets.
 *
 * These are retention/gameplay rewards applied by the browser store today.
 * They are explicitly game-only credits: when server authority replaces these
 * paths, each source must become a server ledger event before it can ever be
 * settlement or payout eligible.
 */

export const CLIENT_REWARD_FAUCET_IDS = [
  'achievement_bounty',
  'daily_challenge',
  'golden_opportunity',
  'lucky_moment',
  'mystery_box',
  'streak',
] as const

export type ClientRewardFaucetId = (typeof CLIENT_REWARD_FAUCET_IDS)[number]
export type ClientRewardPayoutEligibility = 'game_only'

export interface ClientRewardFaucetPolicy {
  id: ClientRewardFaucetId
  payoutEligibility: ClientRewardPayoutEligibility
  serverLedgerRequired: true
}

export interface ClientRewardGrant {
  source: ClientRewardFaucetId
  cash: number
  xp: number
  payoutEligibility: ClientRewardPayoutEligibility
  serverLedgerRequired: true
}

export const CLIENT_REWARD_FAUCETS: Record<ClientRewardFaucetId, ClientRewardFaucetPolicy> =
  Object.fromEntries(
    CLIENT_REWARD_FAUCET_IDS.map((id) => [
      id,
      { id, payoutEligibility: 'game_only', serverLedgerRequired: true },
    ]),
  ) as Record<ClientRewardFaucetId, ClientRewardFaucetPolicy>

function assertWholeNonNegative(source: ClientRewardFaucetId, field: 'cash' | 'xp', value: number): void {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new Error(`Invalid ${field} grant for client reward faucet ${source}`)
  }
}

export function clientRewardGrant(
  source: ClientRewardFaucetId,
  reward: { cash?: number; xp?: number },
): ClientRewardGrant {
  const cash = reward.cash ?? 0
  const xp = reward.xp ?? 0
  assertWholeNonNegative(source, 'cash', cash)
  assertWholeNonNegative(source, 'xp', xp)
  return {
    source,
    cash,
    xp,
    payoutEligibility: CLIENT_REWARD_FAUCETS[source].payoutEligibility,
    serverLedgerRequired: CLIENT_REWARD_FAUCETS[source].serverLedgerRequired,
  }
}
