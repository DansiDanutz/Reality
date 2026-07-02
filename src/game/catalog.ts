import type { Job, ShopItem } from './types'

export const FOUNDER_BALANCE = 200_000
export const FOUNDER_SLOTS = 2_000
export const CITIZEN_BALANCE = 2_500

/** Real seconds per tick */
export const TICK_SECONDS = 1
/** Game minutes that pass per tick — 1 game day ≈ 2.4 real minutes */
export const MINUTES_PER_TICK = 10

export const SHOP_ITEMS: ShopItem[] = [
  // ── Food ────────────────────────────────────────────────
  { id: 'noodles', name: 'Instant Noodles', category: 'food', price: 4, hours: 0.5, description: 'Cheap, fast, gets you through a shift.', effects: { hunger: 18 } },
  { id: 'sandwich', name: 'Street Sandwich', category: 'food', price: 9, hours: 0.5, description: 'Honest food from the corner stand.', effects: { hunger: 30 } },
  { id: 'groceries', name: 'Home-cooked Meal', category: 'food', price: 16, hours: 1, description: 'Groceries and a stove. The sustainable option.', effects: { hunger: 42 } },
  { id: 'restaurant', name: 'Restaurant Dinner', category: 'food', price: 32, hours: 2, description: 'Table service, real plates, a small luxury.', effects: { hunger: 55, fun: 12 } },

  // ── Lifestyle ───────────────────────────────────────────
  { id: 'shower_public', name: 'Public Shower', category: 'lifestyle', price: 8, hours: 1, description: 'The city gym locker room. It works.', effects: { hygiene: 45 } },
  { id: 'movie', name: 'Movie Night', category: 'lifestyle', price: 18, hours: 3, description: 'Two hours somewhere else entirely.', effects: { fun: 28 } },
  { id: 'gym', name: 'Gym Session', category: 'lifestyle', price: 14, hours: 2, description: 'Sweat now, feel unstoppable later.', effects: { fun: 15, hygiene: -10, energy: -8 } },
  { id: 'concert', name: 'Live Concert', category: 'lifestyle', price: 60, hours: 4, description: 'Front row. Ears ringing for a day.', effects: { fun: 55 } },

  // ── Homes (placeable) ───────────────────────────────────
  { id: 'studio', name: 'Studio Apartment', category: 'home', price: 28_000, placeable: true, description: 'Your own door, your own key. Free showers, deep sleep.' },
  { id: 'apartment', name: 'City Apartment', category: 'home', price: 65_000, placeable: true, description: 'Two rooms with a view of the grid.' },
  { id: 'villa', name: 'Coastal Villa', category: 'home', price: 180_000, placeable: true, description: 'The kind of address people remember.' },

  // ── Businesses (placeable, passive income) ──────────────
  { id: 'foodcart', name: 'Food Cart', category: 'business', price: 18_000, placeable: true, incomePerDay: 230, description: 'One cart, one corner, steady cash.' },
  { id: 'coffeeshop', name: 'Coffee Shop', category: 'business', price: 58_000, placeable: true, incomePerDay: 760, description: 'Morning rush pays the rent everywhere on Earth.' },
  { id: 'fitness', name: 'Fitness Studio', category: 'business', price: 95_000, placeable: true, incomePerDay: 1_250, description: 'Memberships renew whether they show up or not.' },
  { id: 'restaurant_biz', name: 'Restaurant', category: 'business', price: 150_000, placeable: true, incomePerDay: 2_000, description: 'High stakes, full tables, real margins.' },
  { id: 'startup', name: 'Tech Startup', category: 'business', price: 190_000, placeable: true, incomePerDay: 2_700, description: 'Ship fast. The whole map is your market.' },
]

export const JOBS: Job[] = [
  { id: 'courier', title: 'Courier', wage: 16, requiredLevel: 1, flavor: 'The city moves because you do.' },
  { id: 'barista', title: 'Barista', wage: 19, requiredLevel: 1, flavor: 'Latte art and rush hours.' },
  { id: 'retail', title: 'Shop Manager', wage: 24, requiredLevel: 2, flavor: 'Keys to the store, keys to the schedule.' },
  { id: 'analyst', title: 'Data Analyst', wage: 36, requiredLevel: 3, flavor: 'You see the patterns before anyone else.' },
  { id: 'developer', title: 'Software Developer', wage: 48, requiredLevel: 4, flavor: 'You build the systems this world runs on.' },
]

export const itemById = (id: string): ShopItem | undefined => SHOP_ITEMS.find((i) => i.id === id)
export const jobById = (id: string): Job | undefined => JOBS.find((j) => j.id === id)
