import { challengesForDay, challengeSetSummary, type DailyChallengeSnapshot } from '../../game/dailyChallenges'
import { useGame } from '../../store/gameStore'

/**
 * The always-visible goals card — replaces the tutorial objectives card once
 * onboarding completes. Shows the player's streak + daily-challenge progress
 * at a glance, with a tap to open the full Goals tab.
 *
 * The "always-visible goal" pattern from mobile games: the player should never
 * have to open a panel to know "how am I doing today?". This card sits in the
 * HUD permanently, a constant gentle pull toward the next action.
 */
export default function GoalsCard() {
  const citizen = useGame((s) => s.citizen)
  const streakLength = useGame((s) => s.streakLength)
  const dailyCounters = useGame((s) => s.dailyCounters)
  const setPanel = useGame((s) => s.setPanel)

  if (!citizen) return null

  // Daily challenges — only show if the day has been seeded.
  const day = dailyCounters.day
  const challenges = day > 0 ? challengesForDay(citizen.citizenId ?? 'anon', day) : []
  const csnap: DailyChallengeSnapshot = {
    mealsToday: dailyCounters.mealsToday,
    shiftsToday: dailyCounters.shiftsToday,
    earnedToday: dailyCounters.earnedToday,
    sleptToday: dailyCounters.sleptToday,
    boughtToday: dailyCounters.boughtToday,
  }
  const summary = challenges.length > 0 ? challengeSetSummary(challenges, csnap) : null
  // Count a challenge as "done" if claimed OR complete (claim is auto, so this
  // matches what the player sees in the panel).
  const done = summary?.done ?? 0
  const total = summary?.total ?? 0
  const allDone = summary?.allComplete ?? false

  return (
    <button
      className="goals-card"
      onClick={() => setPanel('achievements')}
      aria-label={`Goals: ${done} of ${total} daily challenges done${streakLength >= 2 ? `, ${streakLength}-day streak` : ''}. Open for details.`}
    >
      <header className="goals-card-head">
        <span className="goals-card-title">🎯 Today</span>
        {streakLength >= 2 && (
          <span className="goals-card-streak" aria-hidden>🔥 {streakLength}</span>
        )}
      </header>
      {total > 0 ? (
        <>
          <div className="goals-card-bar" aria-hidden>
            <div
              className="goals-card-bar-fill"
              style={{ width: `${(done / total) * 100}%` }}
            />
          </div>
          <span className={`goals-card-count mono ${allDone ? 'done' : ''}`}>
            {allDone ? 'All done! 🎉' : `${done}/${total} challenges`}
          </span>
        </>
      ) : (
        <span className="goals-card-count mono">Tap to see your goals</span>
      )}
    </button>
  )
}
