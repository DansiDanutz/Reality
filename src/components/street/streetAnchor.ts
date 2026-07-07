import type { Citizen, PlacedAsset } from '../../game/types'

export interface StreetAnchor {
  lat: number
  lng: number
}

export function streetAnchorFor(citizen: Citizen | null, assets: PlacedAsset[]): StreetAnchor | null {
  const home = assets.find((asset) => asset.kind === 'home') ?? assets[0]
  if (home) return { lat: home.lat, lng: home.lng }
  if (citizen?.spawnLat !== undefined && citizen.spawnLng !== undefined) {
    return { lat: citizen.spawnLat, lng: citizen.spawnLng }
  }
  return null
}
