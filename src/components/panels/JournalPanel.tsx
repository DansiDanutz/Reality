import { dayOfLife } from '../../game/clock'
import { useGame } from '../../store/gameStore'

/**
 * The Journal — your citizen's life story, in reverse-chronological order.
 *
 * Every achievement unlocked, lucky moment witnessed, streak claimed, illness
 * caught, promotion earned — all the events `note()` records in the log — are
 * collected here as a readable timeline. This is the emotional hook that makes
 * life-sims sticky: the player isn't just accumulating numbers, they're
 * writing a story they can look back on.
 *
 * The log is capped at 100 entries (see gameStore `note`), so a daily player
 * sees roughly their last 2-3 weeks of life. Older entries age out — that's
 * intentional: the journal is a living document, not an archive.
 */
export default function JournalPanel() {
  const citizen = useGame((s) => s.citizen)
  const log = useGame((s) => s.log)

  if (!citizen) return null
  const day = dayOfLife(citizen.createdAt)

  return (
    <section className="panel" aria-label="Journal">
      <h2 className="panel-title">📖 Your Life So Far</h2>
      <p className="panel-sub">Day {day} · {log.length} entries</p>

      {log.length === 0 ? (
        <p className="panel-sub">Your story begins now. Live, and your life will be recorded here.</p>
      ) : (
        <ol className="journal-list" aria-label="Life events">
          {log.map((entry, i) => (
            <li key={i} className="journal-entry">
              <span className="journal-bullet" aria-hidden>•</span>
              <span className="journal-text">{entry}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
