import { useEffect, useState } from 'react'
import { newlyUnlocked } from '../../game/achievements'
import { TUTORIAL_STEPS } from '../../game/tutorial'
import type { NeedKey } from '../../game/types'
import { useFocusTrap } from '../../lib/useFocusTrap'
import { achievementSnapshotOf, useGame, type PanelId } from '../../store/gameStore'
import AvatarCard from './AvatarCard'
import FinanceCard from './FinanceCard'
import GoalsCard from './GoalsCard'
import MoodCard from './MoodCard'
import NeedsPanel from './NeedsPanel'
import PathCard from './PathCard'
import TutorialPanel from './TutorialPanel'

/**
 * The phone shell. Desktop gets five draggable HUD windows; a phone gets
 * exactly three fixed pieces, so nothing ever overlaps:
 *
 *   - a slim vitals strip under the top bar (always-visible health at a glance)
 *   - the action dock (rendered by App, sits above the tab bar)
 *   - a five-tab bottom bar: Today · Status · Shop · Work · Menu
 *
 * Everything else opens as ONE bottom sheet at a time. Tapping the active
 * tab (or the backdrop) closes it — the map is always one tap away.
 */

type SheetId = 'today' | 'status' | 'menu'

const SHEET_TITLES: Record<SheetId, string> = {
  today: 'Today',
  status: 'Your citizen',
  menu: 'Menu',
}

const NEED_META: { key: NeedKey; icon: string; label: string }[] = [
  { key: 'hydration', icon: '💧', label: 'Water' },
  { key: 'hunger', icon: '🍗', label: 'Food' },
  { key: 'energy', icon: '⚡', label: 'Energy' },
  { key: 'hygiene', icon: '🧼', label: 'Hygiene' },
  { key: 'fun', icon: '🎈', label: 'Fun' },
]

// Every game area reachable from the desktop top bar, grouped the way a
// player thinks (empire → progress → daily life → settings), one thumb-sized
// row each. Shop and Work have their own tabs, so they're not repeated here.
interface MenuItem {
  id: Exclude<PanelId, null>
  icon: string
  label: string
  hint: string
}

const MENU_SECTIONS: { title: string; items: MenuItem[] }[] = [
  {
    title: 'Start here',
    items: [
      { id: 'handbook', icon: '🧭', label: 'How to play', hint: 'Rules, map legend, and your path' },
    ],
  },
  {
    title: 'Your empire',
    items: [
      { id: 'assets', icon: '🏠', label: 'Assets', hint: 'Your land, homes and businesses' },
      { id: 'construction', icon: '🏗️', label: 'Build', hint: 'Construction projects' },
      { id: 'founder', icon: '🗺️', label: 'Founder area', hint: 'Your claimed territory' },
      { id: 'operator', icon: '🛠️', label: 'Founder ops', hint: 'Operator tools' },
    ],
  },
  {
    title: 'Progress',
    items: [
      { id: 'achievements', icon: '🏆', label: 'Goals & achievements', hint: 'Daily challenges and trophies' },
      { id: 'journal', icon: '📖', label: 'Journal', hint: 'Your life so far' },
      { id: 'top', icon: '🥇', label: 'Leaderboard', hint: 'Top citizens worldwide' },
      { id: 'boxes', icon: '🎁', label: 'Mystery boxes', hint: 'Try your luck' },
    ],
  },
  {
    title: 'Daily life',
    items: [
      { id: 'cook', icon: '🍳', label: 'Kitchen', hint: 'Cook groceries into meals' },
      { id: 'health', icon: '⚕️', label: 'Health guide', hint: 'How vitals work' },
    ],
  },
  {
    title: 'Settings',
    items: [{ id: 'profile', icon: '👤', label: 'Profile', hint: 'Avatar, save and settings' }],
  },
]

const tone = (v: number) => (v < 20 ? 'crit' : v < 45 ? 'low' : 'ok')

