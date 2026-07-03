import { Suspense, lazy, useEffect } from 'react'
import ActionDock from './components/hud/ActionDock'
import AvatarCard from './components/hud/AvatarCard'
import NeedsPanel from './components/hud/NeedsPanel'
import TopBar from './components/hud/TopBar'
import TutorialPanel from './components/hud/TutorialPanel'
import Market from './components/market/Market'
import AssetsPanel from './components/panels/AssetsPanel'
import LeaderboardPanel from './components/panels/LeaderboardPanel'
import ProfilePanel from './components/panels/ProfilePanel'
import Welcome from './components/panels/Welcome'
import WorkPanel from './components/panels/WorkPanel'
import { TICK_SECONDS } from './game/catalog'
import { useGame } from './store/gameStore'

// MapLibre is heavy — split it out so the shell paints instantly
const WorldMap = lazy(() => import('./components/map/WorldMap'))
const StreetMode = lazy(() => import('./components/street/StreetMode'))

export default function App() {
  const citizen = useGame((s) => s.citizen)
  const panel = useGame((s) => s.panel)
  const streetMode = useGame((s) => s.streetMode)
  const setPanel = useGame((s) => s.setPanel)

  // The heartbeat of the world: one tick per real second. The first tick
  // after load also settles everything that happened while you were away —
  // one simulation path, real time in and out of the app.
  useEffect(() => {
    useGame.getState().tick()
    void useGame.getState().registerOnline()
    void useGame.getState().ensureSpawn()
    const tickId = setInterval(() => useGame.getState().tick(), TICK_SECONDS * 1000)
    const scoreId = setInterval(() => {
      void useGame.getState().reportScore()
      void useGame.getState().pushCloudSave()
    }, 120_000)
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
        <WorldMap />
      </Suspense>
      {!citizen && <Welcome />}
      {citizen && streetMode && (
        <Suspense fallback={<div className="street-overlay"><p className="street-loading">Lacing up…</p></div>}>
          <StreetMode />
        </Suspense>
      )}
      {citizen && (
        <>
          <TopBar />
          <div className="left-rail">
            <TutorialPanel />
            <AvatarCard />
          </div>
          <NeedsPanel />
          <ActionDock />
          {panel === 'shop' && <Market />}
          {(panel === 'work' || panel === 'assets' || panel === 'top' || panel === 'profile') && (
            <div className="drawer">
              <button className="drawer-close" aria-label="Close panel" onClick={() => setPanel(null)}>×</button>
              {panel === 'work' && <WorkPanel />}
              {panel === 'assets' && <AssetsPanel />}
              {panel === 'top' && <LeaderboardPanel />}
              {panel === 'profile' && <ProfilePanel />}
            </div>
          )}
        </>
      )}
    </div>
  )
}
