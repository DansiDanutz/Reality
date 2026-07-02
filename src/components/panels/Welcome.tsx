import { useEffect, useState } from 'react'
import { FOUNDER_BALANCE, FOUNDER_SLOTS } from '../../game/catalog'
import { formatMoney } from '../../game/engine'
import { useGame } from '../../store/gameStore'

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
    return <p className="waitlist-done">✓ You're on the founder waitlist. We'll email you before the online launch.</p>
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
  const createCitizen = useGame((s) => s.createCitizen)

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
            if (name.trim().length >= 2) createCitizen(name)
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
        </form>
        <WaitlistForm />
        <p className="welcome-note">Beta: your world is saved in this browser. Online citizenship arrives with the server release.</p>
      </div>
    </div>
  )
}
