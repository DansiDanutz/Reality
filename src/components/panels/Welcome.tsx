import { useState } from 'react'
import { FOUNDER_BALANCE, FOUNDER_SLOTS } from '../../game/catalog'
import { formatMoney } from '../../game/engine'
import { useGame } from '../../store/gameStore'

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
        <p className="welcome-note">Beta: your world is saved in this browser. Online citizenship arrives with the server release.</p>
      </div>
    </div>
  )
}
