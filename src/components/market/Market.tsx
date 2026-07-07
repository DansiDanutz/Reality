import { useMemo, useState } from 'react'
import { CATEGORIES, ENDGAME_IDS, SHOP_ITEMS } from '../../game/catalog'
import { formatMoney, seasonOf } from '../../game/engine'
import type { NeedKey, Pet, ShopCategory, ShopItem } from '../../game/types'
import { useFocusTrap } from '../../lib/useFocusTrap'
import { useGame } from '../../store/gameStore'

type Tab = ShopCategory | 'all'

/** Player-facing name for each vital, matching the Vitals HUD labels */
const NEED_LABEL: Record<NeedKey, string> = {
  hydration: 'Water',
  hunger: 'Food',
  energy: 'Energy',
  hygiene: 'Hygiene',
  fun: 'Fun',
}

/** Human-readable effect chips for an item card */
function chips(item: ShopItem): { text: string; tone: 'ok' | 'gold' | 'sky' }[] {
  const out: { text: string; tone: 'ok' | 'gold' | 'sky' }[] = []
  if (item.effects) {
    const label: Record<string, string> = { hunger: 'food', hydration: 'water', energy: 'energy', hygiene: 'hygiene', fun: 'fun' }
    for (const [k, v] of Object.entries(item.effects)) {
      if (v) out.push({ text: `${v > 0 ? '+' : ''}${v} ${label[k]}`, tone: v > 0 ? 'ok' : 'sky' })
    }
  }
  if (item.wageBonus) out.push({ text: `+${Math.round(item.wageBonus * 100)}% wage`, tone: 'gold' })
  if (item.grantXp) out.push({ text: `+${item.grantXp} XP`, tone: 'sky' })
  if (item.incomePerDay) out.push({ text: `+${formatMoney(item.incomePerDay)}/day`, tone: 'gold' })
  if (item.pet) out.push({ text: `${formatMoney(item.pet.foodCostPerDay)}/day food`, tone: 'sky' })
  if (item.durable) out.push({ text: 'keep forever', tone: 'sky' })
  return out
}

type SortOrder = 'featured' | 'low' | 'high'

/** A live pet's hunger bar + feed control, shown on an adopted pet's card. */
function PetRow({
  pets,
  money,
  foodCost,
  onFeed,
}: {
  pets: Pet[]
  money: number
  foodCost: number
  onFeed: (petId: string) => void
}) {
  // Show the hungriest companion — that's the one that needs you
  const neediest = [...pets].sort((a, b) => a.hunger - b.hunger)[0]
  const pct = Math.round(neediest.hunger)
  const quiet = neediest.hunger <= 20
  const canFeed = neediest.hunger < 100 && money >= foodCost
  return (
    <div className="pet-row" title="A pet eats on real time — feed it daily or it goes quiet (it never dies)">
      <div className="pet-meter" aria-label={`Pet ${pct}% fed`}>
        <div className={quiet ? 'pet-fill quiet' : 'pet-fill'} style={{ width: `${pct}%` }} />
      </div>
      <span className={quiet ? 'pet-state crit' : 'pet-state'}>{quiet ? 'hungry' : `${pct}%`}</span>
      <button className="btn small ghost" disabled={!canFeed} onClick={() => onFeed(neediest.petId)}>
        Feed {formatMoney(foodCost)}
      </button>
    </div>
  )
}

