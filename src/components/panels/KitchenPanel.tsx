import { RECIPES, itemById } from '../../game/catalog'
import { hasKitchen, missingFor } from '../../game/engine'
import type { Needs } from '../../game/types'
import { useGame } from '../../store/gameStore'

const NEED_LABEL: Record<keyof Needs, string> = {
  hunger: 'food',
  hydration: 'water',
  energy: 'energy',
  hygiene: 'hygiene',
  fun: 'fun',
}

/** The Kitchen: turn raw groceries into meals. The payoff for owning a kitchen. */
export default function KitchenPanel() {
  const inventory = useGame((s) => s.inventory)
  const assets = useGame((s) => s.assets)
  const cook = useGame((s) => s.cook)
  const openMarket = useGame((s) => s.openMarket)

  const kitchen = hasKitchen(inventory, assets)

  return (
    <section className="panel" aria-label="Kitchen">
      <h2 className="panel-title">Kitchen</h2>
      <p className="panel-sub">
        Buy raw groceries, cook them into meals. Cheaper per bite than eating out — and every
        recipe adds fun or energy on top. Cooking needs a kitchen: any home, the Full Kitchen,
        or a $40 Hot Plate.
      </p>

      {!kitchen && (
        <div className="kitchen-callout" role="note">
          <span>You don’t have a kitchen yet.</span>
          <button className="btn small" onClick={() => openMarket('furniture')}>Get a Hot Plate ($40)</button>
        </div>
      )}

      <ul className="item-list">
        {RECIPES.map((recipe) => {
          const missing = missingFor(recipe, inventory)
          const ready = kitchen && missing.length === 0
          return (
            <li className={ready ? 'item current' : 'item'} key={recipe.id}>
              <div className="item-info">
                <span className="item-name">{recipe.emoji} {recipe.name}</span>
                <span className="item-desc">{recipe.description}</span>
                <span className="recipe-ingredients">
                  {Object.entries(recipe.ingredients).map(([id, qty]) => {
                    const have = inventory[id] ?? 0
                    const enough = have >= qty
                    return (
                      <span key={id} className={enough ? 'ingredient ok' : 'ingredient short'}>
                        {enough ? '✓' : '○'} {itemById(id)?.name ?? id}{qty > 1 ? ` ×${qty}` : ''}
                      </span>
                    )
                  })}
                </span>
                <span className="recipe-effects">
                  {Object.entries(recipe.effects).map(([k, v]) => (
                    <span key={k} className="chip ok">+{v} {NEED_LABEL[k as keyof Needs]}</span>
                  ))}
                </span>
              </div>
              <div className="item-buy">
                <button className="btn small primary" disabled={!ready} onClick={() => cook(recipe.id)}>
                  {ready ? 'Cook' : missing.length ? 'Need items' : 'No kitchen'}
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      <button className="btn ghost kitchen-shop" onClick={() => openMarket('groceries')}>
        Buy groceries →
      </button>
    </section>
  )
}
