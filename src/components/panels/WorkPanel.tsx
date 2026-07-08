import { JOBS } from '../../game/catalog'
import { formatMoney, xpForLevel } from '../../game/engine'
import { useGame } from '../../store/gameStore'

export function recommendedJobForLevel(level: number) {
  return [...JOBS]
    .filter((job) => level >= job.requiredLevel)
    .sort((a, b) => b.wage - a.wage || a.requiredLevel - b.requiredLevel)[0] ?? null
}

export default function WorkPanel() {
  const level = useGame((s) => s.level)
  const xp = useGame((s) => s.xp)
  const jobId = useGame((s) => s.jobId)
  const shiftsWorked = useGame((s) => s.shiftsWorked)
  const activity = useGame((s) => s.activity)
  const takeJob = useGame((s) => s.takeJob)
  const startShift = useGame((s) => s.startShift)
  const recommendedJob = recommendedJobForLevel(level)

  return (
    <section className="panel" aria-label="Work">
      <h2 className="panel-title">Work</h2>
      <p className="panel-sub">
        Level {level} · {xp}/{xpForLevel(level)} XP · {shiftsWorked} shifts worked. A shift is 8 real
        hours — clock in, live your day, pay lands when it ends. Leave early for pro-rata pay, no XP.
      </p>
      {recommendedJob && (
        <div className="founder-section-head">
          <p className="panel-sub">
            Best next job: <strong>{recommendedJob.title}</strong> — {recommendedJob.flavor}
          </p>
          <button className="btn small primary" onClick={() => takeJob(recommendedJob.id)}>
            Take recommended
          </button>
        </div>
      )}

      <ul className="item-list">
        {JOBS.map((job) => {
          const locked = level < job.requiredLevel
          const current = jobId === job.id
          return (
            <li className={current ? 'item current' : 'item'} key={job.id}>
              <div className="item-info">
                <span className="item-name">{job.title}</span>
                <span className="item-desc">{job.flavor}</span>
                {locked && <span className="item-locked">Unlocks at level {job.requiredLevel}</span>}
              </div>
              <div className="item-buy">
                <span className="item-price mono">{formatMoney(job.wage)}/h</span>
                {current ? (
                  <button className="btn small primary" disabled={!!activity} onClick={startShift}>
                    {activity ? 'Busy' : 'Start shift'}
                  </button>
                ) : (
                  <button className="btn small" disabled={locked} onClick={() => takeJob(job.id)}>Take job</button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
