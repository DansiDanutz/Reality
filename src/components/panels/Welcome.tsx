import { useEffect, useRef, useState } from 'react'
import { FOUNDER_BALANCE, FOUNDER_SLOTS } from '../../game/catalog'
import { formatMoney } from '../../game/engine'
import { track } from '../../lib/analytics'
import { detectLocation, type SpawnLocation } from '../../lib/geo'
import { GOOGLE_CLIENT_ID, mountGoogleButton } from '../../lib/google'
import { useGame } from '../../store/gameStore'

/** Continue an existing life from a Google-linked cloud save */
function GoogleRestore() {
  const buttonRef = useRef<HTMLDivElement>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !buttonRef.current) return
    void mountGoogleButton(buttonRef.current, async (credential) => {
      setMessage('Looking up your life…')
      try {
        const res = await fetch('/api/auth-google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential }),
        })
        const d = (await res.json()) as { ok: boolean; save?: string | null; error?: string }
        if (d.ok && d.save) {
          localStorage.setItem('reality-save-v1', d.save)
          location.reload()
        } else if (d.ok) {
          setMessage('No saved life on this Google account yet — create your citizen above, then link Google in your Profile.')
        } else {
          setMessage(d.error ?? 'Sign-in failed. Try again.')
        }
      } catch {
        setMessage('Could not reach the server. Try again.')
      }
    })
  }, [])

  if (!GOOGLE_CLIENT_ID) return null
  return (
    <div className="welcome-google">
      <p className="welcome-or">already a citizen on another device?</p>
      <div className="welcome-google-btn" ref={buttonRef} />
      {message && <p className="welcome-note" role="status">{message}</p>}
    </div>
  )
}

const WAITLIST_KEY = 'reality-waitlist-joined'

function WaitlistForm() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>(
    localStorage.getItem(WAITLIST_KEY) ? 'done' : 'idle',
  )
  const [error, setError] = useState('')
  const [count, setCount] = useState(0)

  useEffect(() => {
    fetch('/api/waitlist')
      .then((r) => r.json())
      .then((d: { count?: number }) => setCount(d.count ?? 0))
      .catch(() => {})
  }, [])

  if (state === 'done') {
    return <p className="waitlist-done">✓ You're on the founder waitlist. Your signup is counted for launch review.</p>
  }

  return (
    <form
      className="waitlist"
      onSubmit={async (e) => {
        e.preventDefault()
        setState('busy')
        setError('')
        try {
          const res = await fetch('/api/waitlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          })
          const data = (await res.json()) as { ok: boolean; error?: string }
          if (data.ok) {
            localStorage.setItem(WAITLIST_KEY, '1')
            setState('done')
          } else {
            setError(data.error ?? 'Something went wrong. Try again.')
            setState('error')
          }
        } catch {
          setError('Could not reach the waitlist server. Check your connection and try again.')
          setState('error')
        }
      }}
    >
      <p className="waitlist-pitch">
        Founder slots go live with the online release — first come, first served.
        {count >= 10 && <strong> {count.toLocaleString()} already waiting.</strong>}
      </p>
      <div className="welcome-row">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          aria-label="Email for the founder waitlist"
          required
        />
        {/* Honeypot — hidden from humans, catnip for bots */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hp" />
        <button className="btn small" type="submit" disabled={state === 'busy'}>
          {state === 'busy' ? 'Joining…' : 'Join waitlist'}
        </button>
      </div>
      {error && <p className="waitlist-error" role="alert">{error}</p>}
    </form>
  )
}

export default function Welcome() {
  const [name, setName] = useState('')
  const [slotsClaimed, setSlotsClaimed] = useState<number | null>(null)
  const [spawn, setSpawn] = useState<SpawnLocation | null>(null)
  const createCitizen = useGame((s) => s.createCitizen)

  // Rule #1: your life starts in your own town
  useEffect(() => {
    track('welcome_seen')
    void detectLocation().then((s) => {
      setSpawn(s)
      if (s) track('spawn_detected')
    })
  }, [])

  useEffect(() => {
    fetch('/api/world')
      .then((r) => r.json())
      .then((d: { stats?: { founders?: number } }) => setSlotsClaimed(d.stats?.founders ?? null))
      .catch(() => {})
  }, [])

  return (
    <div className="welcome-backdrop">
      <div className="welcome">
        <p className="welcome-eyebrow">A second Earth. One economy. Real rules.</p>
        <h1 className="welcome-title">REALITY</h1>
        <p className="welcome-body">
          Eat. Sleep. Work. Build. Every citizen starts with nothing but time — except the first{' '}
          {FOUNDER_SLOTS.toLocaleString()} founders, who receive{' '}
          <strong className="gold">{formatMoney(FOUNDER_BALANCE)}</strong> to start the world's economy.
          Buy businesses, place them anywhere on the planet, and get paid while you live your life.
        </p>
        <form
          className="welcome-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (name.trim().length >= 2) createCitizen(name, spawn)
          }}
        >
          <label className="welcome-label" htmlFor="citizen-name">Citizen name</label>
          <div className="welcome-row">
            <input
              id="citizen-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="What should Earth call you?"
              maxLength={24}
              autoFocus
            />
            <button className="btn primary" type="submit" disabled={name.trim().length < 2}>
              Claim founder slot
            </button>
          </div>
          {spawn?.city && (
            <p className="welcome-spawn mono">
              📍 Your life begins in {spawn.city}{spawn.country ? `, ${spawn.country}` : ''} — your real city, your real time.
            </p>
          )}
          {slotsClaimed !== null && (
            <p className="welcome-slots mono">
              {Math.max(0, FOUNDER_SLOTS - slotsClaimed).toLocaleString()} of {FOUNDER_SLOTS.toLocaleString()} founder slots left
            </p>
          )}
        </form>
        <GoogleRestore />
        <WaitlistForm />
        <p className="welcome-note">Beta: your world is saved in this browser — link Google in your Profile to back it up.</p>
      </div>
    </div>
  )
}
