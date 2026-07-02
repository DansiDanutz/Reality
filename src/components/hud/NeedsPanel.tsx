import type { NeedKey } from '../../game/types'
import { useGame } from '../../store/gameStore'

const NEEDS: { key: NeedKey; label: string }[] = [
  { key: 'hunger', label: 'Food' },
  { key: 'energy', label: 'Energy' },
  { key: 'hygiene', label: 'Hygiene' },
  { key: 'fun', label: 'Fun' },
]

const tone = (v: number) => (v < 20 ? 'crit' : v < 45 ? 'low' : 'ok')

export default function NeedsPanel() {
  const needs = useGame((s) => s.needs)
  const health = useGame((s) => s.health)
  const citizen = useGame((s) => s.citizen)
  if (!citizen) return null

  return (
    <aside className="needs" aria-label="Vitals">
      <div className="needs-health">
        <span className="needs-health-label">HP</span>
        <span className={`needs-health-value mono ${tone(health)}`}>{Math.round(health)}</span>
      </div>
      {NEEDS.map(({ key, label }) => {
        const v = needs[key]
        return (
          <div className="need" key={key} title={`${label}: ${Math.round(v)}/100`}>
            <div className="need-track">
              <div className={`need-fill ${tone(v)}`} style={{ height: `${v}%` }} />
            </div>
            <span className="need-label">{label}</span>
          </div>
        )
      })}
    </aside>
  )
}
