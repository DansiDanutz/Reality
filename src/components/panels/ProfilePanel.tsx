import { useEffect, useRef, useState } from 'react'
import { dayOfLife } from '../../game/clock'
import { formatMoney, netWorthOf, reachOf, xpForLevel } from '../../game/engine'
import { BOOSTERS, BOOSTER_LIST, boosterRemaining, isBoosterActive } from '../../game/boosters'
import type { Citizen } from '../../game/types'
import {
  NOTIFICATION_REASONS,
  notificationPermission,
  notificationsSupported,
  requestNotificationPermission,
} from '../../lib/useNotifications'
import { GOOGLE_CLIENT_ID, mountGoogleButton } from '../../lib/google'
import { useGame } from '../../store/gameStore'
import AvatarStudio from './AvatarStudio'

/**
 * The citizen's real hometown, with a re-detect action. IP databases are
 * coarse (VPNs, mobile carriers) — a player mislocated at creation can fix
 * their spawn here instead of living in the wrong city forever.
 */
function HometownRow() {
  const citizen = useGame((s) => s.citizen)
  const redetectSpawn = useGame((s) => s.redetectSpawn)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!citizen) return null
  const label = citizen.homeCity
    ? `${citizen.homeCity}${citizen.homeCountry ? `, ${citizen.homeCountry}` : ''}`
    : 'not detected yet'

  return (
    <div className="profile-hometown">
      <span className="stat-label">hometown · {label}</span>
      <button
        className="btn small ghost"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          setError('')
          const problem = await redetectSpawn()
          if (problem) setError(problem)
          setBusy(false)
        }}
      >
        {busy ? 'Detecting…' : 'Re-detect'}
      </button>
      {error && <p className="waitlist-error" role="alert">{error}</p>}
    </div>
  )
}

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

function TelegramLinkStatus() {
  const citizen = useGame((s) => s.citizen)
  const telegramLinkError = useGame((s) => s.telegramLinkError)
  return <TelegramLinkStatusContent citizen={citizen} telegramLinkError={telegramLinkError} />
}

