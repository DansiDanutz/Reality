import { Suspense, lazy, useEffect } from 'react'
import ActionDock from './components/hud/ActionDock'
import NeedsPanel from './components/hud/NeedsPanel'
import TopBar from './components/hud/TopBar'
import TutorialPanel from './components/hud/TutorialPanel'
import Market from './components/market/Market'
import AssetsPanel from './components/panels/AssetsPanel'
import LeaderboardPanel from './components/panels/LeaderboardPanel'
import Welcome from './components/panels/Welcome'
import WorkPanel from './components/panels/WorkPanel'
import { TICK_SECONDS } from './game/catalog'
import { useGame } from './store/gameStore'

// Three.js + the globe are ~600 kB gzipped — split them out so the shell paints instantly
const GlobeView = lazy(() => import('./components/globe/GlobeView'))

export default function App() {
  const citizen = useGame((s) => s.citizen)
  const panel = useGame((s) => s.panel)
  const setPanel = useGame((s) => s.setPanel)

  // The heartbeat of the world: one tick per real second.
  // On load: pay out offline earnings, connect to the live world (also
  // migrates pre-online saves), and report net worth every two minutes.
  useEffect(() => {
    useGame.getState().applyOfflineEarnings()
    void useGame.getState().registerOnline()
    const tickId = setInterval(() => useGame.getState().tick(), TICK_SECONDS * 1000)
    const scoreId = setInterval(() => void useGame.getState().reportScore(), 120_000)
    return () => {
      clearInterval(tickId)
      clearInterval(scoreId)
    }
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
      <Suspense fallback={<div className="globe-loading" aria-hidden />}>
        <GlobeView />
      </Suspense>
      {!citizen && <Welcome />}
      {citizen && (
        <>
          <TopBar />
          <TutorialPanel />
          <NeedsPanel />
          <ActionDock />
          {panel === 'shop' && <Market />}
          {(panel === 'work' || panel === 'assets' || panel === 'top') && (
            <div className="drawer">
              <button className="drawer-close" aria-label="Close panel" onClick={() => setPanel(null)}>×</button>
              {panel === 'work' && <WorkPanel />}
              {panel === 'assets' && <AssetsPanel />}
              {panel === 'top' && <LeaderboardPanel />}
            </div>
          )}
        </>
      )}
    </div>
  )
}
