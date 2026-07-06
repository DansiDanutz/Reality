import { dayOfLife, localClock, zoneFor } from '../../game/clock'
import { newlyUnlocked } from '../../game/achievements'
import { streakLabel } from '../../game/streak'
import { achievementSnapshotOf, useGame } from '../../store/gameStore'
import AnimatedMoney from './AnimatedMoney'

export default function TopBar() {
  const citizen = useGame((s) => s.citizen)
  const money = useGame((s) => s.money)
  const level = useGame((s) => s.level)
  const assets = useGame((s) => s.assets)
  const panel = useGame((s) => s.panel)
  const setPanel = useGame((s) => s.setPanel)
  const soundOn = useGame((s) => s.soundOn)
  const toggleSound = useGame((s) => s.toggleSound)
  const achievementsClaimed = useGame((s) => s.achievementsClaimed)
  const streakLength = useGame((s) => s.streakLength)
  // Re-render every tick so the real clock stays live
  useGame((s) => s.lastSeenAt)

  // Gold badge on 🏆 when an achievement is earned but not yet claimed (the
  // 1-second window before tick auto-claims, or any edge case)
  const readyCount = newlyUnlocked(achievementSnapshotOf(useGame.getState()), achievementsClaimed).length

  if (!citizen) return null

  // Rule #1: real time. The clock shows the actual local time where the
  // citizen lives — their owned home, else their real hometown.
  const home = assets.find((a) => a.kind === 'home')
  const anchor = home ?? (citizen.spawnLat !== undefined ? { lat: citizen.spawnLat, lng: citizen.spawnLng! } : null)
  const clock = localClock(anchor ? zoneFor(anchor.lat, anchor.lng) : undefined)
  // The zone-derived place is the IANA zone's capital (all of Romania →
  // "Bucharest"). When the citizen lives at their spawn, their real detected
  // hometown is the honest label; an owned home keeps the zone city.
  const placeName = home ? clock.place : (citizen.homeCity ?? clock.place)
  const day = dayOfLife(citizen.createdAt)

  const toggle = (id: 'shop' | 'work' | 'assets' | 'founder' | 'operator' | 'top' | 'profile' | 'achievements' | 'boxes') => setPanel(panel === id ? null : id)

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
          <span className="stat-label">{placeName} · day {day}</span>
          <span className="stat-value mono">{clock.time}</span>
        </div>
        {streakLength >= 2 && (
          <div
            className="stat stat-streak"
            title={`Come back tomorrow to grow your streak. Miss 3 days and it resets.`}
            aria-label={streakLabel(streakLength)}
          >
            <span className="stat-label">streak</span>
            <span className="stat-value mono">🔥 {streakLength}</span>
          </div>
        )}
        <div className="stat stat-money">
          <span className="stat-label">balance</span>
          <span className="stat-value mono gold"><AnimatedMoney value={money} /></span>
        </div>
      </div>

      <nav className="topbar-nav" aria-label="Game menus">
        <button className={panel === 'shop' ? 'nav-btn active' : 'nav-btn'} onClick={() => toggle('shop')}>Shop</button>
        <button className={panel === 'work' ? 'nav-btn active' : 'nav-btn'} onClick={() => toggle('work')}>Work</button>
        <button className={panel === 'assets' ? 'nav-btn active' : 'nav-btn'} onClick={() => toggle('assets')}>Assets</button>
        <button className={panel === 'founder' ? 'nav-btn active' : 'nav-btn'} onClick={() => toggle('founder')}>Area</button>
        <button className={panel === 'operator' ? 'nav-btn active' : 'nav-btn'} onClick={() => toggle('operator')}>Ops</button>
        <button className={panel === 'top' ? 'nav-btn active' : 'nav-btn'} onClick={() => toggle('top')}>Top</button>
        <button
          className={panel === 'boxes' ? 'nav-btn active' : 'nav-btn'}
          onClick={() => toggle('boxes')}
          title="Mystery Boxes"
          aria-label="Mystery Boxes"
        >🎁</button>
        <button
          className={panel === 'achievements' ? 'nav-btn active nav-badge' : 'nav-btn nav-badge'}
          onClick={() => toggle('achievements')}
          title="Achievements"
          aria-label={`Achievements${readyCount > 0 ? `, ${readyCount} ready to claim` : ''}`}
        >
          🏆
          {readyCount > 0 && <span className="nav-dot" aria-hidden />}
        </button>
        <button className={panel === 'profile' ? 'nav-btn active' : 'nav-btn'} onClick={() => toggle('profile')}>Profile</button>
        <button
          className="nav-btn nav-sound"
          aria-label={soundOn ? 'Mute sounds' : 'Unmute sounds'}
          title={soundOn ? 'Mute sounds' : 'Unmute sounds'}
          onClick={toggleSound}
        >
          {soundOn ? '🔊' : '🔇'}
        </button>
      </nav>
    </header>
  )
}