export function TelegramLinkStatusContent({
  citizen,
  telegramLinkError,
}: {
  citizen: Pick<Citizen, 'telegramUserId' | 'telegramUsername' | 'telegramName' | 'telegramAccountId' | 'telegramLinkedAt'> | null
  telegramLinkError: string | null
}) {
  if (!citizen?.telegramUserId) {
    return (
      <>
        {telegramLinkError && <p className="waitlist-error" role="alert">{telegramLinkError}</p>}
        <p className="panel-sub">
          Telegram Mini App sign-in will link automatically when Reality opens inside Telegram.
        </p>
      </>
    )
  }

  const label = citizen.telegramUsername ? `@${citizen.telegramUsername}` : citizen.telegramName ?? citizen.telegramUserId
  return (
    <div className="google-linked">
      <div>
        <p className="google-email">Telegram linked · {label}</p>
        <p className="google-status">
          Account {citizen.telegramAccountId}
          {citizen.telegramLinkedAt ? ` · verified ${new Date(citizen.telegramLinkedAt).toLocaleTimeString()}` : ''}
        </p>
      </div>
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

      <HometownRow />

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

      <button
        className="btn ghost journal-cta"
        onClick={() => useGame.getState().setPanel('journal')}
      >
        📖 Read your life journal
      </button>

      <h3 className="profile-section-title">Boosters</h3>
      <BoosterSection />

      <h3 className="profile-section-title">Sound</h3>
      <SoundSection />

      <h3 className="profile-section-title">Savings goal</h3>
      <SavingsGoalSection netWorth={netWorth} />

      <h3 className="profile-section-title">Keyboard shortcuts</h3>
      <ShortcutsSection />

      <h3 className="profile-section-title">Account</h3>
      <TelegramLinkStatus />
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
        <p className="panel-sub">Choose what reaches you when the tab is hidden:</p>
        <NotifToggle type="activity" label="Activity finished" hint="Shift, sleep, or meal done" />
        <NotifToggle type="streak" label="Streak at risk" hint="Before midnight if unclaimed" />
        <NotifToggle type="needs" label="Needs critical" hint="Starving, dehydrated, exhausted" />
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

/**
 * A single per-type notification toggle. Lets the player keep the
 * retention-critical streak alert while muting a naggy type (e.g. needs-
 * critical firing every 30 min). Defaults to on for all three.
 */
function NotifToggle({
  type,
  label,
  hint,
}: {
  type: 'activity' | 'streak' | 'needs'
  label: string
  hint: string
}) {
  const on = useGame((s) => s.notificationPrefs[type])
  const setNotificationPref = useGame((s) => s.setNotificationPref)
  return (
    <label className="notif-toggle">
      <span className="notif-toggle-text">
        <span className="notif-toggle-label">{label}</span>
        <span className="notif-toggle-hint">{hint}</span>
      </span>
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => setNotificationPref(type, e.target.checked)}
        aria-label={`${label} notifications ${on ? 'on' : 'off'}`}
      />
    </label>
  )
}

/**
 * The keyboard shortcuts reference. Discoverability for the power-user
 * shortcuts (critique batch-3 item #5) — without this they're hidden behind
 * hover titles. Listed here so a curious player finds them in the natural
 * "settings" home.
 */
const SHORTCUTS: ReadonlyArray<readonly [string, string]> = [
  ['D', 'Drink $1 (hydrate)'],
  ['S', 'Sleep (start sleep activity)'],
  ['W', 'Work (start a gig)'],
  ['C', 'Collect business income'],
  ['M', 'Open the Market'],
  ['G', 'Open Goals (achievements)'],
  ['J', 'Open your life journal'],
  ['Esc', 'Close any open panel'],
] as const

function ShortcutsSection() {
  return (
    <dl className="shortcuts-list">
      {SHORTCUTS.map(([key, action]) => (
        <div className="shortcut-row" key={key}>
          <dt><kbd className="shortcut-key">{key}</kbd></dt>
          <dd>{action}</dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * Sound settings — the master mute (mirrors the TopBar toggle) plus a volume
 * slider. A top game lets players set chime volume independent of system.
 */
function SoundSection() {
  const soundOn = useGame((s) => s.soundOn)
  const toggleSound = useGame((s) => s.toggleSound)
  const volume = useGame((s) => s.soundVolume)
  const setSoundVolume = useGame((s) => s.setSoundVolume)
  return (
    <div className="sound-section">
      <label className="notif-toggle">
        <span className="notif-toggle-text">
          <span className="notif-toggle-label">Sound</span>
          <span className="notif-toggle-hint">Chimes for rewards, levels, and events</span>
        </span>
        <input
          type="checkbox"
          checked={soundOn}
          onChange={toggleSound}
          aria-label={`Sound ${soundOn ? 'on' : 'off'}`}
        />
      </label>
      {soundOn && (
        <label className="sound-volume">
          <span className="sound-volume-label">Volume</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => setSoundVolume(parseFloat(e.target.value))}
            aria-label={`Sound volume ${Math.round(volume * 100)} percent`}
          />
          <span className="sound-volume-value mono">{Math.round(volume * 100)}%</span>
        </label>
      )}
    </div>
  )
}

/**
 * The savings goal — a player-set cash target with a live progress bar.
 * Gives purpose to the earning loop: instead of "money goes up", the
 * player has "I'm 60% of the way to the $50k studio". Quick-set buttons
 * for common targets; the celebration fires from the tick when reached.
 */
const SAVINGS_PRESETS = [5_000, 25_000, 100_000, 500_000] as const

function SavingsGoalSection({ netWorth }: { netWorth: number }) {
  const goal = useGame((s) => s.savingsGoal)
  const reached = useGame((s) => s.savingsGoalReached)
  const setSavingsGoal = useGame((s) => s.setSavingsGoal)
  const pct = goal > 0 ? Math.min(100, Math.round((netWorth / goal) * 100)) : 0

  if (reached) {
    return (
      <div className="savings-goal">
        <p className="savings-reached">🎯 Goal reached — {formatMoney(goal)}!</p>
        <button className="btn small ghost" onClick={() => setSavingsGoal(0)}>
          Clear goal
        </button>
        <button className="btn small primary" onClick={() => setSavingsGoal(goal)}>
          Set a new goal
        </button>
      </div>
    )
  }

  if (goal === 0) {
    return (
      <div className="savings-goal">
        <p className="panel-sub">Set a target to work toward. Quick picks:</p>
        <div className="savings-presets">
          {SAVINGS_PRESETS.map((amt) => (
            <button key={amt} className="btn small ghost" onClick={() => setSavingsGoal(amt)}>
              {formatMoney(amt)}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="savings-goal">
      <div className="savings-head">
        <span className="savings-label">Saving for {formatMoney(goal)}</span>
        <button className="btn small ghost savings-clear" onClick={() => setSavingsGoal(0)} aria-label="Clear savings goal">
          ×
        </button>
      </div>
      <div className="savings-bar" aria-label={`Savings progress: ${formatMoney(netWorth)} of ${formatMoney(goal)}`}>
        <div className="savings-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="savings-progress mono">
        {formatMoney(netWorth)} / {formatMoney(goal)} · {pct}%
      </span>
    </div>
  )
}

/**
 * Boosters — temporary 2x multipliers the player buys. Cash sink + session
 * extension ("I have 2x wages, I need to start a shift NOW").
 */
function BoosterSection() {
  const money = useGame((s) => s.money)
  const activeBoosters = useGame((s) => s.activeBoosters)
  const buyBooster = useGame((s) => s.buyBooster)
  const lastSeenAt = useGame((s) => s.lastSeenAt) // re-render each tick for countdown
  void lastSeenAt

  return (
    <div className="booster-grid">
      {BOOSTER_LIST.map((type) => {
        const def = BOOSTERS[type]
        const active = isBoosterActive(activeBoosters, type)
        const remaining = boosterRemaining(activeBoosters, type)
        const mins = Math.ceil(remaining / 60_000)
        const affordable = money >= def.cost
        return (
          <button
            key={type}
            className={`booster-card${active ? ' active' : ''}${!affordable && !active ? ' locked' : ''}`}
            disabled={!affordable || active}
            onClick={() => buyBooster(type)}
          >
            <span className="booster-emoji" aria-hidden>{def.emoji}</span>
            <div className="booster-info">
              <span className="booster-name">{def.name}</span>
              {active ? (
                <span className="booster-timer mono">{mins}m left</span>
              ) : (
                <span className="booster-desc">{def.description}</span>
              )}
            </div>
            {!active && <span className="booster-price mono">{formatMoney(def.cost)}</span>}
          </button>
        )
      })}
    </div>
  )
}
