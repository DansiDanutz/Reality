import type { BuildingArchetype } from './registry'

/**
 * Heroes-of-Might-&-Magic-flavored building sprites for the world map.
 * Pure inline SVG strings (markers are raw DOM elements, so strings are the
 * natural currency here — no React render per map tick). Colors come from
 * the design tokens in src/styles/tokens.css via CSS variables, so the
 * sprites stay on-palette if the theme ever shifts.
 *
 * Style rules (see .claude/skills/map-buildings/SKILL.md):
 *  - painterly silhouette: dark stone/timber body, warm glowing windows
 *  - slight 3/4 perspective suggested by offset roofs and side walls
 *  - a soft ground shadow ellipse anchors the building to the map
 *  - 48–72px tall, readable at globe zoom
 */

export interface SpriteOptions {
  /** Business upgrade level (1–5+) — adds visible embellishments. */
  level?: number
}

// Shared palette — silhouette tones sit between the map's night navy and
// the HUD's token colors so buildings read as "ours" without shouting.
const STONE = '#2a3550'
const STONE_DARK = '#1a2338'
const TIMBER = '#4a3826'
const ROOF = '#5b3d8f'
const ROOF_BIZ = '#8f2d3d'
const WINDOW = 'var(--gold, #f0b429)'
const FLAG = 'var(--sky, #7dd8ff)'
const FLAG_GOLD = 'var(--gold, #f0b429)'

const shadow = (cx: number, cy: number, rx: number) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${rx * 0.28}" fill="rgba(0,0,0,0.45)"/>`

const pennant = (x: number, y: number, color: string) =>
  `<line x1="${x}" y1="${y}" x2="${x}" y2="${y - 9}" stroke="#0d1220" stroke-width="1.4"/>` +
  `<path d="M${x} ${y - 9} l7 2.2 l-7 2.2 z" fill="${color}"/>`

const glowWindow = (x: number, y: number, w: number, h: number) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1" fill="${WINDOW}" opacity="0.92"/>`

const wrap = (w: number, h: number, body: string) =>
  `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`

/** Small thatched cottage — the starter home. */
function cottage(): string {
  return wrap(48, 52, [
    shadow(24, 47, 17),
    // side wall hints the 3/4 view
    `<path d="M10 30 L24 30 L24 46 L10 46 Z" fill="${STONE_DARK}"/>`,
    `<path d="M24 30 L38 32 L38 46 L24 46 Z" fill="${STONE}"/>`,
    // thatch roof, overhanging
    `<path d="M6 32 L24 16 L42 32 L36 32 L24 22 L12 32 Z" fill="${TIMBER}"/>`,
    `<path d="M8 31 L24 17 L40 31 L24 20 Z" fill="#6b5232"/>`,
    // chimney
    `<rect x="30" y="18" width="4" height="8" fill="${STONE_DARK}"/>`,
    glowWindow(14, 35, 5, 6),
    glowWindow(29, 36, 5, 6),
    // door
    `<rect x="21" y="38" width="6" height="8" rx="2" fill="#0d1220"/>`,
  ].join(''))
}

/** Timbered manor with a tower wing — the mid-tier home. */
function manor(): string {
  return wrap(56, 60, [
    shadow(28, 55, 21),
    // tower wing
    `<rect x="8" y="24" width="12" height="30" fill="${STONE_DARK}"/>`,
    `<path d="M6 24 L14 12 L22 24 Z" fill="${ROOF}"/>`,
    pennant(14, 12, FLAG),
    // main hall in 3/4
    `<path d="M20 32 L44 32 L44 54 L20 54 Z" fill="${STONE}"/>`,
    `<path d="M44 32 L50 35 L50 54 L44 54 Z" fill="${STONE_DARK}"/>`,
    `<path d="M18 32 L32 20 L46 32 Z" fill="${ROOF}"/>`,
    `<path d="M46 32 L52 35 L46 35 Z" fill="#452e6e"/>`,
    // timber band
    `<rect x="20" y="40" width="24" height="2" fill="${TIMBER}"/>`,
    glowWindow(11, 30, 5, 6),
    glowWindow(24, 36, 5, 6),
    glowWindow(34, 36, 5, 6),
    `<rect x="28" y="45" width="7" height="9" rx="2" fill="#0d1220"/>`,
  ].join(''))
}

