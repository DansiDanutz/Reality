import { useEffect, useState } from 'react'
import { formatMoney, netWorthOf } from '../../game/engine'
import { useGame } from '../../store/gameStore'

interface Row {
  citizenId: string
  name: string
  netWorth: number
}

type LoadState = 'loading' | 'loaded' | 'offline'

export default function LeaderboardPanel() {
  const citizen = useGame((s) => s.citizen)
  const money = useGame((s) => s.money)
  const inventory = useGame((s) => s.inventory)
  const assets = useGame((s) => s.assets)
  const reportScore = useGame((s) => s.reportScore)
  const [state, setState] = useState<LoadState>('loading')
  const [rows, setRows] = useState<Row[]>([])
  const [citizens, setCitizens] = useState(0)

  useEffect(() => {
    let cancelled = false
    void reportScore().then(() =>
      fetch('/api/leaderboard')
        .then((r) => r.json())
        .then((d: { ok: boolean; top: Row[]; citizens: number }) => {
          if (cancelled) return
          if (d.ok) {
            setRows(d.top)
            setCitizens(d.citizens)
            setState('loaded')
            useGame.getState().markApiOk()
          } else {
            setState('loaded')
          }
        })
        .catch(() => {
          if (cancelled) return
          setState('offline')
          useGame.getState().markApiOffline()
        }),
    )
    return () => {
      cancelled = true
    }
  }, [reportScore])

  const myWorth = netWorthOf(money, inventory, assets)
  const myName = citizen?.name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '')

  return (
    <section className="panel" aria-label="Leaderboard">
      <h2 className="panel-title">Richest citizens</h2>
      <p className="panel-sub">
        Net worth across the whole world{citizens > 0 && ` · ${citizens} citizens online`}. Your net worth:{' '}
        <strong className="gold">{formatMoney(myWorth)}</strong>
      </p>

      {state === 'loading' && (
        <ul className="lb-list" aria-label="Loading leaderboard" aria-busy="true">
          {Array.from({ length: 5 }, (_, i) => (
            <li key={i} className="lb-row lb-skeleton" aria-hidden>
              <span className="lb-rank mono">{i + 1}</span>
              <span className="lb-avatar" />
              <span className="lb-name" />
              <span className="lb-worth mono" />
            </li>
          ))}
        </ul>
      )}
      {state === 'offline' && (
        <p className="panel-sub">
          Can’t reach the world right now — showing your net worth locally. The leaderboard will reload when your
          connection returns.
        </p>
      )}
      {state === 'loaded' && rows.length === 0 && (
        <p className="panel-sub">No citizens ranked yet. Be the first — your net worth is recorded automatically.</p>
      )}
      {state === 'loaded' && rows.length > 0 && (
        <ol className="lb-list">
          {rows.map((row, i) => (
            <li key={row.citizenId} className={`lb-row${row.name === myName ? ' me' : ''}`}>
              <span className="lb-rank mono">{i + 1}</span>
              <span className="lb-avatar" aria-hidden>
                <span className="lb-avatar-initial">{row.name.charAt(0).toUpperCase()}</span>
                <img
                  className="lb-avatar-img"
                  src={`/api/avatar?cid=${row.citizenId}`}
                  alt=""
                  loading="lazy"
                  width={28}
                  height={28}
                  onError={(e) => {
                    // No avatar (404) → hide the img so the initial behind it shows.
                    (e.target as HTMLImageElement).style.visibility = 'hidden'
                  }}
                />
              </span>
              <span className="lb-name">{row.name}</span>
              <span className="lb-worth mono">{formatMoney(row.netWorth)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
