import type { BuildingArchetype } from './registry'

/**
 * The interior PANORAMA — the HoMM "town screen" made a room. Where the map
 * sprite is the building from orbit, this is the scene you step into: a wide
 * illustrated interior that VISIBLY reflects state. That's the P4 rule —
 * every upgrade you paid for shows here, and if nothing changed on screen the
 * upgrade wasn't finished.
 *
 *  - Home: the furniture you actually own (durables in your inventory) appears
 *    in the room. An empty starter cottage is bare boards + a hearth; a
 *    furnished manor is full of the things you bought.
 *  - Business: the fit-out grows with the upgrade level — bare counter at L1,
 *    stocked shelves and machinery and a lit chandelier as it climbs.
 *
 * Pure inline-SVG strings (BuildingInterior injects them once per open — no
 * React render per map tick). Every visible fixture carries a stable
 * `fx-<id>` class so interiorScene.test.ts can assert presence without parsing
 * pixels. Colors echo the map sprites (sprites.ts) so inside and outside read
 * as the same world.
 */

const WALL = { cottage: '#4a3826', manor: '#3b3f56', castle: '#2a3550' } as const
const WALL_HI = { cottage: '#5a4530', manor: '#4a4f6c', castle: '#354160' } as const
const FLOOR = { cottage: '#3a2c1d', manor: '#2c2135', castle: '#1c2438' } as const
const GOLD = 'var(--gold, #f0b429)'
const SKY = 'var(--sky, #7dd8ff)'
const WOOD = '#6b5232'
const WOOD_DARK = '#4a3826'
const STONE = '#2a3550'
const DARK = '#0d1220'
// The home roof/banner accent, echoing the map sprite's purple home roof.
const ROOF_HOME = '#5b3d8f'

const W = 320
const H = 150
const FLOOR_Y = 112