/** Full castle with twin turrets — the $1M+ estate. */
function castle(): string {
  return wrap(68, 72, [
    shadow(34, 66, 26),
    // curtain wall
    `<rect x="14" y="38" width="40" height="26" fill="${STONE}"/>`,
    `<path d="M54 38 L60 42 L60 64 L54 64 Z" fill="${STONE_DARK}"/>`,
    // battlements
    `<path d="M14 38 h4 v-4 h4 v4 h4 v-4 h4 v4 h4 v-4 h4 v4 h4 v-4 h4 v4 h4 v-4 h4 v4 v3 h-40 Z" fill="${STONE_DARK}"/>`,
    // twin turrets
    `<rect x="8" y="22" width="12" height="42" fill="${STONE_DARK}"/>`,
    `<path d="M6 22 L14 8 L22 22 Z" fill="${ROOF}"/>`,
    `<rect x="48" y="22" width="12" height="42" fill="${STONE_DARK}"/>`,
    `<path d="M46 22 L54 8 L62 22 Z" fill="${ROOF}"/>`,
    // central keep
    `<rect x="26" y="26" width="16" height="20" fill="${STONE}"/>`,
    `<path d="M24 26 L34 14 L44 26 Z" fill="${ROOF}"/>`,
    pennant(34, 14, FLAG_GOLD),
    pennant(14, 8, FLAG),
    pennant(54, 8, FLAG),
    glowWindow(12, 32, 4, 6),
    glowWindow(52, 32, 4, 6),
    glowWindow(31, 32, 6, 7),
    // gate
    `<path d="M29 64 L29 52 A5 5 0 0 1 39 52 L39 64 Z" fill="#0d1220"/>`,
  ].join(''))
}

/** Market stall with a striped awning — the food-cart tier business. */
function stall(): string {
  return wrap(48, 48, [
    shadow(24, 43, 17),
    // counter
    `<rect x="10" y="30" width="28" height="12" fill="${TIMBER}"/>`,
    `<path d="M38 30 L43 33 L43 42 L38 42 Z" fill="#33271a"/>`,
    // awning poles
    `<rect x="11" y="18" width="2" height="14" fill="#33271a"/>`,
    `<rect x="35" y="18" width="2" height="14" fill="#33271a"/>`,
    // striped awning
    `<path d="M8 20 L40 20 L44 28 L4 28 Z" fill="${ROOF_BIZ}"/>`,
    `<path d="M12 20 L18 20 L17 28 L10 28 Z" fill="#c9903a"/>`,
    `<path d="M26 20 L32 20 L32 28 L25 28 Z" fill="#c9903a"/>`,
    pennant(40, 20, FLAG_GOLD),
    // wares glowing on the counter
    glowWindow(15, 32, 6, 4),
    glowWindow(26, 32, 6, 4),
  ].join(''))
}

