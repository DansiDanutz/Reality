import {
  cashflowOf,
  netWorthOf,
  reachOf,
  wageBonusFrom,
  type Cashflow,
  type Reach,
} from './engine'
import { educationWageBonusFrom, type EducationProgress } from './education'
import type { Needs, PlacedAsset } from './types'

export type MillionaireStage =
  | 'survival'
  | 'stable'
  | 'skilled'
  | 'reliable'
  | 'owner'
  | 'employer'
  | 'millionaire'

export const MILLIONAIRE_STAGE_ORDER: MillionaireStage[] = [
  'survival',
  'stable',
  'skilled',
  'reliable',
  'owner',
  'employer',
  'millionaire',
]

export const MILLIONAIRE_STAGE_META: Record<MillionaireStage, { label: string; shortLabel: string }> = {
  survival: { label: 'Survival', shortLabel: 'Survive' },
  stable: { label: 'Stable cash', shortLabel: 'Stable' },
  skilled: { label: 'Skilled work', shortLabel: 'Skill' },
  reliable: { label: 'Reliable respect', shortLabel: 'Respect' },
  owner: { label: 'Owner', shortLabel: 'Owner' },
  employer: { label: 'Employer', shortLabel: 'Employ' },
  millionaire: { label: 'Millionaire', shortLabel: '$1M' },
}

export interface MillionaireStageProgress {
  current: number
  total: number
  percent: number
  label: string
  nextLabel: string | null
}

export type MillionaireNextAction =
  | 'recover-body'
  | 'find-job'
  | 'work-shift'
  | 'study'
  | 'build-home'
  | 'buy-business'
  | 'upgrade-business'
  | 'reinvest'
  | 'millionaire'

export interface MillionairePathInput {
  money: number
  inventory: Record<string, number>
  assets: PlacedAsset[]
  needs: Needs
  health: number
  level: number
  jobWage: number
  shiftsWorked: number
  educationActions: number
  educationProgress?: EducationProgress[]
  communityRespect: number
  communityFriendship: number
  communityTrust: number
}

export type MillionaireCommunityTier = 'alone' | 'known' | 'trusted' | 'backed'

export interface MillionaireCommunityAdvantage {
  score: number
  tier: MillionaireCommunityTier
  label: string
  dailyOpportunityValue: number
  weeklyHelperMinutes: number
  detail: string | null
}

export interface MillionairePath {
  stage: MillionaireStage
  netWorth: number
  millionaireGap: number
  cashflow: Cashflow
  communityAdvantage: MillionaireCommunityAdvantage
  daysToMillionaire: number | null
  reach: Reach
  nextAction: MillionaireNextAction
  nextActionDetail: string
}

const MILLIONAIRE_NET_WORTH = 1_000_000
const BODY_FLOOR = 35
const CASH_FLOOR = 100

export function millionaireStageProgress(stage: MillionaireStage): MillionaireStageProgress {
  const index = Math.max(0, MILLIONAIRE_STAGE_ORDER.indexOf(stage))
  const current = index + 1
  const total = MILLIONAIRE_STAGE_ORDER.length
  const next = MILLIONAIRE_STAGE_ORDER[index + 1] ?? null
  return {
    current,
    total,
    percent: Math.round((current / total) * 100),
    label: MILLIONAIRE_STAGE_META[stage].label,
    nextLabel: next ? MILLIONAIRE_STAGE_META[next].label : null,
  }
}

function bodyUnsafe(input: Pick<MillionairePathInput, 'needs' | 'health'>): boolean {
  return input.health < 40 ||
    input.needs.hydration <= BODY_FLOOR ||
    input.needs.hunger <= BODY_FLOOR ||
    input.needs.energy <= 30
}

function stageOf(input: MillionairePathInput, netWorth: number, cashflow: Cashflow): MillionaireStage {
  const businesses = input.assets.filter((asset) => asset.kind === 'business').length
  const hasHome = input.assets.some((asset) => asset.kind === 'home')
  if (netWorth >= MILLIONAIRE_NET_WORTH) return 'millionaire'
  if (businesses >= 2 || cashflow.passivePerDay >= cashflow.livingCostPerDay + cashflow.upkeepPerDay) return 'employer'
  if (hasHome || businesses >= 1) return 'owner'
  if (input.shiftsWorked >= 5 || input.communityRespect >= 5 || input.communityFriendship >= 6 || input.communityTrust >= 5) return 'reliable'
  if (input.level >= 2 || input.educationActions > 0) return 'skilled'
  if (input.jobWage > 0 && cashflow.netPerDay > 0 && input.money >= CASH_FLOOR) return 'stable'
  return 'survival'
}

