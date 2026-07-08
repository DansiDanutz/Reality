import type { PlacedAsset, ShopItem } from '../../../game/types'
import type { PanelId } from '../../../store/gameStore'
import { MAX_BUSINESS_LEVEL } from '../../../game/businessUpgrades'

/**
 * The generic map-building framework (see .claude/skills/map-buildings/SKILL.md).
 *
 * Every clickable building on the world map resolves to one ARCHETYPE, and
 * each archetype owns one registry entry: its sprite, display name, and the
 * interior rooms the player can enter. WorldMap and BuildingInterior render
 * purely from this registry — adding a future building type (bank, school,
 * hospital…) is a new entry + sprite here, nothing else.
 *
 * Hard rule: rooms only call EXISTING store actions. Time-consuming actions
 * already route through advance() in src/game/engine.ts via those actions —
 * the registry never invents a new simulation path.
 */

export type BuildingArchetype = 'cottage' | 'manor' | 'castle' | 'stall' | 'tavern' | 'guildhall'

/**
 * The slice of the game store a room is allowed to touch. Deliberately
 * narrow: existing, already-simulated actions plus panel navigation. Keeps
 * the registry unit-testable without the full zustand store.
 */
export interface BuildingStoreApi {
  activity: unknown | null
  assets: PlacedAsset[]
  startSleep: () => void
  collectIncome: () => void
  upgradeBusiness: (assetId: string) => void
  setPanel: (panel: PanelId) => void
}

export interface BuildingRoom {
  id: string
  label: string
  icon: string
  description: string
  /** Hide/disable gate — omitted means always available. */
  availableWhen?: (store: BuildingStoreApi, asset: PlacedAsset) => boolean
  onEnter: (store: BuildingStoreApi, asset: PlacedAsset) => void
}

export interface BuildingDefinition {
  displayName: string
  interior: { rooms: BuildingRoom[] }
}

// ── Shared rooms ──────────────────────────────────────────
// Where a full panel already exists, the room NAVIGATES to it (setPanel)
// instead of duplicating its UI.

const homeRooms: BuildingRoom[] = [
  {
    id: 'bedroom',
    label: 'Sleep',
    icon: '🛏️',
    description: 'Turn in for the night — energy refills while you rest.',
    availableWhen: (store) => !store.activity,
    onEnter: (store) => store.startSleep(),
  },
  {
    id: 'kitchen',
    label: 'Kitchen',
    icon: '🍳',
    description: 'Cook groceries into real meals.',
    onEnter: (store) => store.setPanel('cook'),
  },
  {
    id: 'study',
    label: 'Estate ledger',
    icon: '📜',
    description: 'Review everything you own.',
    onEnter: (store) => store.setPanel('assets'),
  },
]

const businessRooms: BuildingRoom[] = [
  {
    id: 'till',
    label: 'Collect income',
    icon: '💰',
    description: 'Empty the till — pending income across your businesses.',
    availableWhen: (_store, asset) => asset.pendingIncome >= 1,
    onEnter: (store) => store.collectIncome(),
  },
  {
    id: 'office',
    label: 'Upgrade',
    icon: '📈',
    description: 'Invest in this business to multiply its daily income.',
    availableWhen: (_store, asset) => (asset.level ?? 1) < MAX_BUSINESS_LEVEL,
    onEnter: (store, asset) => store.upgradeBusiness(asset.id),
  },
  {
    id: 'floor',
    label: 'Work a shift',
    icon: '🧑‍🍳',
    description: 'Head to the jobs board and clock in.',
    onEnter: (store) => store.setPanel('work'),
  },
  {
    id: 'ledger',
    label: 'Holdings',
    icon: '🗂️',
    description: 'Manage all your properties and businesses.',
    onEnter: (store) => store.setPanel('assets'),
  },
]

export const BUILDING_REGISTRY: Record<BuildingArchetype, BuildingDefinition> = {
  cottage: { displayName: 'Cottage', interior: { rooms: homeRooms } },
  manor: { displayName: 'Manor', interior: { rooms: homeRooms } },
  castle: { displayName: 'Castle', interior: { rooms: homeRooms } },
  stall: { displayName: 'Market Stall', interior: { rooms: businessRooms } },
  tavern: { displayName: 'Tavern', interior: { rooms: businessRooms } },
  guildhall: { displayName: 'Guild Hall', interior: { rooms: businessRooms } },
}

// Price tiers (real-world USD, matching src/game/catalog.ts):
// homes    — cheap starters read as cottages, city homes as manors, and the
//            $1M+ estates get the full castle treatment.
// business — the food-cart tier is a stall, the working mid-market a tavern,
//            and the $400k+ ventures a guild hall.
const HOME_MANOR_MIN = 150_000
const HOME_CASTLE_MIN = 1_000_000
const BIZ_TAVERN_MIN = 50_000
const BIZ_GUILDHALL_MIN = 400_000

/**
 * Archetype resolution: asset + its catalog entry → one archetype. Pure so
 * it's unit-testable (registry.test.ts). Unknown/missing catalog items fall
 * back to the humblest archetype of the asset's kind — never crashes on a
 * save that references a retired item.
 */
export function resolveArchetype(asset: PlacedAsset, item: ShopItem | undefined): BuildingArchetype {
  const price = item?.price ?? 0
  if (asset.kind === 'home') {
    if (price >= HOME_CASTLE_MIN) return 'castle'
    if (price >= HOME_MANOR_MIN) return 'manor'
    return 'cottage'
  }
  if (price >= BIZ_GUILDHALL_MIN) return 'guildhall'
  if (price >= BIZ_TAVERN_MIN) return 'tavern'
  return 'stall'
}
