import { formatMoney } from '../../game/engine'
import {
  ACHIEVEMENTS,
  CATEGORY_META,
  TIER_META,
  type Achievement,
  type AchievementCategory,
} from '../../game/achievements'
import { achievementSnapshotOf, useGame } from '../../store/gameStore'

/**
 * The Achievements panel — the completionist grid. This is the retention
 * engine: every category shows locked rungs above the player's current standing,
 * so there is always a "next thing" pulling them back.
 *
 * Auto-claiming means most rows are already granted by the time the player
 * opens this (the toast fires the moment the achievement is earned); the
 * panel's job is to make the *progress* visible and the unfinished tiers
 * enticing — the "I'll come back for that gold" drive.
 */
export default function AchievementsPanel() {
  // Subscribe to the count of claimed ids + the volatile counters that flip
  // unlock conditions, so the panel re-renders the instant anything changes.
  const claimedCount = useGame((s) => s.achievementsClaimed.length)
  const claimed = useGame((s) => s.achievementsClaimed)
  // These subscriptions exist only to force re-render when unlock conditions
  // change (the snapshot reads them via getState()).
  useGame((s) => s.level)
  useGame((s) => s.timesEaten)
  useGame((s) => s.timesSlept)
  useGame((s) => s.shiftsWorked)
  useGame((s) => s.totalCollected)
  useGame((s) => s.assets.length)
  const claimAchievement = useGame((s) => s.claimAchievement)

  // Read the full snapshot once per render from the live store
  const snapshot = achievementSnapshotOf(useGame.getState())

  // Group by category, preserve definition order within each
  const byCategory = new Map<AchievementCategory, Achievement[]>()
  for (const a of ACHIEVEMENTS) {
    if (!byCategory.has(a.category)) byCategory.set(a.category, [])
    byCategory.get(a.category)!.push(a)
  }

  const totalClaimed = claimedCount
  const totalXp = ACHIEVEMENTS.filter((a) => claimed.includes(a.id)).reduce((s, a) => s + a.xp, 0)

  return (
    <section className="panel" aria-label="Achievements">
      <h2 className="panel-title">🏆 Achievements</h2>
      <div className="ach-summary">
        <span className="stat-value mono gold">
          {totalClaimed}/{ACHIEVEMENTS.length} unlocked
        </span>
        <span className="stat-label mono">{formatMoney(totalXp)} XP earned from achievements</span>
      </div>

      {[...byCategory.entries()].map(([cat, items]) => {
        const meta = CATEGORY_META[cat]
        const catClaimed = items.filter((a) => claimed.includes(a.id)).length
        return (
          <div className="ach-category" key={cat}>
            <header className="ach-cat-head">
              <span className="ach-cat-icon" aria-hidden>{meta.icon}</span>
              <span className="ach-cat-name">{meta.label}</span>
              <span className="ach-cat-count mono">{catClaimed}/{items.length}</span>
            </header>
            <ul className="ach-grid">
              {items.map((a) => {
                const unlocked = a.isUnlocked(snapshot)
                const isClaimed = claimed.includes(a.id)
                const tier = TIER_META[a.tier]
                return (
                  <li
                    className={`ach-card${isClaimed ? ' claimed' : unlocked ? ' ready' : ' locked'}`}
                    key={a.id}
                    aria-label={`${a.title}: ${isClaimed ? 'unlocked' : unlocked ? 'ready to claim' : 'locked'}`}
                  >
                    <div className="ach-card-head">
                      <span className="ach-tier" aria-hidden>{tier.icon}</span>
                      <span className="ach-title">{a.title}</span>
                    </div>
                    <p className="ach-detail">{a.detail}</p>
                    <div className="ach-foot">
                      <span className="ach-reward mono">+{a.xp} XP · {formatMoney(a.bounty)}</span>
                      {isClaimed ? (
                        <span className="ach-status done">✓ unlocked</span>
                      ) : unlocked ? (
                        <button className="btn small primary" onClick={() => claimAchievement(a.id)}>
                          Claim
                        </button>
                      ) : (
                        <span className="ach-status locked">locked</span>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </section>
  )
}
