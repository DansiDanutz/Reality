import type { Job, LifeEvent, ShopCategory, ShopItem } from './types'

export const FOUNDER_BALANCE = 200_000
export const FOUNDER_SLOTS = 2_000
export const CITIZEN_BALANCE = 2_500

/** Real seconds per tick — Rule #1: the world runs on real time */
export const TICK_SECONDS = 1

/** Chance per tick that life throws something at you (~every 4 real minutes) */
export const EVENT_CHANCE = 0.004

/** Endgame purchases priced above the founder grant — long-term goals, not day-one buys */
export const ENDGAME_IDS = ['island', 'boutiquehotel', 'solarfarm', 'skyhotel', 'airline']

export const CATEGORIES: { id: ShopCategory; label: string; icon: string }[] = [
  { id: 'food', label: 'Food', icon: '🍜' },
  { id: 'drinks', label: 'Drinks', icon: '☕' },
  { id: 'clothing', label: 'Clothing', icon: '👔' },
  { id: 'electronics', label: 'Electronics', icon: '📱' },
  { id: 'furniture', label: 'Furniture', icon: '🛋️' },
  { id: 'vehicles', label: 'Vehicles', icon: '🛵' },
  { id: 'education', label: 'Education', icon: '🎓' },
  { id: 'leisure', label: 'Leisure', icon: '🎡' },
  { id: 'home', label: 'Homes', icon: '⌂' },
  { id: 'business', label: 'Businesses', icon: '◆' },
]

