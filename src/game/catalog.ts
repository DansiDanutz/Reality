import type { Job, LifeEvent, Recipe, ShopCategory, ShopItem } from './types'

export const FOUNDER_BALANCE = 200_000
export const FOUNDER_SLOTS = 2_000
export const CITIZEN_BALANCE = 2_500

/** Real seconds per tick — Rule #1: the world runs on real time */
export const TICK_SECONDS = 1

/** Chance per tick that life throws something at you (~every 4 real minutes) */
export const EVENT_CHANCE = 0.004

/** Endgame purchases priced above the founder grant — long-term goals, not day-one buys */
export const ENDGAME_IDS = [
  'penthouse',
  'villa',
  'island',
  'nightclub',
  'restaurant_biz',
  'boutiquehotel',
  'solarfarm',
  'skyhotel',
  'airline',
]

export const CATEGORIES: { id: ShopCategory; label: string; icon: string }[] = [
  { id: 'food', label: 'Food', icon: '🍜' },
  { id: 'groceries', label: 'Groceries', icon: '🧺' },
  { id: 'drinks', label: 'Drinks', icon: '☕' },
  { id: 'clothing', label: 'Clothing', icon: '👔' },
  { id: 'electronics', label: 'Electronics', icon: '📱' },
  { id: 'furniture', label: 'Furniture', icon: '🛋️' },
  { id: 'vehicles', label: 'Vehicles', icon: '🛵' },
  { id: 'education', label: 'Education', icon: '🎓' },
  { id: 'leisure', label: 'Leisure', icon: '🎡' },
  { id: 'pets', label: 'Pets', icon: '🐾' },
  { id: 'home', label: 'Homes', icon: '⌂' },
  { id: 'business', label: 'Businesses', icon: '◆' },
]