/** Tavern / shop with a hanging sign — the mid-tier business. */
function tavern(): string {
  return wrap(56, 58, [
    shadow(28, 53, 21),
    // main body in 3/4
    `<rect x="12" y="28" width="30" height="24" fill="${STONE}"/>`,
    `<path d="M42 28 L48 31 L48 52 L42 52 Z" fill="${STONE_DARK}"/>`,
    // steep shingled roof
    `<path d="M9 28 L27 12 L45 28 Z" fill="${ROOF_BIZ}"/>`,
    `<path d="M45 28 L51 31 L45 31 Z" fill="#6e2330"/>`,
    `<rect x="34" y="14" width="4" height="8" fill="${STONE_DARK}"/>`,
    // timber cross-braces
    `<rect x="12" y="36" width="30" height="2" fill="${TIMBER}"/>`,
    `<rect x="12" y="44" width="30" height="2" fill="${TIMBER}"/>`,
    // hanging sign
    `<line x1="10" y1="30" x2="6" y2="30" stroke="${TIMBER}" stroke-width="2"/>`,
    `<rect x="2" y="31" width="8" height="6" rx="1" fill="${FLAG_GOLD}"/>`,
    glowWindow(16, 31, 6, 5),
    glowWindow(31, 31, 6, 5),
    glowWindow(16, 40, 6, 5),
    `<rect x="28" y="42" width="8" height="10" rx="2" fill="#0d1220"/>`,
    pennant(27, 12, FLAG_GOLD),
  ].join(''))
}

/** Guild hall / keep — the high-end business. */
function guildhall(): string {
  return wrap(64, 68, [
    shadow(32, 62, 24),
    // grand hall
    `<rect x="14" y="32" width="34" height="28" fill="${STONE}"/>`,
    `<path d="M48 32 L56 36 L56 60 L48 60 Z" fill="${STONE_DARK}"/>`,
    `<path d="M11 32 L31 14 L51 32 Z" fill="${ROOF_BIZ}"/>`,
    `<path d="M51 32 L58 36 L51 36 Z" fill="#6e2330"/>`,
    // corner tower
    `<rect x="6" y="20" width="11" height="40" fill="${STONE_DARK}"/>`,
    `<path d="M4 20 L11.5 8 L19 20 Z" fill="${ROOF}"/>`,
    pennant(11.5, 8, FLAG_GOLD),
    pennant(31, 14, FLAG_GOLD),
    // tall arched guild windows
    `<path d="M20 38 L20 48 L26 48 L26 38 A3 3 0 0 0 20 38" fill="${WINDOW}" opacity="0.92"/>`,
    `<path d="M30 38 L30 48 L36 48 L36 38 A3 3 0 0 0 30 38" fill="${WINDOW}" opacity="0.92"/>`,
    glowWindow(9, 28, 5, 7),
    // gate
    `<path d="M38 60 L38 50 A4.5 4.5 0 0 1 47 50 L47 60 Z" fill="#0d1220"/>`,
  ].join(''))
}

/**
 * Level embellishments for businesses (level 2+): each upgrade adds a
 * visible flourish so a maxed business LOOKS invested-in from orbit.
 * Layered as absolutely-positioned SVG siblings via a trailing group.
 */
function levelTrim(level: number, w: number): string {
  if (level < 2) return ''
  const parts: string[] = []
  if (level >= 2) parts.push(pennant(w - 8, 16, FLAG))
  if (level >= 3)
    parts.push(`<rect x="${w / 2 - 8}" y="4" width="16" height="5" rx="1" fill="${FLAG}" opacity="0.9"/>`)
  if (level >= 4)
    parts.push(`<ellipse cx="${w / 2}" cy="${w - 3}" rx="${w / 2 - 4}" ry="4" fill="none" stroke="${FLAG_GOLD}" stroke-width="1.5" opacity="0.65"/>`)
  if (level >= 5)
    parts.push(pennant(8, 16, FLAG_GOLD))
  return parts.join('')
}

const SPRITES: Record<BuildingArchetype, () => string> = {
  cottage,
  manor,
  castle,
  stall,
  tavern,
  guildhall,
}

/**
 * The sprite for an archetype, embellished by level. Injecting the level trim
 * before the closing tag keeps each base sprite a pure, testable function.
 */
export function buildingSpriteSVG(archetype: BuildingArchetype, opts: SpriteOptions = {}): string {
  const base = SPRITES[archetype]()
  const level = opts.level ?? 1
  if (level < 2) return base
  const width = Number(/viewBox="0 0 (\d+)/.exec(base)?.[1] ?? 48)
  return base.replace('</svg>', `${levelTrim(level, width)}</svg>`)
}
