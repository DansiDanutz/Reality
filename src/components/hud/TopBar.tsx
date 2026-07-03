import { dayOfLife, localClock, zoneFor } from '../../game/clock'
import { useGame } from '../../store/gameStore'
import AnimatedMoney from './AnimatedMoney'

export default function TopBar() {
  const citizen = useGame((s) => s.citizen)
  const money = useGame((s) => s.money)
  const level = useGame((s) => s.level)
  const assets = useGame((s) => s.assets)
  const panel = useGame((s) => s.panel)
  const setPanel = useGame((s) => s.setPanel)
  // Re-render every tick so the real clock stays live
  useGame((s) => s.lastSeenAt)

  if (!citizen) return null

  // Rule #1: real time. The clock shows the actual local time where the
  // citizen lives — their owned home, else their real hometown.
  const home = assets.find((a) => a.kind === 'home')
  const anchor = home ?? (citizen.spawnLat !== undefined ? { lat: citizen.spawnLat, lng: citizen.spawnLng! } : null)
  const clock = localClock(anchor ? zoneFor(anchor.lat, anchor.lng) : undefined)
  const day = dayOfLife(citizen.createdAt)

  const toggle = (id: 'shop' | 'work' | 'assets' | 'top' | 'profile') => setPanel(panel === id ? null : id)

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <span className="wordmark">REALITY</span>
        {citizen.founderNumber > 0 ? (
          <span className="founder-chip" title={citizen.online ? 'Your founder slot in the live world registry' : 'Claiming your slot when the world is reachable'}>
            Founder #{String(citizen.founderNumber).padStart(4, '0')}
          </span>
        ) : (
          <span className="founder-chip" title="Registering with the world…">
            {citizen.online === false ? 'Offline' : 'Citizen'}
          </span>
        )}
      </div>

      <div className="topbar-status">
        <div className="stat">
          <span className="stat-label">citizen</span>
          <span className="stat-value">{citizen.name} · L{level}</span>
        </div>
        <div className="stat">
          <span className="stat-label">{clock.place} · day {day}</span>
          <span className="stat-value mono">{clock.time}</span>
        </div>
        <div className="stat stat-money">
          <span className="stat-label">balance</span>
          <span className="stat-value mono gold"><AnimatedMoney value={money} /></span>
        </div>
      </div>

      <nav className="topbar-nav" aria-label="Game menus">
        <button className={panel === 'shop' ? 'nav-btn active' : 'nav-btn'} onClick={() => toggle('shop')}>Shop</button>
        <button className={panel === 'work' ? 'nav-btn active' : 'nav-btn'} onClick={() => toggle('work')}>Work</button>
        <button className={panel === 'assets' ? 'nav-btn active' : 'nav-btn'} onClick={() => toggle('assets')}>Assets</button>
        <button className={panel === 'top' ? 'nav-btn active' : 'nav-btn'} onClick={() => toggle('top')}>Top</button>
        <button className={panel === 'profile' ? 'nav-btn active' : 'nav-btn'} onClick={() => toggle('profile')}>Profile</button>
      </nav>
    </header>
  )
}
