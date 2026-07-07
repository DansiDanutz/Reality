import { useEffect, useState } from 'react'

/**
 * Read-only funnel dashboard (issue #12). Renders GET /api/funnel as a
 * horizontal funnel: one row per milestone, ordered by the citizen journey,
 * with the drop-off % between each step. No chart library — the bars are divs
 * sized to each step's share of the first (the top of the funnel).
 *
 * Reached at ?funnel — a separate page from the game, so the numbers stay a
 * quiet, honest report rather than a HUD element.
 */

const EVENT_LABELS: Record<string, { step: string; detail: string }> = {
  welcome_seen: { step: 'Saw the world', detail: 'Landed on the welcome screen' },
  spawn_detected: { step: 'Located', detail: 'Hometown resolved from their IP' },
  citizen_created: { step: 'Born', detail: 'Claimed a citizen slot' },
  avatar_created: { step: 'Got a face', detail: 'Generated their avatar' },
  first_zoom_to_street: { step: 'Zoomed in', detail: 'Dropped from globe to their city' },
  walk_mode_entered: { step: 'Walked', detail: 'Entered first-person Street Mode' },
  first_purchase: { step: 'Bought', detail: 'First Market purchase' },
  first_shift_started: { step: 'Worked', detail: 'Started a first shift or gig' },
  first_home_placed: { step: 'Homed', detail: 'Placed a home on Earth' },
  first_business_placed: { step: 'Founded', detail: 'Opened a first business' },
  first_collect: { step: 'Collected', detail: 'Banked their first earnings' },
  d1_return: { step: 'Returned D1', detail: 'Came back after one real day' },
  d7_return: { step: 'Returned', detail: 'Came back a real week later' },
  tutorial_complete: { step: 'Learned basics', detail: 'Finished the first tutorial path' },
  life_ladder_stage_progress: { step: 'Climbed ladder', detail: 'Reached a later Life Ladder stage' },
  millionaire_path_milestone: { step: 'Path milestone', detail: 'Reached a millionaire-path stage' },
  today_plan_viewed: { step: 'Saw Today Plan', detail: 'Viewed the Life Ladder plan surface' },
  today_plan_completed: { step: 'Did Today Plan', detail: 'Completed a Life Ladder wrapped task' },
  courier_package_opened: { step: 'Opened courier', detail: 'Opened the daily courier wrapper' },
  courier_package_completed: { step: 'Completed courier', detail: 'Claimed a courier objective' },
  education_started: { step: 'Started study', detail: 'Began a real study block' },
  education_completed: { step: 'Completed study', detail: 'Finished a course or certificate' },
  respect_gained: { step: 'Earned respect', detail: 'Gained reputation from behavior' },
  respect_lost: { step: 'Lost respect', detail: 'Broke a commitment and took a humane hit' },
  friendship_gained: { step: 'Built friendship', detail: 'Earned social connection through help' },
  community_action_completed: { step: 'Helped locally', detail: 'Completed a community action' },
  first_achievement: { step: 'Achieved', detail: 'Claimed a first achievement' },
  first_lucky: { step: 'Lucky moment', detail: 'Saw a first lucky moment' },
  streak_7: { step: 'Seven-day streak', detail: 'Built a 7-day daily streak' },
  daily_complete: { step: 'Perfect day', detail: 'Completed all daily challenges' },
  first_upgrade: { step: 'Upgraded', detail: 'Improved a first business' },
  business_maxed: { step: 'Maxed business', detail: 'Reached the business level cap' },
  week_milestone: { step: 'Week milestone', detail: 'Crossed a long-term time milestone' },
  notifications_enabled: { step: 'Notifications', detail: 'Enabled return reminders' },
  telegram_linked: { step: 'Telegram linked', detail: 'Verified Telegram identity' },
}

interface FunnelStep {
  event: string
  uniques: number
}

export default function FunnelDashboard() {
  const [steps, setSteps] = useState<FunnelStep[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/funnel')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then((d: { ok: boolean; funnel: FunnelStep[] }) => {
        if (alive && d.ok) setSteps(d.funnel)
        else if (alive) setError('The funnel endpoint returned no data.')
      })
      .catch(() => alive && setError('The funnel is unreachable right now.'))
    return () => {
      alive = false
    }
  }, [])

  const total = steps?.length ? steps[0].uniques : 0

  return (
    <main className="funnel-page" role="main">
      <header className="funnel-head">
        <h1 className="funnel-title">Reality — acquisition funnel</h1>
        <p className="funnel-sub">
          Unique citizens per milestone, in journey order. Open numbers — the same data the team sees.
        </p>
        <a className="funnel-back" href="/">← Back to the world</a>
      </header>

      {error && <p className="funnel-empty">{error}</p>}
      {!error && !steps && <p className="funnel-empty">Loading the funnel…</p>}

      {steps && (
        <>
          {total === 0 ? (
            <p className="funnel-empty">No citizens have been tracked yet. The funnel fills as the world is lived in.</p>
          ) : (
            <ol className="funnel-list" aria-label="Citizen journey funnel">
              {steps.map((s, i) => {
                const meta = EVENT_LABELS[s.event] ?? { step: s.event, detail: '' }
                const prev = i === 0 ? s.uniques : steps[i - 1].uniques
                const widthPct = total > 0 ? Math.max(2, Math.round((s.uniques / total) * 100)) : 0
                const dropoff = i === 0 || prev === 0 ? null : Math.round((1 - s.uniques / prev) * 100)
                const isLast = i === steps.length - 1
                return (
                  <li className="funnel-row" key={s.event}>
                    <div className="funnel-step">
                      <span className="funnel-idx mono">{String(i + 1).padStart(2, '0')}</span>
                      <span className="funnel-stepname">{meta.step}</span>
                      <span className="funnel-detail">{meta.detail}</span>
                    </div>
                    <div className="funnel-bar-wrap">
                      <div
                        className={isLast ? 'funnel-bar retention' : 'funnel-bar'}
                        style={{ width: `${widthPct}%` }}
                        role="meter"
                        aria-valuenow={s.uniques}
                        aria-valuemin={0}
                        aria-label={`${meta.step}: ${s.uniques} unique citizens`}
                      />
                      <span className="funnel-count mono">{s.uniques.toLocaleString()}</span>
                    </div>
                    <div className="funnel-drop">
                      {dropoff === null ? (
                        <span className="funnel-pct mono">{total > 0 ? '100%' : '—'}</span>
                      ) : (
                        <>
                          <span className={`funnel-pct mono ${dropoff >= 50 ? 'crit' : dropoff >= 25 ? 'warn' : 'ok'}`}>
                            {dropoff >= 0 ? `−${dropoff}%` : `+${Math.abs(dropoff)}%`}
                          </span>
                          <span className="funnel-droplabel">vs. previous step</span>
                        </>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
          <p className="funnel-foot">
            End-to-end retention:
            {total > 0 && steps ? (
              <span className="mono gold"> {Math.round((steps[steps.length - 1].uniques / total) * 100)}%</span>
            ) : (
              <span className="mono"> —</span>
            )}
            <span> of citizens who saw the world came back a real week later.</span>
          </p>
        </>
      )}
    </main>
  )
}
