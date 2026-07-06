export interface Needs {
  hunger: number
  /** Water — the most urgent human need (≈3 days survivable vs weeks for food) */
  hydration: number
  energy: number
  hygiene: number
  fun: number
}

export type NeedKey = keyof Needs

export type ShopCategory =
  | 'food'
  | 'groceries'
  | 'drinks'
  | 'clothing'
  | 'electronics'
  | 'furniture'
  | 'vehicles'
  | 'education'
  | 'leisure'
  | 'pets'
  | 'health'
  | 'home'
  | 'business'

/**
 * An acute illness — a stateful condition, not a one-shot life event.
 * At most one at a time; it self-resolves at `endsAt` even with $0
 * (the dignity floor extends to sickness). See docs/ILLNESS-RFC.md (#8).
 */
export interface Illness {
  kind: 'cold' | 'flu'
  /** ms timestamp when the illness naturally clears */
  endsAt: number
}

export interface ShopItem {
  id: string
  name: string
  category: ShopCategory
  price: number
  description: string
  /** Instant need restoration when used */
  effects?: Partial<Needs>
  /** Game hours the action takes (consumables/durable use) */
  hours?: number
  /** Passive income for placed businesses, per game day */
  incomePerDay?: number
  /** Must be placed on the globe after purchase */
  placeable?: boolean
  /** Owned once, kept forever. With `effects`: reusable. With `wageBonus`: passive career perk */
  durable?: boolean
  /** Fraction added to every wage (0.05 = +5%), for durables */
  wageBonus?: number
  /** XP granted instantly on purchase (education) */
  grantXp?: number
  /** Only stocked in this real season at the citizen's real latitude (Rule #1) */
  season?: 'winter' | 'summer'
  /**
   * Pet definition — a pet is a companion with its own hunger meter. Feeding
   * costs real money per real day (Rule #1); a fed pet gives a bigger fun
   * bonus, a neglected one goes quiet but never dies (this game is kind).
   */
  pet?: PetConfig
  /** Groceries only: real days until this item spoils since it was last bought (Rule #1) */
  shelfLifeDays?: number
  /** Medicine only: consuming clears this illness instantly (otherwise just a weak boost) */
  cures?: Illness['kind']
}

export interface PetConfig {
  /** Daily food cost in real dollars, by the pet's size — the upkeep of joy */
  foodCostPerDay: number
  /** Fun granted when the pet is played with, scaling down as it goes hungry */
  fun: number
}

/** A pet the citizen owns — hunger is its one vital, like the citizen's needs. */
export interface Pet {
  /** ShopItem id this pet was bought from (goldfish | cat | dog) */
  itemId: string
  /** 100 = full, 0 = ravenous. Decays on real time, never kills. */
  hunger: number
  /** Stable instance id so a citizen can own two of the same kind one day */
  petId: string
}

export interface Job {
  id: string
  title: string
  wage: number
  requiredLevel: number
  flavor: string
}

/**
 * A cook-combo: raw groceries (by item id → quantity) become a home-cooked meal.
 * Cooking is cheaper per unit of hunger than eating out and adds fun/energy —
 * the payoff for owning a kitchen (a home, the Full Kitchen, or a Hot Plate).
 */
export interface Recipe {
  id: string
  name: string
  emoji: string
  /** Grocery item id → quantity consumed from inventory */
  ingredients: Record<string, number>
  /** Need restoration when the meal is cooked */
  effects: Partial<Needs>
  description: string
}

export type AssetKind = 'home' | 'business'

export interface PlacedAsset {
  id: string
  itemId: string
  kind: AssetKind
  name: string
  lat: number
  lng: number
  incomePerDay: number
  pendingIncome: number
  placedAtMinute: number
  /** Upgrade level (1 = base). Each level multiplies income. See businessUpgrades.ts */
  level?: number
}

export interface Citizen {
  name: string
  founderNumber: number
  createdAt: number
  /** Real-world hometown, resolved from IP at creation — where life starts */
  homeCity?: string
  homeCountry?: string
  spawnLat?: number
  spawnLng?: number
  /** Set once registered with the live world server */
  citizenId?: string
  token?: string
  online?: boolean
  /** Their AI-generated avatar (from the Profile avatar studio) */
  avatarUrl?: string
  /** Set once a Google account is linked — enables cloud saves */
  googleSub?: string
  googleEmail?: string
  googleName?: string
  googlePicture?: string
  /** Telegram Mini App identity, verified server-side before being stored */
  telegramUserId?: string
  telegramAccountId?: string
  telegramUsername?: string
  telegramName?: string
  telegramLinkedAt?: number
}

export interface LifeEvent {
  text: string
  money?: number
  effects?: Partial<Needs>
  /** Only fires for players who own at least one business */
  requiresBusiness?: boolean
}
