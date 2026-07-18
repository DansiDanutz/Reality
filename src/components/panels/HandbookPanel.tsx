import { useGame } from '../../store/gameStore'
import PathCard from '../hud/PathCard'
import { HANDBOOK_SECTIONS, MAP_LEGEND } from './HandbookContent'

/**
 * How to Play — the re-readable rulebook. The intro card shows once; this
 * panel answers "what do I do, what am I winning, what does that icon mean"
 * forever, from the Menu on phones and the ? button on desktop.
 */
export default function HandbookPanel() {
  return (
    <section className="panel" aria-label="How to play">
      <h2 className="panel-title">How to play</h2>
      <p className="panel-sub">Everything Reality expects you to know — and where you stand right now.</p>
      <PathCard />
      <button className="btn primary" onClick={() => useGame.getState().setPanel('journey')}>
        🌱 Open your first 30 days
      </button>
      {HANDBOOK_SECTIONS.map((section) => (
        <div className="guide-section" key={section.title}>
          <span className="guide-title">{section.icon} {section.title}</span>
          {section.lines.map((line) => (
            <p className="guide-game" key={line}>{line}</p>
          ))}
        </div>
      ))}
      <div className="guide-section">
        <span className="guide-title">🗺️ Map legend</span>
        <ul className="handbook-legend">
          {MAP_LEGEND.map((entry) => (
            <li className="handbook-legend-row" key={entry.label}>
              <span className="handbook-legend-symbol mono">{entry.symbol}</span>
              <span className="handbook-legend-text">
                <strong>{entry.label}</strong> — {entry.meaning}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
