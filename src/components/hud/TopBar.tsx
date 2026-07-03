import { formatClock, formatMoney } from '../../game/engine'
import { useGame } from '../../store/gameStore'

export default function TopBar() {
  const citizen = useGame((s) => s.citizen)
  const money = useGame((s) => s.money)
  const minutes = useGame((s) => s.minutes)
  const level = useGame((s) => s.level)
  const panel = useGame((s) => s.panel)
  const setPanel = useGame((s) => s.setPanel)

  if (!citizen) return null
  const { day, time } = formatClock(minutes)

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
          <span className="stat-label">day {day}</span>
          <span className="stat-value mono">{time}</span>
        </div>
        <div className="stat stat-money">
          <span className="stat-label">balance</span>
          <span className="stat-value mono gold">{formatMoney(money)}</span>
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
