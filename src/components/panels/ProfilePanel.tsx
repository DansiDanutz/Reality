import { useEffect, useRef, useState } from 'react'
import { dayOfLife } from '../../game/clock'
import { formatMoney, netWorthOf, reachOf, xpForLevel } from '../../game/engine'
import {
  NOTIFICATION_REASONS,
  notificationPermission,
  notificationsSupported,
  requestNotificationPermission,
} from '../../lib/useNotifications'
import { GOOGLE_CLIENT_ID, mountGoogleButton } from '../../lib/google'
import { useGame } from '../../store/gameStore'
import AvatarStudio from './AvatarStudio'

function GoogleLink() {
  const citizen = useGame((s) => s.citizen)
  const cloudSyncedAt = useGame((s) => s.cloudSyncedAt)
  const linkGoogle = useGame((s) => s.linkGoogle)
  const buttonRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState('')

  const linked = Boolean(citizen?.googleSub)

  useEffect(() => {
    if (linked || !GOOGLE_CLIENT_ID || !buttonRef.current) return
    void mountGoogleButton(buttonRef.current, async (credential) => {
      const problem = await linkGoogle(credential)
      setError(problem ?? '')
    })
  }, [linked, linkGoogle])

  if (!GOOGLE_CLIENT_ID) {
    return (
      <p className="panel-sub">
        Google sign-in isn't enabled on this deployment yet. Your life is saved in this browser.
      </p>
    )
  }

  if (linked) {
    return (
      <div className="google-linked">
        {citizen?.googlePicture && <img className="google-avatar" src={citizen.googlePicture} alt="" width={36} height={36} referrerPolicy="no-referrer" />}
        <div>
          <p className="google-email">{citizen?.googleEmail}</p>
          <p className="google-status">
            Cloud save on{cloudSyncedAt ? ` · synced ${new Date(cloudSyncedAt).toLocaleTimeString()}` : ' · first sync pending'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="google-section">
      <p className="panel-sub">Link Google to back up your life and continue it on any device.</p>
      <div ref={buttonRef} />
      {error && <p className="waitlist-error" role="alert">{error}</p>}
    </div>
  )
}

export default function ProfilePanel() {
  const citizen = useGame((s) => s.citizen)
  const money = useGame((s) => s.money)
  const inventory = useGame((s) => s.inventory)
  const assets = useGame((s) => s.assets)
  const level = useGame((s) => s.level)
  const xp = useGame((s) => s.xp)
  const shiftsWorked = useGame((s) => s.shiftsWorked)
  const timesEaten = useGame((s) => s.timesEaten)
  const timesSlept = useGame((s) => s.timesSlept)
  const totalCollected = useGame((s) => s.totalCollected)
  const achievementsClaimed = useGame((s) => s.achievementsClaimed)
  const streakBest = useGame((s) => s.streakBest)
  const luckyMomentsSeen = useGame((s) => s.luckyMomentsSeen)

  if (!citizen) return null

  const netWorth = netWorthOf(money, inventory, assets)
  const dailyYield = assets.reduce((sum, a) => sum + a.incomePerDay, 0)
  const daysLived = dayOfLife(citizen.createdAt)
  const businesses = assets.filter((a) => a.kind === 'business').length
  const homes = assets.filter((a) => a.kind === 'home').length
  const pets = useGame.getState().pets.length

  const reach = reachOf(level, businesses, homes > 0, netWorth)
  const stats: { label: string; value: string }[] = [
    { label: 'reach', value: Number.isFinite(reach.km) ? `${reach.label} · ${reach.km} km` : reach.label },
    { label: 'net worth', value: formatMoney(netWorth) },
    { label: 'cash', value: formatMoney(money) },
    { label: 'portfolio yield', value: `${formatMoney(dailyYield)}/day` },
    { label: 'businesses', value: String(businesses) },
    { label: 'homes', value: String(homes) },
    { label: 'shifts worked', value: String(shiftsWorked) },
    { label: 'days lived', value: String(daysLived) },
    { label: 'citizen since', value: new Date(citizen.createdAt).toLocaleDateString() },
  ]

  return (
    <section className="panel" aria-label="Profile">
      <div className="profile-head">
        {citizen.avatarUrl ? (
          <img className="profile-avatar" src={citizen.avatarUrl} alt="" width={52} height={52} />
        ) : (
          <span className="profile-avatar profile-initial">{citizen.name.charAt(0).toUpperCase()}</span>
        )}
        <div className="profile-id">
          <h2 className="panel-title">{citizen.name}</h2>
          {citizen.founderNumber > 0 ? (
            <span className="founder-chip">Founder #{String(citizen.founderNumber).padStart(4, '0')}</span>
          ) : (
            <span className="founder-chip">{citizen.online === false ? 'Offline citizen' : 'Citizen'}</span>
          )}
        </div>
      </div>

      <h3 className="profile-section-title">Avatar studio</h3>
      <AvatarStudio />

      <div className="profile-level">
        <span className="stat-label">level {level} · {xp}/{xpForLevel(level)} xp</span>
        <div className="xp-track">
          <div className="xp-fill" style={{ width: `${Math.min(100, (xp / xpForLevel(level)) * 100)}%` }} />
        </div>
      </div>

      <dl className="profile-stats">
        {stats.map((s) => (
          <div className="profile-stat" key={s.label}>
            <dt className="stat-label">{s.label}</dt>
            <dd className="stat-value mono">{s.value}</dd>
          </div>
        ))}
      </dl>

      {/* Lifetime stats — the "your story so far" block. These counters give
          long-term players a sense of accumulation and are the fuel for the
          achievements + collection views. Every number here is a bragging
          right and a reason to keep playing. */}
      <h3 className="profile-section-title">Lifetime</h3>
      <dl className="profile-stats">
        <div className="profile-stat">
          <dt className="stat-label">meals eaten</dt>
          <dd className="stat-value mono">{timesEaten}</dd>
        </div>
        <div className="profile-stat">
          <dt className="stat-label">nights slept</dt>
          <dd className="stat-value mono">{timesSlept}</dd>
        </div>
        <div className="profile-stat">
          <dt className="stat-label">income collected</dt>
          <dd className="stat-value mono">{formatMoney(totalCollected)}</dd>
        </div>
        <div className="profile-stat">
          <dt className="stat-label">achievements</dt>
          <dd className="stat-value mono">{achievementsClaimed.length}</dd>
        </div>
        <div className="profile-stat">
          <dt className="stat-label">best streak</dt>
          <dd className="stat-value mono">{streakBest} days 🔥</dd>
        </div>
        <div className="profile-stat">
          <dt className="stat-label">lucky moments</dt>
          <dd className="stat-value mono">{luckyMomentsSeen} 🍀</dd>
        </div>
        {pets > 0 && (
          <div className="profile-stat">
            <dt className="stat-label">pets</dt>
            <dd className="stat-value mono">{pets}</dd>
          </div>
        )}
      </dl>

      <h3 className="profile-section-title">Account</h3>
      <GoogleLink />
      <NotificationsSection />
    </section>
  )
}

/**
 * The notifications opt-in. Web Notifications are the strongest retention
 * mechanic for a real-time life-sim — the game reaches out when the tab is
 * closed. We never auto-prompt (the pattern that made web notifications
 * hated); the player opts in here after reading exactly what they'll get.
 */
function NotificationsSection() {
  const [permission, setPermission] = useState<NotificationPermission | null>(notificationPermission())
  const supported = notificationsSupported()

  if (!supported) {
    return (
      <div className="notif-section">
        <h3 className="profile-section-title">Notifications</h3>
        <p className="panel-sub">
          Your browser doesn't support web notifications. Reality runs fine without them.
        </p>
      </div>
    )
  }

  if (permission === 'granted') {
    return (
      <div className="notif-section">
        <h3 className="profile-section-title">Notifications ✓ on</h3>
        <p className="panel-sub">
          Reality will notify you when the tab is hidden: {NOTIFICATION_REASONS[0].toLowerCase()}.
        </p>
      </div>
    )
  }

  if (permission === 'denied') {
    return (
      <div className="notif-section">
        <h3 className="profile-section-title">Notifications blocked</h3>
        <p className="panel-sub">
          You blocked notifications. Re-enable them in your browser's site settings if you change your mind.
        </p>
      </div>
    )
  }

  return (
    <div className="notif-section">
      <h3 className="profile-section-title">Notifications</h3>
      <p className="panel-sub">Let Reality reach you when it matters:</p>
      <ul className="notif-reasons">
        {NOTIFICATION_REASONS.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <button
        className="btn primary"
        onClick={async () => setPermission(await requestNotificationPermission())}
      >
        Enable notifications
      </button>
    </div>
  )
}
