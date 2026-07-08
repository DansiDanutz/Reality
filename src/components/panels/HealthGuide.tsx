/**
 * How health works in Reality — the in-game guide.
 * Every mechanic is calibrated to real human physiology (WHO / CDC / EFSA
 * reference figures); full research mapping in docs/plan/02-HEALTH-SYSTEM.md.
 */

import { HEALTH_GUIDE_SECTIONS } from './HealthGuideContent'

export default function HealthGuide() {
  return (
    <section className="panel" aria-label="How health works">
      <h2 className="panel-title">How health works</h2>
      <p className="panel-sub">
        Reality runs on real rules. Every number below is calibrated to real human physiology — the same
        figures the WHO, CDC and EFSA publish — compressed onto your real clock.
      </p>

      {HEALTH_GUIDE_SECTIONS.map((s) => (
        <article className="guide-section" key={s.title}>
          <h3 className="guide-title">
            <span aria-hidden>{s.icon}</span> {s.title}
          </h3>
          <p className="guide-real">{s.reality}</p>
          <p className="guide-game">
            <strong>In Reality:</strong> {s.inGame}
          </p>
        </article>
      ))}

      <p className="panel-sub">
        One sentence to remember: <strong className="gold">drink, eat, sleep — then build your empire.</strong>
      </p>
    </section>
  )
}
