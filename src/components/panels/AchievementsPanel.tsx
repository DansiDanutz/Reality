import { careerRankOf, formatMoney, nextRankOf } from '../../game/engine'
import {
  ACHIEVEMENTS,
  CATEGORY_META,
  TIER_META,
  type Achievement,
  type AchievementCategory,
  type AchievementSnapshot,
} from '../../game/achievements'
import { LUCKY_MOMENT_DEFS, RARITY_META } from '../../game/luckyMoments'
import { rewardForStreakDay, STREAK_REWARD_TIERS, streakLabel } from '../../game/streak'
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
  const streakLength = useGame((s) => s.streakLength)
  const streakBest = useGame((s) => s.streakBest)
  const seenMomentIds = useGame((s) => s.luckyMomentsSeenIds)
  const shiftsWorked = useGame((s) => s.shiftsWorked)

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

      {/* Next goals — the "what should I do right now?" hook. Combats choice
          paralysis by surfacing the closest career rank, the next streak
          reward, and a few unclaimed achievements. Always at the top. */}
      <NextGoalsBlock
        shiftsWorked={shiftsWorked}
        streakLength={streakLength}
        snapshot={snapshot}
        claimed={claimed}
      />

      {/* Daily streak — the come-back-tomorrow hook. Always visible so the
          player sees what tomorrow's reward will be, even mid-session. */}
      <StreakBlock length={streakLength} best={streakBest} />

      {/* Lucky moments collection — the Pokédex hook. Discovered moments show
          their story; undiscovered ones show only the rarity silhouette, so
          the player always has a "find them all" chase. */}
      <CollectionBlock seenIds={seenMomentIds} />

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

/**
 * The next-goals callout — the "what should I do right now?" hook. Combats
 * the choice paralysis that makes players quit life-sims by surfacing the
 * three closest, most concrete goals: the next career rank (with shifts to
 * go), tomorrow's streak reward, and the next few unclaimed achievements.
 *
 * Career rank and streak both have *numeric* progress (shifts worked, days
 * in a row), so they get real progress bars. Achievements are predicate-
 * based so they show as "next rungs" without a bar — still concrete enough
 * to point the player at the nearest thing to chase.
 */
