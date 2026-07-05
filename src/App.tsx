import { Suspense, lazy, useEffect } from 'react'
import ActionDock from './components/hud/ActionDock'
import AvatarCard from './components/hud/AvatarCard'
import AwayReport from './components/hud/AwayReport'
import CelebrationOverlay from './components/hud/CelebrationOverlay'
import GoalsCard from './components/hud/GoalsCard'
import GoldenOpportunityPrompt from './components/hud/GoldenOpportunityPrompt'
import InstallBanner from './components/hud/InstallBanner'
import StarfieldBackground from './components/StarfieldBackground'
import HudDock from './components/hud/HudDock'
import OfflineBanner from './components/hud/OfflineBanner'
import FinanceCard from './components/hud/FinanceCard'
import HudWindow from './components/hud/HudWindow'
import MoodCard from './components/hud/MoodCard'
import Toasts from './components/hud/Toasts'
import { TUTORIAL_STEPS } from './game/tutorial'
import NeedsPanel from './components/hud/NeedsPanel'
import TopBar from './components/hud/TopBar'
import TutorialPanel from './components/hud/TutorialPanel'
import Market from './components/market/Market'
import AchievementsPanel from './components/panels/AchievementsPanel'
import AssetsPanel from './components/panels/AssetsPanel'
import HealthGuide from './components/panels/HealthGuide'
import JournalPanel from './components/panels/JournalPanel'
import KitchenPanel from './components/panels/KitchenPanel'
import LeaderboardPanel from './components/panels/LeaderboardPanel'
import MysteryBoxPanel from './components/panels/MysteryBoxPanel'
import TargetsIntro from './components/panels/TargetsIntro'
import ProfilePanel from './components/panels/ProfilePanel'
import Welcome from './components/panels/Welcome'
import WorkPanel from './components/panels/WorkPanel'
import { TICK_SECONDS } from './game/catalog'
import { useFocusTrap } from './lib/useFocusTrap'
import { useNotifications } from './lib/useNotifications'
import { useGame } from './store/gameStore'

// Human-readable dialog labels so screen readers announce the drawer's purpose.
const PANEL_LABELS: Record<string, string> = {
  work: 'Work',
  assets: 'Your assets',
  top: 'Leaderboard',
  profile: 'Profile',
  health: 'Health guide',
  cook: 'Kitchen',
  achievements: 'Achievements',
  journal: 'Your life so far',
  boxes: 'Mystery Boxes',
}

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

  const drawerOpen = panel === 'work' || panel === 'assets' || panel === 'top' || panel === 'profile' || panel === 'health' || panel === 'cook' || panel === 'achievements' || panel === 'journal' || panel === 'boxes'
  const drawerRef = useFocusTrap<HTMLDivElement>(drawerOpen)

  // Web notifications — fires system notifications when the tab is hidden
  // (activity done, streak at risk, needs critical). Only active after the
  // player explicitly enables it from the Profile panel.
  useNotifications()

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

  // Escape closes any open panel; single-key shortcuts fire the core actions
  // when the player isn't typing in an input. Power-user convenience that
  // makes the game feel responsive — the difference between a toy and a tool.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPanel(null)
        return
      }
      // Skip when the player is typing, using a modifier, or a dialog is open
      // (the action dock buttons are the canonical UI; shortcuts are a bonus).
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const s = useGame.getState()
      if (!s.citizen || drawerOpen || s.placing) return
      switch (e.key.toLowerCase()) {
        case 'd': s.quickDrink(); break
        case 's': s.startSleep(); break
        case 'w': s.startGig(); break
        case 'c': s.collectIncome(); break
        case 'g': s.setPanel('achievements'); break
        case 'j': s.setPanel('journal'); break
        case 'm': s.openMarket(); break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setPanel, drawerOpen])

  // A true modal dialog hides the rest of the app from assistive tech and
  // keyboard focus, not just visually — `inert` does both in one attribute.
  const dialogOpen = drawerOpen || panel === 'shop'

  return (
    <div className="app" id="main-content" role="main" tabIndex={-1}>
      <StarfieldBackground />
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <OfflineBanner />
      <div inert={dialogOpen || undefined} aria-hidden={dialogOpen || undefined}>
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
            <CelebrationOverlay />
            <GoldenOpportunityPrompt />
            <AwayReport />
            <InstallBanner />
            {!tutorialDone ? (
              <HudWindow id="objectives">
                <TutorialPanel />
              </HudWindow>
            ) : (
              <HudWindow id="objectives">
                <GoalsCard />
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
            <HudWindow id="finance">
              <FinanceCard />
            </HudWindow>
            <HudDock />
            <ActionDock />
          </>
        )}
      </div>
      {panel === 'shop' && <Market />}
      {drawerOpen && (
        <div className="drawer" ref={drawerRef} role="dialog" aria-modal="true" aria-label={PANEL_LABELS[panel] ?? 'Panel'}>
          <button className="drawer-close" aria-label="Close panel" onClick={() => setPanel(null)}>×</button>
          {panel === 'work' && <WorkPanel />}
          {panel === 'assets' && <AssetsPanel />}
          {panel === 'top' && <LeaderboardPanel />}
          {panel === 'profile' && <ProfilePanel />}
          {panel === 'health' && <HealthGuide />}
          {panel === 'cook' && <KitchenPanel />}
          {panel === 'achievements' && <AchievementsPanel />}
          {panel === 'journal' && <JournalPanel />}
          {panel === 'boxes' && <MysteryBoxPanel />}
        </div>
      )}
    </div>
  )
}