export const SHOP_ITEMS: ShopItem[] = [
  // ── Food ────────────────────────────────────────────────
  { id: 'noodles', name: 'Instant Noodles', category: 'food', price: 4, hours: 0.5, description: 'Cheap, fast, gets you through a shift.', effects: { hunger: 18 } },
  { id: 'tacos', name: 'Street Tacos', category: 'food', price: 8, hours: 0.5, description: 'Three for the road.', effects: { hunger: 26, fun: 4 } },
  { id: 'sandwich', name: 'Street Sandwich', category: 'food', price: 9, hours: 0.5, description: 'Honest food from the corner stand.', effects: { hunger: 30 } },
  { id: 'breakfast', name: 'Breakfast Special', category: 'food', price: 11, hours: 1, description: 'Eggs, toast, and a plan for the day.', effects: { hunger: 28, energy: 8 } },
  { id: 'groceries', name: 'Home-cooked Meal', category: 'food', price: 16, hours: 1, description: 'Groceries and a stove. The sustainable option.', effects: { hunger: 42 } },
  { id: 'protein', name: 'Protein Bowl', category: 'food', price: 18, hours: 0.5, description: 'Fuel, engineered.', effects: { hunger: 40, energy: 5 } },
  { id: 'sushi', name: 'Sushi Set', category: 'food', price: 22, hours: 1, description: 'Precision on a plate.', effects: { hunger: 45, fun: 5 } },
  { id: 'pizza', name: 'Pizza Night', category: 'food', price: 24, hours: 2, description: 'A whole one. No sharing required.', effects: { hunger: 48, fun: 8 } },
  { id: 'restaurant', name: 'Restaurant Dinner', category: 'food', price: 32, hours: 2, description: 'Table service, real plates, a small luxury.', effects: { hunger: 55, fun: 12 } },
  { id: 'finedining', name: 'Fine Dining', category: 'food', price: 85, hours: 3, description: 'Seven courses. You earned this.', effects: { hunger: 70, fun: 25 } },

  // ── Drinks ──────────────────────────────────────────────
  { id: 'soda', name: 'Craft Soda', category: 'drinks', price: 4, hours: 0.25, description: 'Fizzy optimism.', effects: { fun: 5 } },
  { id: 'coffee', name: 'Coffee', category: 'drinks', price: 5, hours: 0.25, description: 'The engine of civilization.', effects: { energy: 10 } },
  { id: 'energydrink', name: 'Energy Drink', category: 'drinks', price: 6, hours: 0.25, description: 'Wings sold separately.', effects: { energy: 14, fun: 2 } },
  { id: 'espresso', name: 'Double Espresso', category: 'drinks', price: 7, hours: 0.25, description: 'For days that start too early.', effects: { energy: 16 } },
  { id: 'juice', name: 'Fresh Juice', category: 'drinks', price: 8, hours: 0.25, description: 'Cold-pressed sunshine.', effects: { energy: 8, hunger: 6 } },
  { id: 'matcha', name: 'Matcha Latte', category: 'drinks', price: 8, hours: 0.5, description: 'Calm energy, green and steady.', effects: { energy: 12, fun: 4 } },
  { id: 'bubbletea', name: 'Bubble Tea', category: 'drinks', price: 9, hours: 0.5, description: 'Half drink, half dessert, all joy.', effects: { fun: 8, hunger: 5 } },
  { id: 'smoothie', name: 'Power Smoothie', category: 'drinks', price: 10, hours: 0.25, description: 'A meal in disguise.', effects: { hunger: 12, energy: 6 } },

  // ── Clothing (career gear — dress for the job) ──────────
  { id: 'uniform', name: 'Work Uniform', category: 'clothing', price: 90, durable: true, wageBonus: 0.02, description: 'Look the part, get the shifts.' },
  { id: 'sneakers', name: 'Fresh Sneakers', category: 'clothing', price: 140, durable: true, wageBonus: 0.02, description: 'Faster on your feet all day.' },
  { id: 'smartcasual', name: 'Smart Casual Set', category: 'clothing', price: 260, durable: true, wageBonus: 0.03, description: 'Office-ready without trying too hard.' },
  { id: 'suit', name: 'Interview Suit', category: 'clothing', price: 520, durable: true, wageBonus: 0.05, description: 'Doors open before you knock.' },
  { id: 'designer', name: 'Designer Outfit', category: 'clothing', price: 1_400, durable: true, wageBonus: 0.07, description: 'People assume you own the building.' },

  // ── Electronics ─────────────────────────────────────────
  { id: 'speaker', name: 'Smart Speaker', category: 'electronics', price: 180, durable: true, hours: 0.5, description: 'Your apartment, scored.', effects: { fun: 8 } },
  { id: 'ereader', name: 'E-reader', category: 'electronics', price: 220, durable: true, hours: 1, description: 'A thousand books, one charge.', effects: { fun: 10 } },
  { id: 'headphones', name: 'Noise-cancelling Headphones', category: 'electronics', price: 350, durable: true, wageBonus: 0.02, description: 'Deep-focus shifts pay better.' },
  { id: 'espressomachine', name: 'Espresso Machine', category: 'electronics', price: 420, durable: true, hours: 0.25, description: 'Barista-grade, kitchen-counter sized.', effects: { energy: 12 } },
  { id: 'console', name: 'Game Console', category: 'electronics', price: 480, durable: true, hours: 2, description: 'One more run. Always one more run.', effects: { fun: 20 } },
  { id: 'phone', name: 'Smartphone Pro', category: 'electronics', price: 600, durable: true, wageBonus: 0.03, description: 'Reachable, bookable, hireable.' },
  { id: 'tv', name: '4K Home Cinema', category: 'electronics', price: 900, durable: true, hours: 2, description: 'The good kind of doing nothing.', effects: { fun: 15 } },
  { id: 'laptop', name: 'Laptop Pro', category: 'electronics', price: 1_800, durable: true, wageBonus: 0.06, description: 'Work from anywhere on Earth. Literally.' },

  // ── Furniture ───────────────────────────────────────────
  { id: 'plants', name: 'House Plants', category: 'furniture', price: 90, durable: true, hours: 0.25, description: 'Alive, green, and quietly encouraging.', effects: { fun: 6 } },
  { id: 'bookshelf', name: 'Bookshelf', category: 'furniture', price: 260, durable: true, hours: 2, description: 'A room with a library in it.', effects: { fun: 12 } },
  { id: 'showerset', name: 'Rain Shower Set', category: 'furniture', price: 380, durable: true, hours: 0.5, description: 'Hotel mornings, every morning.', effects: { hygiene: 50 } },
  { id: 'chair', name: 'Ergonomic Chair', category: 'furniture', price: 450, durable: true, wageBonus: 0.03, description: 'Your back does the long shifts too.' },
  { id: 'desk', name: 'Home Office Desk', category: 'furniture', price: 700, durable: true, wageBonus: 0.04, description: 'A command center of your own.' },
  { id: 'mattress', name: 'Memory-foam Mattress', category: 'furniture', price: 850, durable: true, hours: 1.5, description: 'Power naps that actually power.', effects: { energy: 25 } },
  { id: 'kitchen', name: 'Full Kitchen', category: 'furniture', price: 1_600, durable: true, hours: 1, description: 'Cook properly, forever.', effects: { hunger: 45 } },

  // ── Vehicles (commute perks) ────────────────────────────
  { id: 'skateboard', name: 'Skateboard', category: 'vehicles', price: 120, durable: true, wageBonus: 0.01, description: 'The city is your shortcut.' },
  { id: 'bike', name: 'City Bike', category: 'vehicles', price: 380, durable: true, wageBonus: 0.02, description: 'Two wheels, zero traffic.' },
  { id: 'scooter', name: 'E-Scooter', category: 'vehicles', price: 650, durable: true, wageBonus: 0.03, description: 'Glide to work with minutes to spare.' },
  { id: 'motorbike', name: 'Motorbike', category: 'vehicles', price: 3_200, durable: true, wageBonus: 0.05, description: 'Every job in town is close now.' },
  { id: 'car', name: 'Compact Car', category: 'vehicles', price: 12_500, durable: true, wageBonus: 0.07, description: 'Doors, roof, freedom.' },
  { id: 'suv', name: 'Electric SUV', category: 'vehicles', price: 38_000, durable: true, wageBonus: 0.09, description: 'Arrive like you mean it.' },

  // ── Education (instant XP — levels unlock careers) ──────
  { id: 'course', name: 'Online Course', category: 'education', price: 150, grantXp: 40, description: 'An evening well spent.' },
  { id: 'masterclass', name: 'Masterclass Series', category: 'education', price: 350, grantXp: 60, description: 'Learn from people at the top.' },
  { id: 'certification', name: 'Professional Certification', category: 'education', price: 900, grantXp: 150, description: 'Paper that pays.' },
  { id: 'bootcamp', name: 'Coding Bootcamp', category: 'education', price: 2_500, grantXp: 300, description: 'Twelve intense weeks, new career.' },
  { id: 'university', name: 'University Semester', category: 'education', price: 9_000, grantXp: 700, description: 'The long game, played properly.' },
  { id: 'mba', name: 'Executive MBA', category: 'education', price: 25_000, grantXp: 1_500, description: 'Speak fluent boardroom.' },

  // ── Leisure ─────────────────────────────────────────────
  { id: 'shower_public', name: 'Public Shower', category: 'leisure', price: 8, hours: 1, description: 'The city gym locker room. It works.', effects: { hygiene: 45 } },
  { id: 'gym', name: 'Gym Session', category: 'leisure', price: 14, hours: 2, description: 'Sweat now, feel unstoppable later.', effects: { fun: 15, hygiene: -10, energy: -8 } },
  { id: 'museum', name: 'Museum Visit', category: 'leisure', price: 15, hours: 2, description: 'Five thousand years in an afternoon.', effects: { fun: 12 } },
  { id: 'movie', name: 'Movie Night', category: 'leisure', price: 18, hours: 3, description: 'Two hours somewhere else entirely.', effects: { fun: 28 } },
  { id: 'karaoke', name: 'Karaoke Night', category: 'leisure', price: 35, hours: 3, description: 'You CAN sing. Tonight you can.', effects: { fun: 30 } },
  { id: 'concert', name: 'Live Concert', category: 'leisure', price: 60, hours: 4, description: 'Front row. Ears ringing for a day.', effects: { fun: 55 } },
  { id: 'themepark', name: 'Theme Park Day', category: 'leisure', price: 95, hours: 8, description: 'Scream therapy, professionally administered.', effects: { fun: 65 } },
  { id: 'spa', name: 'Spa Day', category: 'leisure', price: 120, hours: 4, description: 'Emerge as a new person.', effects: { hygiene: 60, fun: 20 } },
  { id: 'weekendtrip', name: 'Weekend Trip', category: 'leisure', price: 450, hours: 24, description: 'New city, no plans, full battery.', effects: { fun: 90, energy: -10 } },

  // ── Homes (placeable) ───────────────────────────────────
  { id: 'microstudio', name: 'Micro Studio', category: 'home', price: 16_000, placeable: true, description: 'Small door, big deal: it\'s yours.' },
  { id: 'studio', name: 'Studio Apartment', category: 'home', price: 28_000, placeable: true, description: 'Your own door, your own key. Free showers, deep sleep.' },
  { id: 'apartment', name: 'City Apartment', category: 'home', price: 65_000, placeable: true, description: 'Two rooms with a view of the grid.' },
  { id: 'penthouse', name: 'Penthouse', category: 'home', price: 120_000, placeable: true, description: 'The skyline, from above.' },
  { id: 'villa', name: 'Coastal Villa', category: 'home', price: 180_000, placeable: true, description: 'The kind of address people remember.' },
  { id: 'island', name: 'Private Island Estate', category: 'home', price: 450_000, placeable: true, description: 'Your own dot on the map. Endgame living.' },

  // ── Businesses (placeable, passive income) ──────────────
  { id: 'foodcart', name: 'Food Cart', category: 'business', price: 18_000, placeable: true, incomePerDay: 230, description: 'One cart, one corner, steady cash.' },
  { id: 'bakery', name: 'Bakery', category: 'business', price: 32_000, placeable: true, incomePerDay: 420, description: 'The street smells like your profits.' },
  { id: 'barbershop', name: 'Barbershop', category: 'business', price: 45_000, placeable: true, incomePerDay: 580, description: 'Everyone needs a chair they trust.' },
  { id: 'coffeeshop', name: 'Coffee Shop', category: 'business', price: 58_000, placeable: true, incomePerDay: 760, description: 'Morning rush pays the rent everywhere on Earth.' },
  { id: 'bookcafe', name: 'Bookstore Café', category: 'business', price: 72_000, placeable: true, incomePerDay: 950, description: 'Slow browsing, fast margins.' },
  { id: 'fitness', name: 'Fitness Studio', category: 'business', price: 95_000, placeable: true, incomePerDay: 1_250, description: 'Memberships renew whether they show up or not.' },
  { id: 'nightclub', name: 'Nightclub', category: 'business', price: 120_000, placeable: true, incomePerDay: 1_650, description: 'The city needs somewhere to be at 2am.' },
  { id: 'restaurant_biz', name: 'Restaurant', category: 'business', price: 150_000, placeable: true, incomePerDay: 2_000, description: 'High stakes, full tables, real margins.' },
  { id: 'startup', name: 'Tech Startup', category: 'business', price: 190_000, placeable: true, incomePerDay: 2_700, description: 'Ship fast. The whole map is your market.' },
  { id: 'boutiquehotel', name: 'Boutique Hotel', category: 'business', price: 260_000, placeable: true, incomePerDay: 3_500, description: 'Twelve rooms, five stars, one owner.' },
  { id: 'solarfarm', name: 'Solar Farm', category: 'business', price: 340_000, placeable: true, incomePerDay: 4_600, description: 'The sun works every shift.' },
  { id: 'skyhotel', name: 'Skyscraper Hotel', category: 'business', price: 600_000, placeable: true, incomePerDay: 8_900, description: 'A landmark with your name on the deed.' },
  { id: 'airline', name: 'Regional Airline', category: 'business', price: 1_200_000, placeable: true, incomePerDay: 16_500, description: 'Own the routes between your empire.' },
]