export default function Market() {
  // Quick actions (Eat, Drink) can aim the Market at a category
  const [tab, setTab] = useState<Tab>(() => useGame.getState().marketFocus ?? 'all')
  // Clicking a Vitals bar aims the Market at items that restore that vital
  const [need, setNeed] = useState<NeedKey | null>(() => useGame.getState().marketNeed)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortOrder>('featured')
  const [affordableOnly, setAffordableOnly] = useState(false)
  const money = useGame((s) => s.money)
  const inventory = useGame((s) => s.inventory)
  const pets = useGame((s) => s.pets)
  const buy = useGame((s) => s.buy)
  const consume = useGame((s) => s.consume)
  const feedPet = useGame((s) => s.feedPet)
  const playWithPet = useGame((s) => s.playWithPet)
  const setPanel = useGame((s) => s.setPanel)
  const spawnLat = useGame((s) => s.citizen?.spawnLat)

  // Rule #1: the shelves follow the REAL season outside the player's window
  const season = seasonOf(new Date().getMonth() + 1, spawnLat ?? 45)

  const items = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = SHOP_ITEMS.filter((i) => {
      if (i.season && i.season !== season) return false
      if (tab !== 'all' && i.category !== tab) return false
      if (need && (i.effects?.[need] ?? 0) <= 0) return false
      if (affordableOnly && i.price > money) return false
      if (q && !`${i.name} ${i.description} ${i.category}`.toLowerCase().includes(q)) return false
      return true
    })
    if (sort === 'low') return [...filtered].sort((a, b) => a.price - b.price)
    if (sort === 'high') return [...filtered].sort((a, b) => b.price - a.price)
    // When focused on a vital, lead with what restores it most
    if (need) return [...filtered].sort((a, b) => (b.effects?.[need] ?? 0) - (a.effects?.[need] ?? 0))
    return filtered
  }, [tab, need, query, sort, affordableOnly, money, season])

  const countFor = (c: ShopCategory) =>
    SHOP_ITEMS.filter((i) => i.category === c && (!i.season || i.season === season)).length

  const trapRef = useFocusTrap<HTMLDivElement>()

  return (
    <div className="market" ref={trapRef} role="dialog" aria-modal="true" aria-label="Reality Market">
      <header className="market-head">
        <h2 className="market-title">
          Market<span className="market-count"> · {SHOP_ITEMS.length} items</span>
        </h2>
        <input
          className="market-search"
          type="search"
          placeholder="Search everything…"
          aria-label="Search the market"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="market-balance mono gold">{formatMoney(money)}</span>
        <button className="drawer-close market-close" aria-label="Close market" onClick={() => setPanel(null)}>×</button>
      </header>

      <div className="market-body">
        <nav className="market-rail" aria-label="Categories">
          <button
            className={tab === 'all' && !need ? 'rail-btn active' : 'rail-btn'}
            onClick={() => {
              setTab('all')
              setNeed(null)
            }}
          >
            <span className="rail-icon">✦</span> Everything
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              className={tab === c.id && !need ? 'rail-btn active' : 'rail-btn'}
              onClick={() => {
                setTab(c.id)
                setNeed(null)
              }}
            >
              <span className="rail-icon" aria-hidden>{c.icon}</span> {c.label}
              <span className="rail-count">{countFor(c.id)}</span>
            </button>
          ))}
        </nav>

        <div className="market-grid-wrap">
          <div className="market-controls">
            <button
              className={affordableOnly ? 'tab active' : 'tab'}
              aria-pressed={affordableOnly}
              onClick={() => setAffordableOnly(!affordableOnly)}
            >
              I can afford
            </button>
            <button className={sort === 'low' ? 'tab active' : 'tab'} onClick={() => setSort(sort === 'low' ? 'featured' : 'low')}>
              Price ↑
            </button>
            <button className={sort === 'high' ? 'tab active' : 'tab'} onClick={() => setSort(sort === 'high' ? 'featured' : 'high')}>
              Price ↓
            </button>
          </div>
          {need && (
            <div className="market-need-banner" role="status">
              <span>
                Showing what restores <strong>{NEED_LABEL[need]}</strong>, most effective first
              </span>
              <button className="tab" onClick={() => setNeed(null)}>
                Clear
              </button>
            </div>
          )}
          {items.length === 0 && <p className="market-empty">Nothing matches here.</p>}
          <ul className="market-grid">
            {items.map((item) => {
              const owned = inventory[item.id] ?? 0
              const affordable = money >= item.price
              const isEndgame = ENDGAME_IDS.includes(item.id)
              const soldToYou = item.durable && owned > 0
              // Pets are owned companions, not inventory rows — their state lives in `pets`
              const myPets = item.pet ? pets.filter((p) => p.itemId === item.id) : []
              const petOwned = myPets.length > 0
              return (
                <li className={`card${soldToYou || petOwned ? ' owned' : ''}`} key={item.id} title={item.description}>
                  <img
                    className="card-img"
                    src={`/market/${item.id}.jpg`}
                    alt=""
                    loading="lazy"
                    width={512}
                    height={384}
                    onError={(e) => {
                      ;(e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                  <div className="card-top">
                    <span className="card-name">{item.name}</span>
                    {isEndgame && <span className="card-endgame" title="Priced above the founder grant — a goal to build toward">★</span>}
                    {owned > 0 && !item.durable && <em className="item-owned">×{owned}</em>}
                    {soldToYou && <span className="card-ownedtag">owned</span>}
                    {petOwned && <span className="card-ownedtag">adopted</span>}
                  </div>
                  <div className="card-chips">
                    {chips(item).slice(0, 2).map((c) => (
                      <span key={c.text} className={`chip ${c.tone}`}>{c.text}</span>
                    ))}
                  </div>
                  {petOwned && <PetRow pets={myPets} money={money} foodCost={item.pet!.foodCostPerDay} onFeed={feedPet} />}
                  <div className="card-foot">
                    <span className="card-price mono">{formatMoney(item.price)}</span>
                    <div className="card-actions">
                      {owned > 0 && item.effects && (
                        <button className="btn small ghost" onClick={() => consume(item.id)}>Use</button>
                      )}
                      {petOwned && (
                        <button className="btn small ghost" onClick={() => playWithPet(myPets[0].petId)}>Play</button>
                      )}
                      {!soldToYou && !petOwned && (
                        <button className="btn small primary" disabled={!affordable} onClick={() => buy(item.id)}>
                          {item.category === 'business' ? 'Build' : item.placeable ? 'Place' : item.grantXp ? 'Enroll' : item.pet ? 'Adopt' : 'Buy'}
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}
