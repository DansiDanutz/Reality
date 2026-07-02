import { jobById } from '../../game/catalog'
import { useGame } from '../../store/gameStore'

export default function ActionDock() {
  const citizen = useGame((s) => s.citizen)
  const inventory = useGame((s) => s.inventory)
  const jobId = useGame((s) => s.jobId)
  const placing = useGame((s) => s.placing)
  const sleep = useGame((s) => s.sleep)
  const workShift = useGame((s) => s.workShift)
  const setPanel = useGame((s) => s.setPanel)
  const cancelPlacing = useGame((s) => s.cancelPlacing)
  const log = useGame((s) => s.log)

  if (!citizen) return null

  if (placing) {
    return (
      <div className="dock placing-banner">
        <span className="placing-pulse" />
        <span>Click anywhere on Earth to place your <strong>{placing.name}</strong></span>
        <button className="btn ghost" onClick={cancelPlacing}>Cancel &amp; refund</button>
      </div>
    )
  }

  const job = jobId ? jobById(jobId) : undefined
  const foodOwned = Object.entries(inventory).some(([, qty]) => qty > 0)

  return (
    <div className="dock">
      <div className="dock-actions">
        <button className="btn" onClick={() => setPanel('shop')} title={foodOwned ? 'Open your inventory in the shop' : 'Buy food first'}>
          Eat
        </button>
        <button className="btn" onClick={sleep} title="Sleep 7 hours">
          Sleep
        </button>
        <button className="btn primary" onClick={job ? workShift : () => setPanel('work')} title={job ? `6h shift as ${job.title}` : 'Find a job'}>
          {job ? `Work · ${job.title}` : 'Find a job'}
        </button>
      </div>
      {log[0] && <p className="dock-log" role="status">{log[0]}</p>}
    </div>
  )
}
