import { AVATARS } from '../../game/catalog'
import { useGame } from '../../store/gameStore'

export default function AvatarCard() {
  const citizen = useGame((s) => s.citizen)
  const level = useGame((s) => s.level)
  const activity = useGame((s) => s.activity)
  const avatarId = useGame((s) => s.avatarId)
  const setAvatar = useGame((s) => s.setAvatar)
  const setPanel = useGame((s) => s.setPanel)

  if (!citizen) return null

  const avatar = AVATARS.find((a) => a.id === avatarId) ?? AVATARS[0]
  const next = AVATARS[(AVATARS.findIndex((a) => a.id === avatar.id) + 1) % AVATARS.length]
  const picture = citizen.googlePicture ?? avatar.src
  const status = activity ? (activity.kind === 'sleep' ? 'Sleeping' : `On shift · ${activity.title}`) : 'Living'

  return (
    <div className="avatar-card">
      <button
        className="avatar-portrait"
        onClick={() => setAvatar(next.id)}
        title={citizen.googlePicture ? 'Your Google photo' : `Playing as ${avatar.name} — click to switch to ${next.name}`}
      >
        <img src={picture} alt={`Avatar: ${avatar.name}`} width={72} height={72} referrerPolicy="no-referrer" />
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
