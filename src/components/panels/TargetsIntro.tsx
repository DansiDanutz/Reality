import { useGame } from '../../store/gameStore'

/**
 * "How Reality works" — the game's targets, told once at the start of a life
 * (Beat 4 of the player journey). Revisitable wisdom lives in the ⓘ guides.
 */

const TARGETS = [
  { icon: '🧍', title: 'You are a person', text: 'Stay alive: drink, eat, sleep. Your body follows real human rules — tap ⓘ on your vitals to learn them.' },
  { icon: '🏠', title: 'Get a roof', text: 'A home on your real street makes every night count for more.' },
  { icon: '💼', title: 'Get a job', text: 'Shifts are real hours at real wages. Gigs pay small and fast; careers pay better with levels.' },
  { icon: '🏗', title: 'Build your area first', text: 'Your reality starts in YOUR city — you can see the whole world, but you build at home. Grow to unlock your province, your country, the world.' },
  { icon: '🌍', title: 'No top to the ladder', text: 'From a $15,000 food cart in your town to a $12M airline spanning continents. One day: mayor of your real city.' },
]

export default function TargetsIntro() {
  const citizen = useGame((s) => s.citizen)
  const markTargetsSeen = useGame((s) => s.markTargetsSeen)

  if (!citizen) return null

  return (
    <div className="welcome-backdrop">
      <div className="welcome targets">
        <p className="welcome-eyebrow">How Reality works</p>
        <h1 className="targets-title">Five targets, one life</h1>
        <ol className="targets-list">
          {TARGETS.map((t) => (
            <li className="target" key={t.title}>
              <span className="target-icon" aria-hidden>{t.icon}</span>
              <span className="target-body">
                <strong>{t.title}.</strong> {t.text}
              </span>
            </li>
          ))}
        </ol>
        <button className="btn primary" onClick={markTargetsSeen}>
          Begin your life in {citizen.homeCity ?? 'your city'}
        </button>
      </div>
    </div>
  )
}
