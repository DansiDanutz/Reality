import type { ConstructionProject } from '../../game/construction'
import { itemById } from '../../game/catalog'
import type { PlacedAsset } from '../../game/types'
import type { MapTarget } from '../../store/gameStore'

export function activeBusinessConstructionProject(
  projects: readonly ConstructionProject[],
  selectedMapTarget: MapTarget | null,
): ConstructionProject | null {
  const selected = selectedMapTarget?.kind === 'construction'
    ? projects.find((project) => project.id === selectedMapTarget.id && project.resultKind === 'business') ?? null
    : null
  return selected ?? projects.find((project) => project.resultKind === 'business') ?? null
}

export function selectedCompletedBusiness(assets: readonly PlacedAsset[], selectedMapTarget: MapTarget | null): PlacedAsset | null {
  return (
    selectedMapTarget?.kind === 'asset'
      ? assets.find((asset) => asset.id === selectedMapTarget.id && asset.kind === 'business')
      : null
  ) ?? assets.find((asset) => asset.kind === 'business') ?? null
}

export interface EmptyBusinessPanelView {
  kind: 'empty'
  title: string
  detail: string
}

export interface BusinessConstructionPanelView {
  kind: 'construction'
  project: ConstructionProject
  title: string
  detail: string
  mapTarget: MapTarget
}

export interface CompletedBusinessPanelView {
  kind: 'interior'
  business: PlacedAsset
  description: string
  mapTarget: MapTarget
}

export type BusinessPanelView = EmptyBusinessPanelView | BusinessConstructionPanelView | CompletedBusinessPanelView

export function businessPanelView(
  assets: readonly PlacedAsset[],
  projects: readonly ConstructionProject[],
  selectedMapTarget: MapTarget | null,
): BusinessPanelView {
  const selectedBusinessConstruction = selectedMapTarget?.kind === 'construction'
    ? projects.find((project) => project.id === selectedMapTarget.id && project.resultKind === 'business') ?? null
    : null

  if (selectedBusinessConstruction) {
    return {
      kind: 'construction',
      project: selectedBusinessConstruction,
      title: selectedBusinessConstruction.name,
      detail: 'This business is still a building site. Finish materials, permit, and labor before the inside can open.',
      mapTarget: { kind: 'construction', id: selectedBusinessConstruction.id },
    }
  }

  const business = selectedCompletedBusiness(assets, selectedMapTarget)
  if (business) {
    const item = itemById(business.itemId)
    return {
      kind: 'interior',
      business,
      description: item?.description ?? 'A working building on your map.',
      mapTarget: { kind: 'asset', id: business.id },
    }
  }

  const firstBusinessConstruction = activeBusinessConstructionProject(projects, selectedMapTarget)
  if (firstBusinessConstruction) {
    return {
      kind: 'construction',
      project: firstBusinessConstruction,
      title: firstBusinessConstruction.name,
      detail: 'This business is still a building site. Finish materials, permit, and labor before the inside can open.',
      mapTarget: { kind: 'construction', id: firstBusinessConstruction.id },
    }
  }

  return {
    kind: 'empty',
    title: 'Business',
    detail: 'No finished business yet. Buy a business, place its foundation, then build it from resources.',
  }
}