function wrap(body: string): string {
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`
}

// ── Home interiors ────────────────────────────────────────────────────────

/**
 * Furniture we draw inside a home, in back-to-front paint order. Each id is a
 * durable furniture item in catalog.ts; owning one (inventory count > 0) puts
 * it in the room. `label` feeds the "what's inside" caption + empty-state copy.
 */
export const HOME_FIXTURES: { id: string; label: string }[] = [
  { id: 'bookshelf', label: 'Bookshelf' },
  { id: 'kitchen', label: 'Full Kitchen' },
  { id: 'hotplate', label: 'Hot Plate' },
  { id: 'showerset', label: 'Rain Shower' },
  { id: 'desk', label: 'Home Office' },
  { id: 'mattress', label: 'Memory-foam Bed' },
  { id: 'chair', label: 'Ergonomic Chair' },
  { id: 'plants', label: 'House Plants' },
]

/** Which drawable fixtures the player actually owns, in paint order. */
export function ownedHomeFixtures(inventory: Record<string, number>): string[] {
  return HOME_FIXTURES.filter((f) => (inventory[f.id] ?? 0) > 0).map((f) => f.id)
}

const HOME_FIXTURE_SVG: Record<string, string> = {
  // Bookshelf against the back-left wall.
  bookshelf:
    `<g class="fx-bookshelf">` +
    `<rect x="20" y="60" width="34" height="52" fill="${WOOD_DARK}"/>` +
    `<rect x="23" y="63" width="28" height="3" fill="${WOOD}"/>` +
    `<rect x="23" y="79" width="28" height="3" fill="${WOOD}"/>` +
    `<rect x="23" y="95" width="28" height="3" fill="${WOOD}"/>` +
    [66, 82, 98].map((y, r) =>
      [0, 1, 2, 3].map((c) => `<rect x="${25 + c * 6}" y="${y + 2}" width="4" height="11" fill="${['#8a5a3a', '#4a7a8a', '#c9903a', '#6b5232'][(r + c) % 4]}"/>`).join(''),
    ).join('') +
    `</g>`,
  // Full kitchen — a run of counter with a stove and a hood.
  kitchen:
    `<g class="fx-kitchen">` +
    `<rect x="228" y="86" width="72" height="26" fill="${WALL_HI.manor}"/>` +
    `<rect x="228" y="83" width="72" height="4" fill="#8a94b0"/>` +
    `<rect x="236" y="90" width="16" height="18" fill="${DARK}"/>` +
    `<circle cx="244" cy="88" r="2.4" fill="${GOLD}"/>` +
    `<rect x="272" y="60" width="24" height="12" fill="${STONE}"/>` +
    `</g>`,
  // Hot plate — a small two-burner on a short counter (humbler kitchen).
  hotplate:
    `<g class="fx-hotplate">` +
    `<rect x="250" y="96" width="34" height="16" fill="${WOOD_DARK}"/>` +
    `<rect x="255" y="92" width="24" height="5" fill="#8a94b0"/>` +
    `<circle cx="261" cy="94" r="2" fill="${GOLD}"/>` +
    `<circle cx="273" cy="94" r="2" fill="${GOLD}"/>` +
    `</g>`,
  // Rain shower — a glassy stall on the far right.
  showerset:
    `<g class="fx-showerset">` +
    `<rect x="288" y="54" width="26" height="58" fill="rgba(125,216,255,0.12)" stroke="${SKY}" stroke-width="1"/>` +
    `<rect x="296" y="56" width="12" height="3" fill="#8a94b0"/>` +
    [0, 1, 2, 3].map((i) => `<line x1="${299 + i * 3}" y1="60" x2="${299 + i * 3}" y2="86" stroke="${SKY}" stroke-width="0.6" opacity="0.5"/>`).join('') +
    `</g>`,
  // Home office desk with a glowing monitor.
  desk:
    `<g class="fx-desk">` +
    `<rect x="150" y="90" width="44" height="6" fill="${WOOD}"/>` +
    `<rect x="152" y="96" width="4" height="16" fill="${WOOD_DARK}"/>` +
    `<rect x="188" y="96" width="4" height="16" fill="${WOOD_DARK}"/>` +
    `<rect x="162" y="74" width="20" height="14" rx="1" fill="${DARK}"/>` +
    `<rect x="164" y="76" width="16" height="10" fill="${SKY}" opacity="0.75"/>` +
    `</g>`,
  // The bed — back-right, low and inviting.
  mattress:
    `<g class="fx-mattress">` +
    `<rect x="212" y="92" width="70" height="20" rx="3" fill="#6a5b7a"/>` +
    `<rect x="212" y="86" width="70" height="8" rx="3" fill="#8a7ba0"/>` +
    `<rect x="216" y="84" width="20" height="10" rx="2" fill="#e8e2f0"/>` +
    `</g>`,
  // A soft armchair by the hearth.
  chair:
    `<g class="fx-chair">` +
    `<rect x="120" y="90" width="26" height="22" rx="3" fill="#7a4b52"/>` +
    `<rect x="116" y="78" width="8" height="30" rx="3" fill="#8a5b62"/>` +
    `<rect x="120" y="82" width="26" height="12" rx="3" fill="#8a5b62"/>` +
    `</g>`,
  // House plants — a little life in the corner.
  plants:
    `<g class="fx-plants">` +
    `<rect x="66" y="98" width="14" height="14" rx="2" fill="#8a5a3a"/>` +
    `<path d="M73 98 C66 86 68 78 73 74 C78 78 80 86 73 98 Z" fill="#4a8a4a"/>` +
    `<path d="M73 98 C80 90 84 84 88 84 C86 92 82 98 73 100 Z" fill="#5aa05a"/>` +
    `</g>`,
}

/** The hearth — always lit. It's the fireplace the ambience loop belongs to,
 *  and the warm anchor of every home from cottage to castle. */
function hearth(): string {
  return (
    `<g class="fx-hearth">` +
    `<rect x="92" y="70" width="44" height="42" fill="${STONE}"/>` +
    `<rect x="88" y="66" width="52" height="6" fill="#3a4a6e"/>` +
    `<rect x="100" y="84" width="28" height="28" fill="${DARK}"/>` +
    `<g class="hearth-fire">` +
    `<path d="M114 108 C107 100 110 94 114 90 C118 94 121 100 114 108 Z" fill="${GOLD}"/>` +
    `<path d="M114 108 C110 102 112 98 114 95 C116 98 118 102 114 108 Z" fill="#ffe9a8"/>` +
    `</g>` +
    `</g>`
  )
}

function homeShell(archetype: BuildingArchetype): string {
  const wall = WALL[archetype as keyof typeof WALL] ?? WALL.cottage
  const wallHi = WALL_HI[archetype as keyof typeof WALL_HI] ?? WALL_HI.cottage
  const floor = FLOOR[archetype as keyof typeof FLOOR] ?? FLOOR.cottage
  const parts: string[] = [
    `<rect x="0" y="0" width="${W}" height="${FLOOR_Y}" fill="${wall}"/>`,
    `<rect x="0" y="${FLOOR_Y}" width="${W}" height="${H - FLOOR_Y}" fill="${floor}"/>`,
    // baseboard
    `<rect x="0" y="${FLOOR_Y - 3}" width="${W}" height="3" fill="${wallHi}"/>`,
  ]
  // Archetype flavor on the back wall.
  if (archetype === 'cottage') {
    // horizontal timber planks
    for (let y = 12; y < FLOOR_Y - 6; y += 16) parts.push(`<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${wallHi}" stroke-width="1" opacity="0.5"/>`)
  } else if (archetype === 'manor') {
    // a timber beam across, plaster feel
    parts.push(`<rect x="0" y="34" width="${W}" height="5" fill="${WOOD_DARK}"/>`)
  } else {
    // castle: stone block courses + a hanging banner
    for (let y = 14; y < FLOOR_Y - 6; y += 20) parts.push(`<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${DARK}" stroke-width="1" opacity="0.45"/>`)
    parts.push(`<path class="fx-banner" d="M158 8 h22 v40 l-11 -8 l-11 8 Z" fill="${ROOF_HOME}"/><path d="M164 16 h10 v3 h-10 Z" fill="${GOLD}"/>`)
  }
  // A warm window (arched for the castle) letting the night in.
  if (archetype === 'castle') {
    parts.push(`<path d="M232 30 h40 v40 h-40 v-40 M232 30 a20 20 0 0 1 40 0" fill="${DARK}"/><path d="M236 34 h32 v34 h-32 Z" fill="${GOLD}" opacity="0.22"/>`)
  } else {
    parts.push(`<rect x="150" y="26" width="44" height="34" fill="${DARK}"/><rect x="153" y="29" width="38" height="28" fill="${GOLD}" opacity="0.2"/><line x1="172" y1="26" x2="172" y2="60" stroke="${DARK}" stroke-width="2"/>`)
  }
  return parts.join('')
}

