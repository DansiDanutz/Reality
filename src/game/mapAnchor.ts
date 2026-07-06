import type { Citizen, PlacedAsset } from './types'

export interface MapAnchor {
  lat: number
  lng: number
}

export const DEFAULT_MAP_ANCHOR: MapAnchor = {
  lat: 44.45,
  lng: 26.08,
}

export function ownedMapAnchorFor(citizen: Citizen | null, assets: PlacedAsset[]): MapAnchor | null {
  const home = assets.find((asset) => asset.kind === 'home') ?? assets[0]
  if (home) return { lat: home.lat, lng: home.lng }
  if (citizen?.spawnLat !== undefined && citizen.spawnLng !== undefined) {
    return { lat: citizen.spawnLat, lng: citizen.spawnLng }
  }
  return null
}

export function playableMapAnchorFor(citizen: Citizen | null, assets: PlacedAsset[]): MapAnchor | null {
  return ownedMapAnchorFor(citizen, assets) ?? (citizen ? DEFAULT_MAP_ANCHOR : null)
}