// Prices are REAL-world USD — Rule #1 extends to the economy.
export const SHOP_ITEMS: ShopItem[] = [
  // ── Food ────────────────────────────────────────────────
  { id: 'noodles', name: 'Instant Noodles', category: 'food', price: 2, hours: 0.5, description: 'Cheap, fast, gets you through a shift.', effects: { hunger: 18, hydration: 8 } },
  { id: 'sandwich', name: 'Street Sandwich', category: 'food', price: 8, hours: 0.5, description: 'Honest food from the corner stand.', effects: { hunger: 30 } },
  { id: 'tacos', name: 'Street Tacos', category: 'food', price: 9, hours: 0.5, description: 'Three for the road.', effects: { hunger: 26, fun: 4 } },
  { id: 'groceries', name: 'Home-cooked Meal', category: 'food', price: 9, hours: 1, description: 'Groceries and a stove. The sustainable option.', effects: { hunger: 42 } },
  { id: 'breakfast', name: 'Breakfast Special', category: 'food', price: 12, hours: 1, description: 'Eggs, toast, and a plan for the day.', effects: { hunger: 28, energy: 8 } },
  { id: 'protein', name: 'Protein Bowl', category: 'food', price: 14, hours: 0.5, description: 'Fuel, engineered.', effects: { hunger: 40, energy: 5 } },
  { id: 'pizza', name: 'Pizza Night', category: 'food', price: 18, hours: 2, description: 'A whole one. No sharing required.', effects: { hunger: 48, fun: 8 } },
  { id: 'sushi', name: 'Sushi Set', category: 'food', price: 24, hours: 1, description: 'Precision on a plate.', effects: { hunger: 45, fun: 5 } },
  { id: 'restaurant', name: 'Restaurant Dinner', category: 'food', price: 45, hours: 2, description: 'Table service, real plates, a small luxury.', effects: { hunger: 55, fun: 12 } },
  { id: 'finedining', name: 'Fine Dining', category: 'food', price: 150, hours: 3, description: 'Seven courses. You earned this.', effects: { hunger: 70, fun: 25 } },
  // Street foods of the real world — real corner prices
  { id: 'shawarma', name: 'Shawarma Wrap', category: 'food', price: 6, hours: 0.5, description: 'Spinning since morning, perfect by noon.', effects: { hunger: 32, fun: 3 } },
  { id: 'banhmi', name: 'Bánh Mì', category: 'food', price: 5, hours: 0.5, description: 'Saigon on a baguette.', effects: { hunger: 28, fun: 4 } },
  { id: 'arepa', name: 'Arepa con Queso', category: 'food', price: 4, hours: 0.5, description: 'Griddled corn, melted middle.', effects: { hunger: 24, fun: 3 } },
  { id: 'pierogi', name: 'Pierogi Plate', category: 'food', price: 7, hours: 0.5, description: 'Grandmother-approved dumplings.', effects: { hunger: 34, fun: 3 } },
  { id: 'samosa', name: 'Samosas (3)', category: 'food', price: 3, hours: 0.25, description: 'Crisp corners, spiced heart.', effects: { hunger: 18, fun: 3 } },
  { id: 'taiyaki', name: 'Taiyaki', category: 'food', price: 4, hours: 0.25, description: 'A fish-shaped pastry with no fish in it.', effects: { hunger: 12, fun: 8 } },
  { id: 'poutine', name: 'Poutine', category: 'food', price: 9, hours: 0.5, description: 'Fries, gravy, squeaky cheese. Apologize later.', effects: { hunger: 36, fun: 6 } },
  { id: 'currywurst', name: 'Currywurst', category: 'food', price: 5, hours: 0.25, description: 'Berlin\'s answer to every question.', effects: { hunger: 26, fun: 4 } },
  { id: 'padthai', name: 'Pad Thai Box', category: 'food', price: 8, hours: 0.5, description: 'Wok-fired, lime on top.', effects: { hunger: 35, fun: 5 } },
  { id: 'mamaliga', name: 'Mămăligă cu Brânză', category: 'food', price: 6, hours: 0.5, description: 'Romanian comfort: polenta, cheese, sour cream.', effects: { hunger: 33, fun: 5 } },
  // Five more streets, five more cultures (issue #10)
  { id: 'alpastor', name: 'Tacos al Pastor', category: 'food', price: 7, hours: 0.5, description: 'Trompo-spit pork, pineapple, a squeeze of lime. Mexico City after midnight.', effects: { hunger: 30, fun: 6 } },
  { id: 'injera', name: 'Injera & Wat', category: 'food', price: 8, hours: 1, description: 'Sourdough crepe torn into spiced lentils. Addis Ababa, shared plate.', effects: { hunger: 34, fun: 4 } },
  { id: 'jianbing', name: 'Jianbing', category: 'food', price: 5, hours: 0.25, description: 'Beijing breakfast crepe: egg, crisp, chili, cilantro, folded fast.', effects: { hunger: 26, fun: 5 } },
  { id: 'tteokbokki', name: 'Tteokbokki', category: 'food', price: 6, hours: 0.5, description: 'Chewy rice cakes in gochujang fire. Seoul pojangmacha staple.', effects: { hunger: 28, fun: 7 } },
  { id: 'simit', name: 'Simit', category: 'food', price: 3, hours: 0.25, description: 'Istanbul sesame bread ring, eaten warm on the ferry across the Bosphorus.', effects: { hunger: 18, fun: 4 } },

  // ── Groceries (raw ingredients — cook them into meals, see RECIPES) ──
  // Edible raw in a pinch, but their real value is combined at a kitchen.
  // Shelf life is the REAL pantry/fridge life of each food (Rule #1) — dry
  // goods keep for a year, raw chicken wants using in two days.
  { id: 'rice', name: 'Bag of Rice', category: 'groceries', price: 2, description: 'A week of dinners waiting to happen.', effects: { hunger: 6 }, shelfLifeDays: 365 },
  { id: 'pasta', name: 'Dried Pasta', category: 'groceries', price: 2, description: 'Boils in ten minutes, feeds you all week.', effects: { hunger: 6 }, shelfLifeDays: 365 },
  { id: 'bread', name: 'Fresh Bread', category: 'groceries', price: 2, description: 'The base of a hundred cheap meals.', effects: { hunger: 8 }, shelfLifeDays: 5 },
  { id: 'eggs', name: 'Half-dozen Eggs', category: 'groceries', price: 3, description: 'Breakfast, binder, or dinner in a pan.', effects: { hunger: 8 }, shelfLifeDays: 21 },
  { id: 'tomato', name: 'Ripe Tomatoes', category: 'groceries', price: 3, description: 'Sauce, salad, or straight off the vine.', effects: { hunger: 5 }, shelfLifeDays: 5 },
  { id: 'veggies', name: 'Fresh Vegetables', category: 'groceries', price: 4, description: 'Whatever the market had this morning.', effects: { hunger: 6, fun: 1 }, shelfLifeDays: 5 },
  { id: 'cheese', name: 'Block of Cheese', category: 'groceries', price: 4, description: 'Makes everything better, melts into most things.', effects: { hunger: 8, fun: 2 }, shelfLifeDays: 21 },
  { id: 'chicken', name: 'Chicken Breast', category: 'groceries', price: 6, description: 'Protein for the pan — the centre of a real dinner.', effects: { hunger: 10 }, shelfLifeDays: 2 },

  // ── Drinks (hydration is the most urgent human need) ────
  { id: 'water', name: 'Bottled Water', category: 'drinks', price: 1, hours: 0.1, description: 'The first need. Your body is ~60% of this.', effects: { hydration: 50 } },
  { id: 'soda', name: 'Craft Soda', category: 'drinks', price: 3, hours: 0.25, description: 'Fizzy optimism.', effects: { hydration: 20, fun: 5 } },
  { id: 'coffee', name: 'Coffee', category: 'drinks', price: 4, hours: 0.25, description: 'The engine of civilization.', effects: { energy: 10, hydration: 8 } },
  { id: 'energydrink', name: 'Energy Drink', category: 'drinks', price: 4, hours: 0.25, description: 'Wings sold separately.', effects: { energy: 14, hydration: 15, fun: 2 } },
  { id: 'espresso', name: 'Double Espresso', category: 'drinks', price: 5, hours: 0.25, description: 'For days that start too early.', effects: { energy: 16, hydration: 4 } },
  { id: 'matcha', name: 'Matcha Latte', category: 'drinks', price: 6, hours: 0.5, description: 'Calm energy, green and steady.', effects: { energy: 12, hydration: 20, fun: 4 } },
  { id: 'juice', name: 'Fresh Juice', category: 'drinks', price: 7, hours: 0.25, description: 'Cold-pressed sunshine.', effects: { energy: 8, hydration: 30, hunger: 6 } },
  { id: 'bubbletea', name: 'Bubble Tea', category: 'drinks', price: 7, hours: 0.5, description: 'Half drink, half dessert, all joy.', effects: { fun: 8, hydration: 25, hunger: 5 } },
  { id: 'smoothie', name: 'Power Smoothie', category: 'drinks', price: 9, hours: 0.25, description: 'A meal in disguise.', effects: { hunger: 12, hydration: 25, energy: 6 } },
  // Seasonal specials — stocked by the REAL season outside your window
  { id: 'hotchocolate', name: 'Hot Chocolate', category: 'drinks', price: 5, hours: 0.25, season: 'winter', description: 'Winter in a mug, whipped cream optional.', effects: { hydration: 15, fun: 10, energy: 3 } },
  { id: 'spicedchai', name: 'Spiced Chai', category: 'drinks', price: 5, hours: 0.25, season: 'winter', description: 'Cinnamon-warm against the cold.', effects: { hydration: 18, energy: 8, fun: 5 } },
  { id: 'icedlemonade', name: 'Iced Lemonade', category: 'drinks', price: 4, hours: 0.25, season: 'summer', description: 'Squeezed this morning, gone in a minute.', effects: { hydration: 35, fun: 6 } },
  { id: 'icedcoffee', name: 'Cold Brew on Ice', category: 'drinks', price: 5, hours: 0.25, season: 'summer', description: 'Summer fuel, extra condensation.', effects: { hydration: 14, energy: 12, fun: 3 } },

  // ── Clothing (career gear — dress for the job) ──────────
  { id: 'uniform', name: 'Work Uniform', category: 'clothing', price: 60, durable: true, wageBonus: 0.02, description: 'Look the part, get the shifts.' },
  { id: 'sneakers', name: 'Fresh Sneakers', category: 'clothing', price: 120, durable: true, wageBonus: 0.02, description: 'Faster on your feet all day.' },
  { id: 'smartcasual', name: 'Smart Casual Set', category: 'clothing', price: 220, durable: true, wageBonus: 0.03, description: 'Office-ready without trying too hard.' },
  { id: 'suit', name: 'Tailored Suit', category: 'clothing', price: 600, durable: true, wageBonus: 0.05, description: 'Doors open before you knock.' },
  { id: 'designer', name: 'Designer Outfit', category: 'clothing', price: 2_500, durable: true, wageBonus: 0.07, description: 'People assume you own the building.' },

  // ── Electronics ─────────────────────────────────────────
  { id: 'speaker', name: 'Smart Speaker', category: 'electronics', price: 99, durable: true, hours: 0.5, description: 'Your apartment, scored.', effects: { fun: 8 } },
  { id: 'ereader', name: 'E-reader', category: 'electronics', price: 140, durable: true, hours: 1, description: 'A thousand books, one charge.', effects: { fun: 10 } },
  { id: 'headphones', name: 'Noise-cancelling Headphones', category: 'electronics', price: 349, durable: true, wageBonus: 0.02, description: 'Deep-focus shifts pay better.' },
  { id: 'console', name: 'Game Console', category: 'electronics', price: 499, durable: true, hours: 2, description: 'One more run. Always one more run.', effects: { fun: 20 } },
  { id: 'espressomachine', name: 'Espresso Machine', category: 'electronics', price: 700, durable: true, hours: 0.25, description: 'Barista-grade, kitchen-counter sized.', effects: { energy: 12 } },
  { id: 'phone', name: 'Smartphone Pro', category: 'electronics', price: 999, durable: true, wageBonus: 0.03, description: 'Reachable, bookable, hireable.' },
  { id: 'tv', name: '4K Home Cinema', category: 'electronics', price: 1_300, durable: true, hours: 2, description: 'The good kind of doing nothing.', effects: { fun: 15 } },
  { id: 'laptop', name: 'Laptop Pro', category: 'electronics', price: 2_499, durable: true, wageBonus: 0.06, description: 'Work from anywhere on Earth. Literally.' },

  // ── Furniture ───────────────────────────────────────────
  { id: 'hotplate', name: 'Hot Plate & Pans', category: 'furniture', price: 40, durable: true, description: 'One burner and a good pan — enough to actually cook, home or not.', effects: { hunger: 6 } },
  { id: 'plants', name: 'House Plants', category: 'furniture', price: 45, durable: true, hours: 0.25, description: 'Alive, green, and quietly encouraging.', effects: { fun: 6 } },
  { id: 'bookshelf', name: 'Bookshelf', category: 'furniture', price: 180, durable: true, hours: 2, description: 'A room with a library in it.', effects: { fun: 12 } },
  { id: 'showerset', name: 'Rain Shower Set', category: 'furniture', price: 250, durable: true, hours: 0.5, description: 'Hotel mornings, every morning.', effects: { hygiene: 50 } },
  { id: 'desk', name: 'Home Office Desk', category: 'furniture', price: 400, durable: true, wageBonus: 0.04, description: 'A command center of your own.' },
  { id: 'chair', name: 'Ergonomic Chair', category: 'furniture', price: 550, durable: true, wageBonus: 0.03, description: 'Your back does the long shifts too.' },
  { id: 'mattress', name: 'Memory-foam Mattress', category: 'furniture', price: 1_200, durable: true, hours: 1.5, description: 'Power naps that actually power.', effects: { energy: 25 } },
  { id: 'kitchen', name: 'Full Kitchen', category: 'furniture', price: 8_000, durable: true, hours: 1, description: 'Cook properly, forever.', effects: { hunger: 45 } },

  // ── Vehicles (commute perks) ────────────────────────────
  { id: 'skateboard', name: 'Skateboard', category: 'vehicles', price: 90, durable: true, wageBonus: 0.01, description: 'The city is your shortcut.' },
  { id: 'bike', name: 'City Bike', category: 'vehicles', price: 500, durable: true, wageBonus: 0.02, description: 'Two wheels, zero traffic.' },
  { id: 'scooter', name: 'E-Scooter', category: 'vehicles', price: 600, durable: true, wageBonus: 0.03, description: 'Glide to work with minutes to spare.' },
  { id: 'motorbike', name: 'Motorbike', category: 'vehicles', price: 7_500, durable: true, wageBonus: 0.05, description: 'Every job in town is close now.' },
  { id: 'car', name: 'Compact Car', category: 'vehicles', price: 22_000, durable: true, wageBonus: 0.07, description: 'Doors, roof, freedom.' },
  { id: 'suv', name: 'Electric SUV', category: 'vehicles', price: 55_000, durable: true, wageBonus: 0.09, description: 'Arrive like you mean it.' },

  // ── Education (instant XP — levels unlock careers) ──────
  { id: 'course', name: 'Online Course', category: 'education', price: 80, grantXp: 40, description: 'An evening well spent.' },
  { id: 'masterclass', name: 'Masterclass Series', category: 'education', price: 180, grantXp: 60, description: 'Learn from people at the top.' },
  { id: 'certification', name: 'Professional Certification', category: 'education', price: 300, grantXp: 150, description: 'Paper that pays.' },
  { id: 'bootcamp', name: 'Coding Bootcamp', category: 'education', price: 12_000, grantXp: 300, description: 'Twelve intense weeks, new career.' },
  { id: 'university', name: 'University Semester', category: 'education', price: 15_000, grantXp: 700, description: 'The long game, played properly.' },
  { id: 'mba', name: 'Executive MBA', category: 'education', price: 120_000, grantXp: 1_500, description: 'Speak fluent boardroom.' },

  // ── Leisure ─────────────────────────────────────────────
  { id: 'shower_public', name: 'Public Shower', category: 'leisure', price: 5, hours: 1, description: 'The city gym locker room. It works.', effects: { hygiene: 45 } },
  { id: 'gym', name: 'Gym Session', category: 'leisure', price: 15, hours: 2, description: 'Sweat now, feel unstoppable later.', effects: { fun: 15, hygiene: -10, energy: -8, hydration: -12 } },
  { id: 'movie', name: 'Movie Night', category: 'leisure', price: 15, hours: 3, description: 'Two hours somewhere else entirely.', effects: { fun: 28 } },
  { id: 'museum', name: 'Museum Visit', category: 'leisure', price: 20, hours: 2, description: 'Five thousand years in an afternoon.', effects: { fun: 12 } },
  { id: 'karaoke', name: 'Karaoke Night', category: 'leisure', price: 40, hours: 3, description: 'You CAN sing. Tonight you can.', effects: { fun: 30 } },
  { id: 'concert', name: 'Live Concert', category: 'leisure', price: 120, hours: 4, description: 'Front row. Ears ringing for a day.', effects: { fun: 55 } },
  { id: 'themepark', name: 'Theme Park Day', category: 'leisure', price: 120, hours: 8, description: 'Scream therapy, professionally administered.', effects: { fun: 65 } },
  { id: 'spa', name: 'Spa Day', category: 'leisure', price: 150, hours: 4, description: 'Emerge as a new person.', effects: { hygiene: 60, fun: 20 } },
  { id: 'weekendtrip', name: 'Weekend Trip', category: 'leisure', price: 600, hours: 24, description: 'New city, no plans, full battery.', effects: { fun: 90, energy: -10 } },

  // ── Pets (companions — joy that greets you at the door) ──
  // Pets are alive: each has a hunger meter that decays on real time and a
  // daily food cost. A fed pet gives its full fun bonus when you play with it;
  // a neglected one goes quiet (no bonus) but never dies — this game is kind.
  { id: 'goldfish', name: 'Goldfish', category: 'pets', price: 15, durable: true, hours: 0.25, description: 'Watch it circle. Somehow it helps.', effects: { fun: 6 }, pet: { foodCostPerDay: 1, fun: 6 } },
  { id: 'cat', name: 'Cat', category: 'pets', price: 150, durable: true, hours: 1, description: 'Adopted from the shelter. It owns you now.', effects: { fun: 18 }, pet: { foodCostPerDay: 2, fun: 18 } },
  { id: 'dog', name: 'Dog', category: 'pets', price: 300, durable: true, hours: 1, description: 'A walk, a ball, a best friend.', effects: { fun: 25, energy: -6, hygiene: -4 }, pet: { foodCostPerDay: 3, fun: 25 } },

  // ── Homes (placeable, real-market prices) ───────────────
  { id: 'microstudio', name: 'Micro Studio', category: 'home', price: 45_000, placeable: true, description: 'Small door, big deal: it\'s yours.' },
  { id: 'studio', name: 'Studio Apartment', category: 'home', price: 85_000, placeable: true, description: 'Your own door, your own key. Free showers, deep sleep.' },
  { id: 'apartment', name: 'City Apartment', category: 'home', price: 180_000, placeable: true, description: 'Two rooms with a view of the grid.' },
  { id: 'penthouse', name: 'Penthouse', category: 'home', price: 650_000, placeable: true, description: 'The skyline, from above.' },
  { id: 'villa', name: 'Coastal Villa', category: 'home', price: 1_800_000, placeable: true, description: 'The kind of address people remember.' },
  { id: 'island', name: 'Private Island Estate', category: 'home', price: 6_000_000, placeable: true, description: 'Your own dot on the map. Endgame living.' },

  // ── Businesses (placeable; real startup costs, income per REAL day) ──
  { id: 'foodcart', name: 'Food Cart', category: 'business', price: 15_000, placeable: true, incomePerDay: 200, description: 'One cart, one corner, steady cash.' },
  { id: 'barbershop', name: 'Barbershop', category: 'business', price: 60_000, placeable: true, incomePerDay: 800, description: 'Everyone needs a chair they trust.' },
  { id: 'bakery', name: 'Bakery', category: 'business', price: 80_000, placeable: true, incomePerDay: 1_050, description: 'The street smells like your profits.' },
  { id: 'startup', name: 'Tech Startup', category: 'business', price: 95_000, placeable: true, incomePerDay: 1_300, description: 'Ship fast. The whole map is your market.' },
  { id: 'coffeeshop', name: 'Coffee Shop', category: 'business', price: 120_000, placeable: true, incomePerDay: 1_600, description: 'Morning rush pays the rent everywhere on Earth.' },
  { id: 'bookcafe', name: 'Bookstore Café', category: 'business', price: 150_000, placeable: true, incomePerDay: 2_000, description: 'Slow browsing, fast margins.' },
  { id: 'fitness', name: 'Fitness Studio', category: 'business', price: 180_000, placeable: true, incomePerDay: 2_400, description: 'Memberships renew whether they show up or not.' },
  { id: 'restaurant_biz', name: 'Restaurant', category: 'business', price: 400_000, placeable: true, incomePerDay: 5_400, description: 'High stakes, full tables, real margins.' },
  { id: 'nightclub', name: 'Nightclub', category: 'business', price: 500_000, placeable: true, incomePerDay: 6_800, description: 'The city needs somewhere to be at 2am.' },
  { id: 'boutiquehotel', name: 'Boutique Hotel', category: 'business', price: 850_000, placeable: true, incomePerDay: 11_500, description: 'Twelve rooms, five stars, one owner.' },
  { id: 'solarfarm', name: 'Solar Farm', category: 'business', price: 1_100_000, placeable: true, incomePerDay: 15_000, description: 'The sun works every shift.' },
  { id: 'skyhotel', name: 'Skyscraper Hotel', category: 'business', price: 4_000_000, placeable: true, incomePerDay: 55_000, description: 'A landmark with your name on the deed.' },
  { id: 'airline', name: 'Regional Airline', category: 'business', price: 12_000_000, placeable: true, incomePerDay: 165_000, description: 'Own the routes between your empire.' },
]