export function homeInteriorSVG(archetype: BuildingArchetype, ownedIds: readonly string[]): string {
  const fixtures = HOME_FIXTURES
    .filter((f) => ownedIds.includes(f.id))
    .map((f) => HOME_FIXTURE_SVG[f.id] ?? '')
    .join('')
  return wrap(homeShell(archetype) + hearth() + fixtures)
}

// ── Business interiors ────────────────────────────────────────────────────

/** Stock crates on the back shelves scale with the upgrade level — the most
 *  legible "this business grew" signal. Capped so a maxed shop stays readable. */
export function businessStockUnits(level: number): number {
  return Math.max(2, Math.min(12, level * 2))
}

function businessShell(archetype: BuildingArchetype): string {
  const accent = '#8f2d3d'
  const parts: string[] = [
    `<rect x="0" y="0" width="${W}" height="${FLOOR_Y}" fill="#241b2b"/>`,
    `<rect x="0" y="${FLOOR_Y}" width="${W}" height="${H - FLOOR_Y}" fill="#1a1420"/>`,
    `<rect x="0" y="${FLOOR_Y - 3}" width="${W}" height="3" fill="#3a2c33"/>`,
    // a warm crimson valance across the top, echoing the biz roof
    `<rect x="0" y="0" width="${W}" height="10" fill="${accent}"/>`,
  ]
  if (archetype === 'guildhall') {
    parts.push(`<path d="M20 10 h36 v26 a18 18 0 0 1 -36 0 Z" fill="${DARK}"/><path d="M24 14 h28 v20 a14 14 0 0 1 -28 0 Z" fill="${GOLD}" opacity="0.18"/>`)
    parts.push(`<path d="M264 10 h36 v26 a18 18 0 0 1 -36 0 Z" fill="${DARK}"/><path d="M268 14 h28 v20 a14 14 0 0 1 -28 0 Z" fill="${GOLD}" opacity="0.18"/>`)
  }
  return parts.join('')
}

