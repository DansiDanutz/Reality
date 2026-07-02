import { useState } from 'react'
import { SHOP_ITEMS } from '../../game/catalog'
import { formatMoney } from '../../game/engine'
import type { ShopCategory } from '../../game/types'
import { useGame } from '../../store/gameStore'

const TABS: { id: ShopCategory; label: string }[] = [
  { id: 'food', label: 'Food' },
  { id: 'lifestyle', label: 'Lifestyle' },
  { id: 'home', label: 'Homes' },
  { id: 'business', label: 'Businesses' },
]

export default function ShopPanel() {
  const [tab, setTab] = useState<ShopCategory>('food')
  const money = useGame((s) => s.money)
  const inventory = useGame((s) => s.inventory)
  const buy = useGame((s) => s.buy)
  const consume = useGame((s) => s.consume)

  const items = SHOP_ITEMS.filter((i) => i.category === tab)

  return (
    <section className="panel" aria-label="Shop">
      <h2 className="panel-title">Shop</h2>
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? 'tab active' : 'tab'}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <ul className="item-list">
        {items.map((item) => {
          const owned = inventory[item.id] ?? 0
          const affordable = money >= item.price
          return (
            <li className="item" key={item.id}>
              <div className="item-info">
                <span className="item-name">
                  {item.name}
                  {owned > 0 && <em className="item-owned">×{owned}</em>}
                </span>
                <span className="item-desc">{item.description}</span>
                {item.incomePerDay ? (
                  <span className="item-yield mono">+{formatMoney(item.incomePerDay)}/day</span>
                ) : null}
              </div>
              <div className="item-buy">
                <span className="item-price mono">{formatMoney(item.price)}</span>
                <button className="btn small" disabled={!affordable} onClick={() => buy(item.id)}>
                  {item.placeable ? 'Buy & place' : 'Buy'}
                </button>
                {owned > 0 && item.effects && (
                  <button className="btn small ghost" onClick={() => consume(item.id)}>
                    Use
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