export const JOBS: Job[] = [
  { id: 'barista', title: 'Barista', wage: 15, requiredLevel: 1, flavor: 'Latte art and rush hours.' },
  { id: 'courier', title: 'Courier', wage: 16, requiredLevel: 1, flavor: 'The city moves because you do.' },
  { id: 'retail', title: 'Shop Manager', wage: 22, requiredLevel: 2, flavor: 'Keys to the store, keys to the schedule.' },
  // Society careers — education opens these doors (levels come from learning)
  { id: 'teacher', title: 'Teacher', wage: 26, requiredLevel: 2, flavor: 'Thirty futures per classroom, every single day.' },
  { id: 'nurse', title: 'Nurse', wage: 32, requiredLevel: 3, flavor: 'The city heals on your shift.' },
  { id: 'analyst', title: 'Data Analyst', wage: 35, requiredLevel: 3, flavor: 'You see the patterns before anyone else.' },
  { id: 'developer', title: 'Software Developer', wage: 55, requiredLevel: 4, flavor: 'You build the systems this world runs on.' },
]

export const LIFE_EVENTS: LifeEvent[] = [
  // ── Everyday life ───────────────────────────────────────
  { text: 'You found $20 on the sidewalk.', money: 20 },
  { text: 'A stranger paid for your lunch. People are good.', effects: { hunger: 15 } },
  { text: 'Caught in the rain — those shoes are done.', money: -15 },
  { text: 'Free street concert on your block tonight.', effects: { fun: 14 } },
  { text: 'Cracked phone screen. Ouch.', money: -40 },
  { text: 'Someone ordered pizza for the whole building.', effects: { hunger: 10, fun: 5 } },
  { text: 'Slept like a stone. Today is yours.', effects: { energy: 12 } },
  { text: 'You won the neighborhood raffle.', money: 75 },
  { text: 'An old friend called out of nowhere. An hour flew by.', effects: { fun: 18 } },
  { text: 'The bakery gave you yesterday\'s bread for free.', effects: { hunger: 12 } },
  { text: 'You returned a lost wallet. The reward was real.', money: 40 },
  { text: 'Parking ticket. The sign was definitely hidden.', money: -35 },
  { text: 'A neighbor shared soup from home.', effects: { hunger: 14, hydration: 6 } },
  { text: 'You gave directions to tourists; they bought you coffee.', effects: { energy: 8, fun: 5 } },
  { text: 'Left the window open — slept badly in the noise.', effects: { energy: -10 } },
  { text: 'Free water bottles at the marathon checkpoint.', effects: { hydration: 25 } },
  { text: 'Grocery flash sale — you stocked up smart.', money: -8, effects: { hunger: 20 } },
  { text: 'Your card got skimmed. The bank refunded most of it.', money: -25 },
  { text: 'You helped carry a couch upstairs. Sweaty, but they paid.', money: 30, effects: { energy: -8, hygiene: -6 } },
  { text: 'A street cat adopted you for one sunny hour.', effects: { fun: 10 } },
  { text: 'Sudden heatwave — you needed twice the water today.', effects: { hydration: -15 } },
  { text: 'Blood-donation drive: juice, cookies, good karma.', effects: { hunger: 6, fun: 8, energy: -6 } },
  { text: 'The farmers\' market gave you the last crate of peaches.', effects: { hunger: 10, fun: 6 } },
  { text: 'Your bus broke down — you walked the last two kilometers.', effects: { energy: -8, fun: -4 } },
  { text: 'A busker played your song. You tipped what it was worth.', money: -5, effects: { fun: 12 } },
  { text: 'Library late fee. Worth every day of it.', money: -6, effects: { fun: 4 } },
  { text: 'You fixed a neighbor\'s laptop. They insisted on paying.', money: 45, effects: { fun: 4 } },
  { text: 'Power cut on the block — cold dinner by candlelight.', effects: { hunger: -8, fun: 3 } },
  { text: 'A pop-up vaccination van: free checkup, clean bill.', effects: { fun: 2, energy: 4 } },
  { text: 'You joined a pickup football game in the park.', effects: { fun: 16, energy: -10, hygiene: -8, hydration: -10 } },
  { text: 'Found your winter coat — with $10 in the pocket.', money: 10 },
  { text: 'Neighborhood cleanup day. Sore arms, proud street.', effects: { fun: 8, energy: -8, hygiene: -6 } },
  // ── Business owner life ─────────────────────────────────
  { text: 'A famous food blogger reviewed your business!', money: 150, requiresBusiness: true },
  { text: 'Surprise inspection — a small compliance fine.', money: -60, requiresBusiness: true },
  { text: 'A tour bus stopped right outside your business.', money: 120, requiresBusiness: true },
  { text: 'Your best regular brought five friends.', money: 85, requiresBusiness: true },
  { text: 'A pipe burst overnight. The plumber was fast, not cheap.', money: -110, requiresBusiness: true },
  { text: 'A local influencer tagged your storefront.', money: 95, requiresBusiness: true },
  { text: 'Supplier mixed up the order — free extra stock.', money: 60, requiresBusiness: true },
  { text: 'Graffiti on the shutters. Cleanup crew booked.', money: -45, requiresBusiness: true },
  { text: 'The morning rush broke your daily record.', money: 130, requiresBusiness: true },
  { text: 'A film crew rented your frontage for an afternoon.', money: 200, requiresBusiness: true },
]

