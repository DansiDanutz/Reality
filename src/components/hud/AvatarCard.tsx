import { useGame } from '../../store/gameStore'

export default function AvatarCard() {
  const citizen = useGame((s) => s.citizen)
  const level = useGame((s) => s.level)
  const activity = useGame((s) => s.activity)
  const setPanel = useGame((s) => s.setPanel)

  if (!citizen) return null

  const status = activity ? (activity.kind === 'sleep' ? 'Sleeping' : `On shift · ${activity.title}`) : 'Living'

  return (
    <div className="avatar-card">
      <button
        className="avatar-portrait"
        onClick={() => setPanel('profile')}
        title={citizen.avatarUrl ? 'Open your profile' : 'Create your avatar in the Profile studio'}
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
