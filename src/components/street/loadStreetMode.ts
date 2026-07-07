let streetModeModule: Promise<typeof import('./StreetMode')> | null = null
let streetSceneModule: Promise<typeof import('./streetScene')> | null = null

export function loadStreetMode() {
  streetModeModule ??= import('./StreetMode')
  return streetModeModule
}

export function loadStreetScene() {
  streetSceneModule ??= import('./streetScene')
  return streetSceneModule
}

export function preloadStreetMode() {
  void loadStreetMode()
  void loadStreetScene()
}
