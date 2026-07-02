import type { PlacedAsset } from './types'

/** The slice of game state the tutorial reads to judge progress */
export interface TutorialSnapshot {
  timesEaten: number
  timesSlept: number
  jobId: string | null
  shiftsWorked: number
  assets: PlacedAsset[]
  totalCollected: number
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
 * Order mirrors a real first session: survive, earn, own, profit.
 */
export const TUTORIAL_STEPS: TutorialStep[] = [
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
    title: 'Work your first shift',
    detail: 'Six game hours. Keep your energy and food up.',
    xp: 50,
    isDone: (s) => s.shiftsWorked >= 1,
  },
  {
    id: 'sleep',
    title: 'Get a night\'s sleep',
    detail: 'Sleep restores energy — fully, once you own a home.',
    xp: 25,
    isDone: (s) => s.timesSlept >= 1,
  },
  {
    id: 'home',
    title: 'Buy a home',
    detail: 'Market → Homes. Then click anywhere on Earth to place it.',
    xp: 75,
    isDone: (s) => s.assets.some((a) => a.kind === 'home'),
  },
  {
    id: 'business',
    title: 'Open a business',
    detail: 'Market → Businesses. Your first passive income.',
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
]
