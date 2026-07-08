import { describe, expect, test } from 'vitest'
import { notificationDailyChallengeProgress } from './useNotifications'
import type { ChallengeDef, DailyChallengeSnapshot } from '../game/dailyChallenges'

const challenges: ChallengeDef[] = [
  { id: 'eat-2', label: 'Eat 2 meals', verb: 'meals', difficulty: 'easy', metric: 'mealsToday', target: 2 },
  { id: 'shift-1', label: 'Complete 1 shift', verb: 'shifts', difficulty: 'medium', metric: 'shiftsToday', target: 1 },
  { id: 'build-60', label: 'Build for 60 minutes', verb: 'build minutes', difficulty: 'hard', metric: 'constructionMinutesToday', target: 60 },
  { id: 'community-1', label: 'Help locally once', verb: 'help actions', difficulty: 'medium', metric: 'communityToday', target: 1 },
]

const snap: DailyChallengeSnapshot = {
  mealsToday: 2,
  drinksToday: 0,
  hygieneToday: 0,
  shiftsToday: 0,
  earnedToday: 0,
  sleptToday: 0,
  boughtToday: 0,
  studiedToday: 0,
  gatheredToday: 0,
  constructionMinutesToday: 30,
  workersHiredToday: 0,
  communityToday: 0,
  businessDevelopmentMinutesToday: 0,
}

describe('notificationDailyChallengeProgress', () => {
  test('counts claimed or complete challenges and uses the generated total', () => {
    expect(notificationDailyChallengeProgress(challenges, ['community-1'], snap)).toEqual({
      done: 2,
      total: 4,
    })
  })
})
