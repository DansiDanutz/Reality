import { useMemo } from 'react'
import { jobById } from '../../game/catalog'
import { educationWageBonusFrom } from '../../game/education'
import { careerRankOf, cashflowOf, formatMoney, nextRankOf, wageBonusFrom } from '../../game/engine'
import { useGame } from '../../store/gameStore'

/**
 * The Finance dashboard: your daily profit & loss, told straight.
 * Passive income + a day's wages − the real cost of staying alive.
 * Below it: the career ladder — seniority earned shift by shift.
 */
export default function FinanceCard() {
  const assets = useGame((s) => s.assets)
  const inventory = useGame((s) => s.inventory)
  const jobId = useGame((s) => s.jobId)
  const shiftsWorked = useGame((s) => s.shiftsWorked)
  const educationProgress = useGame((s) => s.educationProgress)

  const job = jobId ? jobById(jobId) : undefined
  const hasHome = assets.some((a) => a.kind === 'home')
  const schoolWageBonus = educationWageBonusFrom(educationProgress)

  const flow = useMemo(
    () =>
      cashflowOf({
        assets,
        hasHome,
        wage: job?.wage ?? 0,
        shiftsWorked,
        wageBonus: wageBonusFrom(inventory) + schoolWageBonus,
      }),
    [assets, hasHome, job?.wage, shiftsWorked, inventory, schoolWageBonus],
  )
  const rank = careerRankOf(shiftsWorked)
  const next = nextRankOf(shiftsWorked)
  const rankProgress = next
    ? Math.min(100, ((shiftsWorked - rank.shiftsRequired) / (next.shiftsRequired - rank.shiftsRequired)) * 100)
    : 100

  const rows: { label: string; value: number; kind: 'in' | 'out' }[] = [
    { label: 'businesses', value: flow.passivePerDay, kind: 'in' },
    { label: job ? `wages (${job.title})` : 'wages (no job)', value: flow.wagesPerDay, kind: 'in' },
    { label: hasHome ? 'living (home cooking)' : 'living (eating out)', value: -flow.livingCostPerDay, kind: 'out' },
    ...(flow.upkeepPerDay > 0 ? [{ label: 'upkeep (opex + tax)', value: -flow.upkeepPerDay, kind: 'out' as const }] : []),
  ]

  return (
    <div className="finance">
      <div className="finance-net">
        <span className="stat-label">net / real day</span>
        <span className={`finance-net-value mono ${flow.netPerDay >= 0 ? 'pos' : 'neg'}`}>
          {flow.netPerDay >= 0 ? '+' : '−'}
          {formatMoney(Math.abs(flow.netPerDay))}
        </span>
      </div>
      <ul className="finance-rows">
        {rows.map((r) => (
          <li className="finance-row" key={r.label}>
            <span className="stat-label">{r.label}</span>
            <span className={`mono finance-amount ${r.kind}`}>
              {r.value >= 0 ? '+' : '−'}
              {formatMoney(Math.abs(r.value))}
            </span>
          </li>
        ))}
      </ul>
      <div className="finance-career">
        <div className="finance-career-head">
          <span className="stat-label">career · {rank.title}</span>
          <span className="stat-label mono">×{rank.wageMultiplier.toFixed(2)}{schoolWageBonus > 0 ? ` · school +${Math.round(schoolWageBonus * 100)}%` : ''}</span>
        </div>
        <div className="xp-track">
          <div className="xp-fill" style={{ width: `${rankProgress}%` }} />
        </div>
        <p className="finance-next">
          {next
            ? `${next.shiftsToGo} shift${next.shiftsToGo > 1 ? 's' : ''} to ${next.title} (+${Math.round((next.wageMultiplier - 1) * 100)}% wages)`
            : 'Top of the ladder — every shift pays +70%'}
        </p>
      </div>
    </div>
  )
}