export default function MobileHud() {
  const [sheet, setSheet] = useState<SheetId | null>(null)
  const citizen = useGame((s) => s.citizen)
  const panel = useGame((s) => s.panel)
  const needs = useGame((s) => s.needs)
  const health = useGame((s) => s.health)
  const illness = useGame((s) => s.illness)
  const soundOn = useGame((s) => s.soundOn)
  const toggleSound = useGame((s) => s.toggleSound)
  const achievementsClaimed = useGame((s) => s.achievementsClaimed)
  const tutorialDone = useGame((s) => s.tutorialClaimed.length >= TUTORIAL_STEPS.length)
  const setPanel = useGame((s) => s.setPanel)
  const openMarket = useGame((s) => s.openMarket)
  const sheetRef = useFocusTrap<HTMLDivElement>(sheet !== null)

  // A panel (drawer/market) opening replaces the sheet — one surface at a time.
  useEffect(() => {
    if (panel) setSheet(null)
  }, [panel])

  // Escape closes the sheet (parity with the drawer's Escape in App.tsx).
  useEffect(() => {
    if (!sheet) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSheet(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sheet])

  if (!citizen) return null

  const readyCount = newlyUnlocked(achievementSnapshotOf(useGame.getState()), achievementsClaimed).length
  const vitalsAlert = health < 30 || !!illness || NEED_META.some(({ key }) => needs[key] < 20)

  const toggleSheet = (id: SheetId) => {
    setPanel(null)
    setSheet((current) => (current === id ? null : id))
  }
  const openPanel = (id: Exclude<PanelId, null>) => {
    setSheet(null)
    setPanel(panel === id ? null : id)
  }
  const openShop = () => {
    setSheet(null)
    if (panel === 'shop') setPanel(null)
    else openMarket()
  }

  const tabs = [
    {
      id: 'today',
      icon: '📋',
      label: 'Today',
      active: sheet === 'today',
      dot: false,
      onTap: () => toggleSheet('today'),
    },
    {
      id: 'status',
      icon: '❤️',
      label: 'Status',
      active: sheet === 'status',
      dot: vitalsAlert,
      onTap: () => toggleSheet('status'),
    },
    {
      id: 'shop',
      icon: '🛒',
      label: 'Shop',
      active: panel === 'shop',
      dot: false,
      onTap: openShop,
    },
    {
      id: 'work',
      icon: '💼',
      label: 'Work',
      active: panel === 'work',
      dot: false,
      onTap: () => openPanel('work'),
    },
    {
      id: 'menu',
      icon: '☰',
      label: 'Menu',
      active: sheet === 'menu',
      dot: readyCount > 0,
      onTap: () => toggleSheet('menu'),
    },
  ] as const

  return (
    <>
      {/* Vitals strip — always-on health at a glance, right under the top bar.
          Tapping it opens the full Status sheet. */}
      <button
        type="button"
        className="mvitals"
        onClick={() => toggleSheet('status')}
        aria-label={`Health ${Math.round(health)} of 100${illness ? `, sick with ${illness.kind}` : ''}. ${NEED_META.map(({ key, label }) => `${label} ${Math.round(needs[key])}`).join(', ')}. Open status.`}
      >
        <span className={`mvitals-hp mono ${tone(health)}`}>
          ❤️ {Math.round(health)}
        </span>
        {illness && (
          <span className="mvitals-ill" aria-hidden>
            {illness.kind === 'cold' ? '🤧' : '🤒'}
          </span>
        )}
        {NEED_META.map(({ key, icon, label }) => {
          const v = needs[key]
          return (
            <span className="mvitals-need" key={key} title={`${label}: ${Math.round(v)}/100`}>
              <span className="mvitals-icon" aria-hidden>{icon}</span>
              <span className="mvitals-track" aria-hidden>
                <span className={`mvitals-fill ${tone(v)}`} style={{ width: `${v}%` }} />
              </span>
            </span>
          )
        })}
      </button>

      {/* One bottom sheet at a time. */}
      {sheet && (
        <div className="msheet-backdrop" onClick={() => setSheet(null)}>
          {/* Non-modal on purpose: the tab bar stays above the backdrop so a
              second tap on the active tab closes the sheet, and tapping any
              other tab switches directly. */}
          <div
            className="msheet"
            ref={sheetRef}
            role="dialog"
            aria-label={SHEET_TITLES[sheet]}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="msheet-head">
              <span className="msheet-title">{SHEET_TITLES[sheet]}</span>
              <button className="msheet-close" aria-label="Close" onClick={() => setSheet(null)}>
                ×
              </button>
            </header>
            <div className="msheet-body">
              {sheet === 'today' && (tutorialDone ? <GoalsCard /> : <TutorialPanel />)}
              {sheet === 'status' && (
                <div className="msheet-stack">
                  <AvatarCard />
                  <NeedsPanel />
                  <PathCard />
                  <MoodCard />
                  <FinanceCard />
                </div>
              )}
              {sheet === 'menu' && (
                <nav className="mmenu" aria-label="All game areas">
                  {MENU_SECTIONS.map((section) => (
                    <section className="mmenu-section" key={section.title}>
                      <h3 className="mmenu-section-title">{section.title}</h3>
                      {section.items.map((item) => (
                        <button className="mmenu-item" key={item.id} onClick={() => openPanel(item.id)}>
                          <span className="mmenu-icon" aria-hidden>{item.icon}</span>
                          <span className="mmenu-text">
                            <span className="mmenu-label">
                              {item.label}
                              {item.id === 'achievements' && readyCount > 0 && (
                                <span className="mmenu-badge mono">{readyCount}</span>
                              )}
                            </span>
                            <span className="mmenu-hint">{item.hint}</span>
                          </span>
                          <span className="mmenu-chevron" aria-hidden>›</span>
                        </button>
                      ))}
                      {section.title === 'Settings' && (
                        <button className="mmenu-item" onClick={toggleSound}>
                          <span className="mmenu-icon" aria-hidden>{soundOn ? '🔊' : '🔇'}</span>
                          <span className="mmenu-text">
                            <span className="mmenu-label">Sound {soundOn ? 'on' : 'off'}</span>
                            <span className="mmenu-hint">Tap to {soundOn ? 'mute' : 'unmute'} game sounds</span>
                          </span>
                        </button>
                      )}
                    </section>
                  ))}
                </nav>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom tab bar — the phone's fixed home base. */}
      <nav className="mnav" aria-label="Main navigation">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`mnav-btn${tab.active ? ' active' : ''}`}
            onClick={tab.onTap}
            aria-label={tab.label}
            aria-pressed={tab.active}
          >
            <span className="mnav-icon" aria-hidden>
              {tab.icon}
              {tab.dot && <span className="mnav-dot" aria-hidden />}
            </span>
            <span className="mnav-label">{tab.label}</span>
          </button>
        ))}
      </nav>
    </>
  )
}
