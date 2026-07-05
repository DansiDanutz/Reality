import type { NeedKey } from '../../game/types'
import { useGame } from '../../store/gameStore'

const NEEDS: { key: NeedKey; label: string }[] = [
  { key: 'hydration', label: 'Water' },
  { key: 'hunger', label: 'Food' },
  { key: 'energy', label: 'Energy' },
  { key: 'hygiene', label: 'Hygiene' },
  { key: 'fun', label: 'Fun' },
]

const tone = (v: number) => (v < 20 ? 'crit' : v < 45 ? 'low' : 'ok')

export default function NeedsPanel() {
  const needs = useGame((s) => s.needs)
  const health = useGame((s) => s.health)
  const illness = useGame((s) => s.illness)
  const citizen = useGame((s) => s.citizen)
  const setPanel = useGame((s) => s.setPanel)
  const openMarket = useGame((s) => s.openMarket)
  if (!citizen) return null

  const illnessHoursLeft = illness ? Math.max(1, Math.ceil((illness.endsAt - Date.now()) / 3_600_000)) : 0

  return (
    <aside className="needs" aria-label="Vitals">
      <button
        className="needs-info"
        aria-label="How health works in Reality"
        title="How health works in Reality"
        onClick={() => setPanel('health')}
      >
        i
      </button>
      <div className="needs-health">
        <span className="needs-health-label">HP</span>
        <span className={`needs-health-value mono ${tone(health)}`}>{Math.round(health)}</span>
      </div>
      {illness && (
        <button
          className="needs-illness"
          role="status"
          title={
            illness.kind === 'cold'
              ? `Cold — rest restores 20% less energy. Clears in ~${illnessHoursLeft}h, or Cold Medicine ($15) now.`
              : `Flu — you can't work. Clears in ~${illnessHoursLeft}h, or Flu Medicine ($35) now.`
          }
          aria-label={`Sick: ${illness.kind}, about ${illnessHoursLeft} hours left. Open pharmacy.`}
          onClick={() => openMarket('health')}
        >
          <span aria-hidden>{illness.kind === 'cold' ? '🤧' : '🤒'}</span>
          <span className="needs-illness-label">{illness.kind === 'cold' ? 'Cold' : 'Flu'}</span>
          <span className="needs-illness-hours mono">~{illnessHoursLeft}h</span>
        </button>
      )}
      {NEEDS.map(({ key, label }) => {
        const v = needs[key]
        const t = tone(v)
        return (
          <div
            className="need"
            key={key}
            title={`${label}: ${Math.round(v)}/100`}
            role="meter"
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(v)}
          >
            <div className="need-track">
              <div className={`need-fill ${t}`} style={{ height: `${v}%` }} />
            </div>
            {/* The number carries the warning too — color is never the only signal */}
            <span className={`need-value mono ${t}`}>
              {t === 'crit' ? '⚠' : ''}
              {Math.round(v)}
            </span>
            <span className="need-label">{label}</span>
          </div>
        )
      })}
    </aside>
  )
}