export function communityAdvantageOf(input: Pick<MillionairePathInput, 'communityRespect' | 'communityFriendship' | 'communityTrust' | 'shiftsWorked'>): MillionaireCommunityAdvantage {
  const respect = Math.max(0, Math.floor(input.communityRespect))
  const friendship = Math.max(0, Math.floor(input.communityFriendship))
  const trust = Math.max(0, Math.floor(input.communityTrust))
  const reliability = Math.min(20, Math.max(0, Math.floor(input.shiftsWorked)))
  const score = respect * 2 + friendship + trust * 2 + reliability

  if (score >= 45) {
    return {
      score,
      tier: 'backed',
      label: 'Community backed',
      dailyOpportunityValue: 45,
      weeklyHelperMinutes: 180,
      detail: 'Community backing adds about $45/day of practical advantage through referrals, borrowed tools, and trusted help.',
    }
  }
  if (score >= 22) {
    return {
      score,
      tier: 'trusted',
      label: 'Trusted local',
      dailyOpportunityValue: 22,
      weeklyHelperMinutes: 90,
      detail: 'Local trust adds about $22/day of practical advantage through better referrals and shared help.',
    }
  }
  if (score >= 6) {
    return {
      score,
      tier: 'known',
      label: 'Known neighbor',
      dailyOpportunityValue: 8,
      weeklyHelperMinutes: 30,
      detail: 'Being known locally adds about $8/day of practical advantage through small favors and tips.',
    }
  }
  return {
    score,
    tier: 'alone',
    label: 'No backing yet',
    dailyOpportunityValue: 0,
    weeklyHelperMinutes: 0,
    detail: null,
  }
}

function withCommunityAdvantage(detail: string, advantage: MillionaireCommunityAdvantage): string {
  return advantage.detail ? `${detail} ${advantage.detail}` : detail
}

function nextActionOf(input: MillionairePathInput, stage: MillionaireStage, cashflow: Cashflow, communityAdvantage: MillionaireCommunityAdvantage): {
  nextAction: MillionaireNextAction
  nextActionDetail: string
} {
  const businesses = input.assets.filter((asset) => asset.kind === 'business').length
  const hasHome = input.assets.some((asset) => asset.kind === 'home')
  if (bodyUnsafe(input)) {
    return {
      nextAction: 'recover-body',
      nextActionDetail: 'Eat, drink, and sleep before chasing income.',
    }
  }
  if (stage === 'millionaire') {
    return {
      nextAction: 'millionaire',
      nextActionDetail: 'You crossed $1M net worth. Keep reinvesting and expanding reach.',
    }
  }
  if (input.jobWage <= 0) {
    return {
      nextAction: 'find-job',
      nextActionDetail: 'A job funds food, water, permits, and the first build.',
    }
  }
  if (cashflow.netPerDay <= 0 || input.money < CASH_FLOOR) {
    return {
      nextAction: 'work-shift',
      nextActionDetail: 'Work until daily cashflow and the cash floor are safe.',
    }
  }
  if (input.educationActions <= 0 && input.level < 2) {
    return {
      nextAction: 'study',
      nextActionDetail: 'Study one useful skill so better jobs and business choices open.',
    }
  }
  if (!hasHome) {
    return {
      nextAction: 'build-home',
      nextActionDetail: withCommunityAdvantage('Build a home to lower living cost and stabilize daily life.', communityAdvantage),
    }
  }
  if (businesses <= 0) {
    return {
      nextAction: 'buy-business',
      nextActionDetail: withCommunityAdvantage('Turn stable home life into the first earning building.', communityAdvantage),
    }
  }
  if (businesses === 1) {
    return {
      nextAction: 'upgrade-business',
      nextActionDetail: withCommunityAdvantage('Develop the inside of the first business before expanding.', communityAdvantage),
    }
  }
  return {
    nextAction: 'reinvest',
    nextActionDetail: withCommunityAdvantage('Reinvest surplus into better businesses until $1M is normal math.', communityAdvantage),
  }
}

export function millionairePathOf(input: MillionairePathInput): MillionairePath {
  const netWorth = netWorthOf(input.money, input.inventory, input.assets)
  const hasHome = input.assets.some((asset) => asset.kind === 'home')
  const businessCount = input.assets.filter((asset) => asset.kind === 'business').length
  const cashflow = cashflowOf({
    assets: input.assets,
    hasHome,
    wage: input.jobWage,
    shiftsWorked: input.shiftsWorked,
    wageBonus: wageBonusFrom(input.inventory) + educationWageBonusFrom(input.educationProgress ?? []),
  })
  const millionaireGap = Math.max(0, MILLIONAIRE_NET_WORTH - netWorth)
  const stage = stageOf(input, netWorth, cashflow)
  const communityAdvantage = communityAdvantageOf(input)
  const next = nextActionOf(input, stage, cashflow, communityAdvantage)
  const netProgressPerDay = cashflow.netPerDay + communityAdvantage.dailyOpportunityValue

  return {
    stage,
    netWorth,
    millionaireGap,
    cashflow,
    communityAdvantage,
    daysToMillionaire: millionaireGap <= 0
      ? 0
      : netProgressPerDay > 0
        ? Math.ceil(millionaireGap / netProgressPerDay)
        : null,
    reach: reachOf(input.level, businessCount, hasHome, netWorth),
    ...next,
  }
}
