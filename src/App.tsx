import { Suspense, lazy, useEffect } from 'react'
import ActionDock from './components/hud/ActionDock'
import AvatarCard from './components/hud/AvatarCard'
import AwayReport from './components/hud/AwayReport'
import HudDock from './components/hud/HudDock'
import HudWindow from './components/hud/HudWindow'
import MoodCard from './components/hud/MoodCard'
import Toasts from './components/hud/Toasts'
import { TUTORIAL_STEPS } from './game/tutorial'
import NeedsPanel from './components/hud/NeedsPanel'
import TopBar from './components/hud/TopBar'
import TutorialPanel from './components/hud/TutorialPanel'
import Market from './components/market/Market'
import AssetsPanel from './components/panels/AssetsPanel'
import HealthGuide from './components/panels/HealthGuide'
import LeaderboardPanel from './components/panels/LeaderboardPanel'
import TargetsIntro from './components/panels/TargetsIntro'
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
  const targetsSeen = useGame((s) => s.targetsSeen)
  const tutorialDone = useGame((s) => s.tutorialClaimed.length >= TUTORIAL_STEPS.length)
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
      {citizen && !targetsSeen && <TargetsIntro />}
      {citizen && streetMode && (
        <Suspense fallback={<div className="street-overlay"><p className="street-loading">Lacing up…</p></div>}>
          <StreetMode />
        </Suspense>
      )}
      {citizen && (
        <>
          <TopBar />
          <Toasts />
          <AwayReport />
          {!tutorialDone && (
            <HudWindow id="objectives">
              <TutorialPanel />
            </HudWindow>
          )}
          <HudWindow id="citizen">
            <AvatarCard />
          </HudWindow>
          <HudWindow id="vitals">
            <NeedsPanel />
          </HudWindow>
          {!streetMode && (
            <HudWindow id="guide">
              <MoodCard />
            </HudWindow>
          )}
          <HudDock />
          <ActionDock />
          {panel === 'shop' && <Market />}
          {(panel === 'work' || panel === 'assets' || panel === 'top' || panel === 'profile' || panel === 'health') && (
            <div className="drawer">
              <button className="drawer-close" aria-label="Close panel" onClick={() => setPanel(null)}>×</button>
              {panel === 'work' && <WorkPanel />}
              {panel === 'assets' && <AssetsPanel />}
              {panel === 'top' && <LeaderboardPanel />}
              {panel === 'profile' && <ProfilePanel />}
              {panel === 'health' && <HealthGuide />}
            </div>
          )}
        </>
      )}
    </div>
  )
}
