import type { AssetKind } from '../../game/types'

export function constructionMarkerView(name: string, resultKind: AssetKind, progressPercent: number) {
  const clampedProgress = Math.max(0, Math.min(100, progressPercent))
  const kindText = resultKind === 'business' ? 'business construction site' : 'home construction site'
  return {
    className: `map-construction ${resultKind}`,
    symbol: resultKind === 'business' ? '◆' : '⌂',
    title: `${name} ${kindText} — ${clampedProgress}% complete`,
    ariaLabel: `${name} ${kindText}, ${clampedProgress}% complete`,
    progressStyle: `${clampedProgress}%`,
  }
}