function NextGoalsBlock({
  shiftsWorked,
  streakLength,
  snapshot,
  claimed,
}: {
  shiftsWorked: number
  streakLength: number
  snapshot: AchievementSnapshot
  claimed: string[]
}) {
  const nextRank = nextRankOf(shiftsWorked)
  const currentRank = careerRankOf(shiftsWorked)
  const tomorrowReward = rewardForStreakDay(streakLength + 1)
  // Pick up to 3 unclaimed achievements, prioritizing category diversity so
  // the player sees a spread of options rather than three from one category.
  const unclaimed = ACHIEVEMENTS.filter((a) => !claimed.includes(a.id) && !a.isUnlocked(snapshot))
  const seenCats = new Set<AchievementCategory>()
  const nextAchievements: Achievement[] = []
  for (const a of unclaimed) {
    if (nextAchievements.length >= 3) break
    if (seenCats.has(a.category) && nextAchievements.length < unclaimed.length) {
      // Skip if we already have one from this category AND there's room to
      // diversify — but only on the first pass. Fall back to filling later.
      continue
    }
    seenCats.add(a.category)
    nextAchievements.push(a)
  }
  // If we didn't fill 3 with diversity, top up from the remaining unclaimed.
  if (nextAchievements.length < 3) {
    for (const a of unclaimed) {
      if (nextAchievements.length >= 3) break
      if (!nextAchievements.includes(a)) nextAchievements.push(a)
    }
  }

  // Don't render the block if there's nothing to chase (maxed-out player).
  if (!nextRank && tomorrowReward.cash === 0 && nextAchievements.length === 0) return null

  return (
    <div className="next-goals" aria-label="Next goals">
      {nextRank && (
        <div className="next-goal-row">
          <div className="next-goal-label">
            <span className="next-goal-icon">📈</span>
            <div>
              <span className="next-goal-title">Next: {nextRank.title}</span>
              <span className="next-goal-sub">
                {currentRank.title} → {nextRank.title} · +{Math.round((nextRank.wageMultiplier - 1) * 100)}% wages
              </span>
            </div>
          </div>
          <div className="next-goal-progress">
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{
                  width: `${Math.min(100, (shiftsWorked / nextRank.shiftsRequired) * 100)}%`,
                }}
              />
            </div>
            <span className="progress-count mono">{nextRank.shiftsToGo} shifts to go</span>
          </div>
        </div>
      )}
      <div className="next-goal-row">
        <div className="next-goal-label">
          <span className="next-goal-icon">🔥</span>
          <div>
            <span className="next-goal-title">Tomorrow's streak</span>
            <span className="next-goal-sub">Day {streakLength + 1} · come back for the reward</span>
          </div>
        </div>
        <div className="next-goal-progress">
          <span className="next-goal-reward mono gold">
            +{formatMoney(tomorrowReward.cash)} · +{tomorrowReward.xp} XP
          </span>
        </div>
      </div>
      {nextAchievements.length > 0 && (
        <ul className="next-goal-achs" aria-label="Nearest unclaimed achievements">
          {nextAchievements.map((a) => {
            const meta = CATEGORY_META[a.category]
            const tier = TIER_META[a.tier]
            return (
              <li key={a.id} className="next-goal-ach">
                <span className="next-goal-ach-icon" aria-hidden>{tier.icon}</span>
                <span className="next-goal-ach-cat" aria-hidden>{meta.icon}</span>
                <span className="next-goal-ach-title">{a.title}</span>
                <span className="next-goal-ach-reward mono">+{a.xp} XP</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/**
 * The streak callout — current length, personal best, the next reward, and
 * the upcoming milestones. The next-reward preview is the key hook: it tells
 * the player exactly what they'll get if they come back tomorrow, converting
 * "I should play again" from a vague feeling to a concrete number.
 */
function StreakBlock({ length, best }: { length: number; best: number }) {
  const tomorrow = rewardForStreakDay(length + 1)
  // Show the next three named tiers above the player's current length, so the
  // long-term horizon is always visible (the "I'll reach day 30" drive).
  const upcoming = STREAK_REWARD_TIERS.filter(([d]) => d > length).slice(0, 3)
  return (
    <div className="streak-block" aria-label="Daily streak">
      <div className="streak-current">
        <span className="streak-flame" aria-hidden>🔥</span>
        <div className="streak-current-text">
          <span className="streak-current-length">{streakLabel(Math.max(length, 1))}</span>
          <span className="streak-current-best">Best: {best} days</span>
        </div>
      </div>
      <div className="streak-next">
        <span className="stat-label">Come back tomorrow</span>
        <span className="streak-next-reward mono gold">
          +{formatMoney(tomorrow.cash)} · +{tomorrow.xp} XP
        </span>
      </div>
      {upcoming.length > 0 && (
        <ul className="streak-milestones" aria-label="Upcoming streak milestones">
          {upcoming.map(([day, cash, xp]) => (
            <li key={day} className={day === length + 1 ? 'next' : ''}>
              <span className="streak-milestone-day mono">Day {day}</span>
              <span className="streak-milestone-reward mono">+{formatMoney(cash)} · +{xp} XP</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * The lucky moments collection — a Pokédex-style grid. Discovered moments
 * reveal their full story and reward range; undiscovered ones show only the
 * rarity tier and a `???` silhouette. The chase ("I've found 7/10, where's
 * the lottery?") keeps players coming back between jackpots.
 *
 * Deliberately hidden entirely until the player has seen at least one moment,
 * so the panel doesn't spoil the surprise on first load.
 */
function CollectionBlock({ seenIds }: { seenIds: string[] }) {
  if (LUCKY_MOMENT_DEFS.length === 0) return null
  const seen = new Set(seenIds)
  const discovered = LUCKY_MOMENT_DEFS.filter((d) => seen.has(d.id))
  // Don't render the block at all until the player has witnessed at least one
  // lucky moment — spoils less, and feels like an unlock in itself.
  if (discovered.length === 0) return null

  // Group by rarity, then render each tier in its own sub-list.
  const byRarity = {
    legendary: LUCKY_MOMENT_DEFS.filter((d) => d.rarity === 'legendary'),
    rare: LUCKY_MOMENT_DEFS.filter((d) => d.rarity === 'rare'),
    lucky: LUCKY_MOMENT_DEFS.filter((d) => d.rarity === 'lucky'),
  }
  const order: Array<keyof typeof byRarity> = ['legendary', 'rare', 'lucky']

  return (
    <div className="collection-block" aria-label="Lucky moments collection">
      <header className="collection-head">
        <span className="collection-title">🍀 Lucky moments</span>
        <span className="collection-count mono">{discovered.length}/{LUCKY_MOMENT_DEFS.length}</span>
      </header>
      {order.map((rarity) => {
        const defs = byRarity[rarity]
        const meta = RARITY_META[rarity]
        const found = defs.filter((d) => seen.has(d.id)).length
        return (
          <div className="collection-tier" key={rarity} data-rarity={rarity}>
            <div className="collection-tier-head">
              <span className="collection-tier-icon" aria-hidden>{meta.icon}</span>
              <span className="collection-tier-label">{meta.label}</span>
              <span className="collection-tier-count mono">{found}/{defs.length}</span>
            </div>
            <ul className="collection-grid">
              {defs.map((d) => {
                const isSeen = seen.has(d.id)
                return (
                  <li
                    className={`collection-card${isSeen ? ' discovered' : ' undiscovered'}`}
                    key={d.id}
                    aria-label={isSeen ? `${meta.label}: discovered` : `${meta.label}: undiscovered`}
                  >
                    {isSeen ? (
                      <>
                        <p className="collection-story">{d.text}</p>
                        <span className="collection-reward mono">
                          {formatMoney(d.cashMin)}–{formatMoney(d.cashMax)}
                        </span>
                      </>
                    ) : (
                      <span className="collection-silhouette">??? {meta.icon}</span>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
