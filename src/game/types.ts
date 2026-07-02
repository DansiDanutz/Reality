export interface Needs {
  hunger: number
  energy: number
  hygiene: number
  fun: number
}

export type NeedKey = keyof Needs

export type ShopCategory =
  | 'food'
  | 'drinks'
  | 'clothing'
  | 'electronics'
  | 'furniture'
  | 'vehicles'
  | 'education'
  | 'leisure'
  | 'home'
  | 'business'

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
}

export interface Job {
  id: string
  title: string
  wage: number
  requiredLevel: number
  flavor: string
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
}

export interface Citizen {
  name: string
  founderNumber: number
  createdAt: number
}

export interface LifeEvent {
  text: string
  money?: number
  effects?: Partial<Needs>
  /** Only fires for players who own at least one business */
  requiresBusiness?: boolean
}
