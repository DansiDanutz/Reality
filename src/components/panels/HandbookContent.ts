/**
 * The How-to-Play handbook — every rule a player might wonder about, in one
 * always-reachable place (UX north star: the intro shows once; understanding
 * must be re-readable forever). Pure content so the copy is testable and the
 * panel stays a dumb renderer.
 */

export interface HandbookSection {
  icon: string
  title: string
  lines: string[]
}

export const HANDBOOK_SECTIONS: HandbookSection[] = [
  {
    icon: '🌍',
    title: 'Why you are here',
    lines: [
      'Reality is a second life on the real Earth — the same loops as real life (eat, sleep, work, spend), but visible and winnable.',
      'The long game: escape wage labor. Turn salary into capital, capital into businesses, businesses into an empire you can see on the map.',
    ],
  },
  {
    icon: '⏰',
    title: 'Rule #1 — everything is REAL time',
    lines: [
      'One hour in the world is one hour of your life. A shift is 8 real hours, sleep is a real night — pay and rest land when the commitment ends. Leave early for pro-rata pay and no XP.',
      'Life goes on without you: your citizen buys meals and sleeps from your balance while you are away, and your businesses keep earning. Come back to collect — the game will ping you if you allow notifications.',
    ],
  },
  {
    icon: '❤️',
    title: 'Staying alive',
    lines: [
      'Five needs drain over real hours: Water, Food, Energy, Hygiene, Fun. Health drops fast while Food or Energy sit at zero, and recovers while both are above 60.',
      'Below 20 health, 25 energy or 15 food you cannot work — the simulation forces the real-life loop. The ❤️ strip at the top is always watching; tap it for the full picture, and see the Health guide for the science.',
    ],
  },
  {
    icon: '💰',
    title: 'Making money',
    lines: [
      'Gigs pay small and fast. Careers pay better with levels — study courses to unlock them, and every shift builds seniority that multiplies your wage.',
      'Wages keep you alive; businesses make you rich. Buy one in the Shop, place it anywhere inside your reach, and collect its revenue every real day. Upgrades compound it.',
    ],
  },
  {
    icon: '🗺️',
    title: 'Your reach — the unlock ladder',
    lines: [
      'You can see the whole world but build only inside your golden ring. It grows as you do:',
      'Your city (15 km) → your province (80 km) at level 3 or your first business → your country (450 km) at level 5 plus a home or a second business → your continent (2,500 km) at level 8, five businesses or $1M net worth → the world at level 12 or $5M.',
    ],
  },
  {
    icon: '🧭',
    title: 'Reading your guide',
    lines: [
      'The guide bar above your actions always names the single best next move — survival first, then work, then wealth, then joy. One tap does it.',
      'The gold "i · $5" button buys the advisor\'s full read: today\'s ranked plan with real durations and the forecast to your next milestone.',
    ],
  },
]

export interface LegendEntry {
  symbol: string
  label: string
  meaning: string
}

export const MAP_LEGEND: LegendEntry[] = [
  {
    symbol: '🏠',
    label: 'Your buildings',
    meaning: 'Tap one to step inside. A pulsing gold ring means income is ready to collect.',
  },
  {
    symbol: 'W · S · M · G',
    label: 'Resource spots',
    meaning: 'Wood, Stone, Metal and Glass for construction — tap to gather. A number badge means several spots grouped together.',
  },
  {
    symbol: '⚒️',
    label: 'Workers Hall',
    meaning: 'Hire workers to speed up your construction and business projects.',
  },
  {
    symbol: '🏗️',
    label: 'Construction sites',
    meaning: 'Your builds in progress — first materials, then the permit, then labor until the reveal.',
  },
  {
    symbol: '⭕',
    label: 'The golden ring',
    meaning: 'Your reach. Buildings can only be placed inside it — see the unlock ladder above.',
  },
  {
    symbol: '👆',
    label: 'Ask anything',
    meaning: 'Long-press (or right-click) any marker for a quick card: what it is, what it gives, what tapping does.',
  },
]
