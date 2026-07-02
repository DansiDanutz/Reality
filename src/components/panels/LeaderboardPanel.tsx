import { useEffect, useState } from 'react'
import { formatMoney, netWorthOf } from '../../game/engine'
import { useGame } from '../../store/gameStore'

interface Row {
  name: string
  netWorth: number
}

export default function LeaderboardPanel() {
  const citizen = useGame((s) => s.citizen)
  const money = useGame((s) => s.money)
  const inventory = useGame((s) => s.inventory)
  const assets = useGame((s) => s.assets)
  const reportScore = useGame((s) => s.reportScore)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [citizens, setCitizens] = useState(0)

  useEffect(() => {
    void reportScore().then(() =>
      fetch('/api/leaderboard')
        .then((r) => r.json())
        .then((d: { ok: boolean; top: Row[]; citizens: number }) => {
          if (d.ok) {
            setRows(d.top)
            setCitizens(d.citizens)
          } else setRows([])
        })
        .catch(() => setRows([])),
    )
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

      {rows === null && <p className="panel-sub">Reaching the world…</p>}
      {rows !== null && rows.length === 0 && (
        <p className="panel-sub">The leaderboard is empty or unreachable — you might be playing offline.</p>
      )}
      {rows !== null && rows.length > 0 && (
        <ol className="lb-list">
          {rows.map((row, i) => (
            <li key={`${row.name}-${i}`} className={`lb-row${row.name === myName ? ' me' : ''}`}>
              <span className="lb-rank mono">{i + 1}</span>
              <span className="lb-name">{row.name}</span>
              <span className="lb-worth mono">{formatMoney(row.netWorth)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
