export interface Needs {
  hunger: number
  energy: number
  hygiene: number
  fun: number
}

export type NeedKey = keyof Needs

export type ShopCategory = 'food' | 'lifestyle' | 'home' | 'business'

export interface ShopItem {
  id: string
  name: string
  category: ShopCategory
  price: number
  description: string
  /** Instant need restoration when consumed */
  effects?: Partial<Needs>
  /** Game hours the action takes (consumables) */
  hours?: number
  /** Passive income for placed businesses, per game day */
  incomePerDay?: number
  /** Must be placed on the globe after purchase */
  placeable?: boolean
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