/** The till — a counter with a money drawer. Coins ride on top when there's
 *  pending income to collect; BuildingInterior animates them out on collect. */
function till(pendingCoins: number): string {
  const coins = Math.max(0, Math.min(6, pendingCoins))
  const coinSVG = Array.from({ length: coins }, (_, i) =>
    `<circle class="till-coin" cx="${44 + i * 12}" cy="${94 - (i % 2) * 5}" r="5" fill="${GOLD}" stroke="#c9903a" stroke-width="1"/>`,
  ).join('')
  return (
    `<g class="fx-till">` +
    `<rect x="24" y="100" width="84" height="12" fill="${WOOD}"/>` +
    `<rect x="24" y="97" width="84" height="4" fill="#8a6a42"/>` +
    `<rect x="30" y="102" width="18" height="8" fill="${DARK}"/>` +
    coinSVG +
    `</g>`
  )
}

export function businessInteriorSVG(
  archetype: BuildingArchetype,
  level: number,
  options: { pendingCoins?: number } = {},
): string {
  const lvl = Math.max(1, level)
  const parts: string[] = [businessShell(archetype)]

  // Back shelving with stock that grows with level.
  const units = businessStockUnits(lvl)
  parts.push(`<g class="fx-shelves"><rect x="150" y="40" width="150" height="60" fill="#2c2130"/>`)
  parts.push(`<rect x="150" y="60" width="150" height="3" fill="#3a2c33"/><rect x="150" y="80" width="150" height="3" fill="#3a2c33"/>`)
  const stockColors = ['#c9903a', '#4a7a8a', '#8a5a3a', '#6a8a4a']
  for (let i = 0; i < units; i++) {
    const row = Math.floor(i / 6)
    const col = i % 6
    parts.push(`<rect class="fx-stock" x="${156 + col * 23}" y="${64 + row * 20}" width="16" height="12" fill="${stockColors[(i + lvl) % stockColors.length]}"/>`)
  }
  parts.push(`</g>`)

  // The till + coins (the collect target).
  parts.push(till(options.pendingCoins ?? 0))

  // Level flourishes — visible proof of investment.
  if (lvl >= 2) parts.push(`<g class="fx-sign"><rect x="118" y="20" width="60" height="16" rx="2" fill="${DARK}" stroke="${GOLD}" stroke-width="1"/><rect x="124" y="25" width="48" height="3" fill="${GOLD}" opacity="0.8"/></g>`)
  if (lvl >= 3) parts.push(`<g class="fx-machine"><rect x="250" y="96" width="34" height="16" fill="#3a4a6e"/><circle cx="260" cy="104" r="4" fill="${SKY}" opacity="0.7"/><rect x="270" y="99" width="10" height="4" fill="${GOLD}"/></g>`)
  if (lvl >= 4) parts.push(`<g class="fx-chandelier"><line x1="90" y1="0" x2="90" y2="18" stroke="${WOOD_DARK}" stroke-width="1.4"/><circle cx="90" cy="20" r="7" fill="none" stroke="${GOLD}" stroke-width="1.4"/><circle cx="84" cy="20" r="2" fill="${GOLD}"/><circle cx="90" cy="24" r="2" fill="${GOLD}"/><circle cx="96" cy="20" r="2" fill="${GOLD}"/></g>`)
  if (lvl >= 6) parts.push(`<g class="fx-patron"><circle cx="128" cy="88" r="6" fill="#c9b299"/><rect x="123" y="94" width="10" height="18" rx="3" fill="#5a6a8a"/></g>`)

  return wrap(parts.join(''))
}
