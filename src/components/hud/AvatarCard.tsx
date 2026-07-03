import { xpForLevel } from '../../game/engine'
import { useGame } from '../../store/gameStore'

export default function AvatarCard() {
  const citizen = useGame((s) => s.citizen)
  const level = useGame((s) => s.level)
  const xp = useGame((s) => s.xp)
  const activity = useGame((s) => s.activity)
  const setPanel = useGame((s) => s.setPanel)

  if (!citizen) return null

  const status = activity ? (activity.kind === 'sleep' ? 'Sleeping' : `On shift · ${activity.title}`) : 'Living'
  // Progression is the spine — wear it as a ring around your face
  const progress = Math.min(100, (xp / xpForLevel(level)) * 100)

  return (
    <div className="avatar-card">
      <button
        className="avatar-portrait"
        style={{
          background: `conic-gradient(var(--gold) ${progress * 3.6}deg, rgba(240,180,41,0.15) 0deg)`,
        }}
        onClick={() => setPanel('profile')}
        title={`Level ${level} — ${Math.round(progress)}% to next · ${citizen.avatarUrl ? 'open your profile' : 'create your avatar in the Profile studio'}`}
      >
        {citizen.avatarUrl ? (
          <img src={citizen.avatarUrl} alt="Your avatar" width={72} height={72} />
        ) : (
          <span className="avatar-empty" aria-hidden>{citizen.name.charAt(0).toUpperCase()}</span>
        )}
      </button>
      <button className="avatar-meta" onClick={() => setPanel('profile')} title="Open profile">
        <span className="avatar-name">{citizen.name}</span>
        <span className="avatar-sub">
          L{level}
          {citizen.founderNumber > 0 && <> · Founder #{String(citizen.founderNumber).padStart(4, '0')}</>}
        </span>
        <span className={`avatar-status${activity ? ' busy' : ''}`}>{status}</span>
      </button>
    </div>
  )
}
