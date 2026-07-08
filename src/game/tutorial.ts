import type { Activity } from './engine'
import type { PlacedAsset } from './types'

/** The slice of game state the tutorial reads to judge progress */
export interface TutorialSnapshot {
  timesEaten: number
  timesSlept: number
  timesStudied: number
  timesCommunity: number
  jobId: string | null
  shiftsWorked: number
  activity: Activity | null
  assets: PlacedAsset[]
  totalCollected: number
  /** True once the citizen has generated an avatar (issue #38 onboarding) */
  hasAvatar: boolean
  /** True once the player has opened the Achievements panel — the discovery
   *  nudge that surfaces the retention engine after the core loop is learned. */
  sawAchievementsPanel: boolean
}

export interface TutorialStep {
  id: string
  title: string
  detail: string
  xp: number
  isDone: (s: TutorialSnapshot) => boolean
}

/**
 * First Days in Reality — one pass through every core loop.
 * Order mirrors a real first session: see yourself, survive, earn, own, profit.
 */
export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'avatar',
    title: 'Create your avatar',
    detail: 'Profile → describe yourself, and the studio paints your face.',
    xp: 25,
    isDone: (s) => s.hasAvatar,
  },
  {
    id: 'eat',
    title: 'Eat something',
    detail: 'Open the Market, buy any food, then press Use.',
    xp: 25,
    isDone: (s) => s.timesEaten >= 1,
  },
  {
    id: 'job',
    title: 'Get a job',
    detail: 'Open Work and take any position.',
    xp: 25,
    isDone: (s) => s.jobId !== null,
  },
  {
    id: 'shift',
    title: 'Start your first shift',
    detail: 'A shift is 8 real hours — clock in and live your day.',
    xp: 50,
    isDone: (s) => s.shiftsWorked >= 1 || s.activity?.kind === 'shift',
  },
  {
    id: 'study',
    title: 'Study once',
    detail: 'Take a study session and build your long-term advantage.',
    xp: 40,
    isDone: (s) => s.timesStudied >= 1 || s.activity?.kind === 'study',
  },
  {
    id: 'sleep',
    title: 'Get a night\'s sleep',
    detail: 'Sleep restores energy through the real night — more at home.',
    xp: 25,
    isDone: (s) => s.timesSlept >= 1,
  },
  {
    id: 'community',
    title: 'Help the community',
    detail: 'Volunteer once and turn respect into momentum.',
    xp: 40,
    isDone: (s) => s.timesCommunity >= 1 || s.activity?.kind === 'community',
  },
  {
    id: 'home',
    title: 'Build your first home',
    detail: 'Market → Homes. Then place it and grow into a real roof over time.',
    xp: 75,
    isDone: (s) => s.assets.some((a) => a.kind === 'home'),
  },
  {
    id: 'business',
    title: 'Build your first business',
    detail: 'Market → Businesses. A real place on the map, then workers and revenue.',
    xp: 75,
    isDone: (s) => s.assets.some((a) => a.kind === 'business'),
  },
  {
    id: 'collect',
    title: 'Collect your first profits',
    detail: 'Open Assets and press Collect.',
    xp: 100,
    isDone: (s) => s.totalCollected > 0,
  },
  {
    // The discovery nudge — without this, a new player can play for hours
    // without realizing the 🏆 panel (25 achievements, daily streak, lucky
    // moments) even exists. Surfacing it as the final tutorial step converts
    // the retention engine from "hidden feature" to "the next thing to chase".
    id: 'achievements',
    title: 'Discover your achievements',
    detail: 'Tap the 🏆 button. 25 achievements, a daily streak, and rare lucky moments await.',
    xp: 50,
    isDone: (s) => s.sawAchievementsPanel,
  },
]
