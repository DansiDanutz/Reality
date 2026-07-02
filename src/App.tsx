import { useEffect } from 'react'
import GlobeView from './components/globe/GlobeView'
import ActionDock from './components/hud/ActionDock'
import NeedsPanel from './components/hud/NeedsPanel'
import TopBar from './components/hud/TopBar'
import AssetsPanel from './components/panels/AssetsPanel'
import ShopPanel from './components/panels/ShopPanel'
import Welcome from './components/panels/Welcome'
import WorkPanel from './components/panels/WorkPanel'
import { TICK_SECONDS } from './game/catalog'
import { useGame } from './store/gameStore'

export default function App() {
  const citizen = useGame((s) => s.citizen)
  const panel = useGame((s) => s.panel)
  const setPanel = useGame((s) => s.setPanel)

  // The heartbeat of the world: one tick per real second
  useEffect(() => {
    const id = setInterval(() => useGame.getState().tick(), TICK_SECONDS * 1000)
    return () => clearInterval(id)
  }, [])

  // Escape closes any open panel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPanel(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setPanel])

  return (
    <div className="app">
      <GlobeView />
      {!citizen && <Welcome />}
      {citizen && (
        <>
          <TopBar />
          <NeedsPanel />
          <ActionDock />
          {panel && (
            <div className="drawer">
              <button className="drawer-close" aria-label="Close panel" onClick={() => setPanel(null)}>×</button>
              {panel === 'shop' && <ShopPanel />}
              {panel === 'work' && <WorkPanel />}
              {panel === 'assets' && <AssetsPanel />}
            </div>
          )}
        </>
      )}
    </div>
  )
}
