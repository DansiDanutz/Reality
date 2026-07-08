import { itemById } from '../../game/catalog'
import { formatMoney } from '../../game/engine'
import type { PlacedAsset } from '../../game/types'
import type { MapTarget, PanelId } from '../../store/gameStore'

export interface EmptyHousePanelView {
  kind: 'empty'
  title: string
  detail: string
  action: { label: string; panel: PanelId }
}

export interface HouseBenefitView {
  id: 'sleep' | 'kitchen' | 'storage'
  title: string
  detail: string
}

export interface CompletedHousePanelView {
  kind: 'interior'
  home: PlacedAsset
  description: string
  marketValueText: string
  mapPositionText: string
  dailyIncomeText: string
  benefits: HouseBenefitView[]
  mapTarget: MapTarget
}

export type HousePanelView = EmptyHousePanelView | CompletedHousePanelView

export function selectedCompletedHome(assets: readonly PlacedAsset[], selectedMapTarget: MapTarget | null): PlacedAsset | null {
  return (
    selectedMapTarget?.kind === 'asset'
      ? assets.find((asset) => asset.id === selectedMapTarget.id && asset.kind === 'home')
      : null
  ) ?? assets.find((asset) => asset.kind === 'home') ?? null
}

export function housePanelView(assets: readonly PlacedAsset[], selectedMapTarget: MapTarget | null): HousePanelView {
  const home = selectedCompletedHome(assets, selectedMapTarget)
  if (!home) {
    return {
      kind: 'empty',
      title: 'House',
      detail: 'No finished home yet. Place a foundation, gather the ingredients, and finish the build first.',
      action: { label: 'Open build plan', panel: 'construction' },
    }
  }

  const item = itemById(home.itemId)
  return {
    kind: 'interior',
    home,
    description: item?.description ?? 'Your own door on the map.',
    marketValueText: formatMoney(item?.price ?? 0),
    mapPositionText: `${home.lat.toFixed(2)}°, ${home.lng.toFixed(2)}°`,
    dailyIncomeText: `${formatMoney(home.incomePerDay)}/day`,
    benefits: [
      {
        id: 'sleep',
        title: 'Bedroom',
        detail: 'Sleep at home for the full rest benefit.',
      },
      {
        id: 'kitchen',
        title: 'Kitchen',
        detail: 'Cook groceries into better meals.',
      },
      {
        id: 'storage',
        title: 'Storage',
        detail: 'Your assets and future upgrades live here.',
      },
    ],
    mapTarget: { kind: 'asset', id: home.id },
  }
}