// Cook-combos: raw groceries → a real meal. Cheaper per unit of hunger than
// eating out, and each adds fun or energy — the reward for having a kitchen.
export const RECIPES: Recipe[] = [
  { id: 'grilledcheese', name: 'Grilled Cheese', emoji: '🧀', ingredients: { bread: 1, cheese: 1 }, effects: { hunger: 34, fun: 6 }, description: 'Golden, crisp, five minutes flat.' },
  { id: 'bigbreakfast', name: 'Big Breakfast', emoji: '🍳', ingredients: { eggs: 1, bread: 1, tomato: 1 }, effects: { hunger: 40, energy: 12, fun: 5 }, description: 'Eggs, toast, grilled tomato — the day starts here.' },
  { id: 'friedrice', name: 'Fried Rice', emoji: '🍚', ingredients: { rice: 1, eggs: 1, veggies: 1 }, effects: { hunger: 46, energy: 3, fun: 6 }, description: 'Yesterday\'s rice, tonight\'s dinner.' },
  { id: 'pastapomodoro', name: 'Pasta al Pomodoro', emoji: '🍝', ingredients: { pasta: 1, tomato: 1, cheese: 1 }, effects: { hunger: 48, fun: 8 }, description: 'Three ingredients, a hundred good nights.' },
  { id: 'omelette', name: 'Veggie Omelette', emoji: '🥚', ingredients: { eggs: 1, veggies: 1, cheese: 1 }, effects: { hunger: 44, energy: 8, fun: 4 }, description: 'Folded over whatever\'s in the fridge.' },
  { id: 'chickendinner', name: 'Chicken Dinner', emoji: '🍗', ingredients: { chicken: 1, veggies: 1, rice: 1 }, effects: { hunger: 60, energy: 6, fun: 8 }, description: 'A plate that means you\'ve made it home.' },
]

export const itemById = (id: string): ShopItem | undefined => SHOP_ITEMS.find((i) => i.id === id)
export const jobById = (id: string): Job | undefined => JOBS.find((j) => j.id === id)
export const recipeById = (id: string): Recipe | undefined => RECIPES.find((r) => r.id === id)