export const JOBS: Job[] = [
  { id: 'courier', title: 'Courier', wage: 16, requiredLevel: 1, flavor: 'The city moves because you do.' },
  { id: 'barista', title: 'Barista', wage: 19, requiredLevel: 1, flavor: 'Latte art and rush hours.' },
  { id: 'retail', title: 'Shop Manager', wage: 24, requiredLevel: 2, flavor: 'Keys to the store, keys to the schedule.' },
  { id: 'analyst', title: 'Data Analyst', wage: 36, requiredLevel: 3, flavor: 'You see the patterns before anyone else.' },
  { id: 'developer', title: 'Software Developer', wage: 48, requiredLevel: 4, flavor: 'You build the systems this world runs on.' },
]

export const LIFE_EVENTS: LifeEvent[] = [
  { text: 'You found $20 on the sidewalk.', money: 20 },
  { text: 'A stranger paid for your lunch. People are good.', effects: { hunger: 15 } },
  { text: 'Caught in the rain — those shoes are done.', money: -15 },
  { text: 'Free street concert on your block tonight.', effects: { fun: 14 } },
  { text: 'Cracked phone screen. Ouch.', money: -40 },
  { text: 'Someone ordered pizza for the whole building.', effects: { hunger: 10, fun: 5 } },
  { text: 'Slept like a stone. Today is yours.', effects: { energy: 12 } },
  { text: 'You won the neighborhood raffle.', money: 75 },
  { text: 'A famous food blogger reviewed your business!', money: 150, requiresBusiness: true },
  { text: 'Surprise inspection — a small compliance fine.', money: -60, requiresBusiness: true },
  { text: 'A tour bus stopped right outside your business.', money: 120, requiresBusiness: true },
]

export const itemById = (id: string): ShopItem | undefined => SHOP_ITEMS.find((i) => i.id === id)
export const jobById = (id: string): Job | undefined => JOBS.find((j) => j.id === id)
