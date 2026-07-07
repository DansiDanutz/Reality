import type { AssetKind } from '../../game/types'

export function constructionFinalStageView(
  planKind: AssetKind,
  activeProjectComplete: boolean,
  hasStarterHome: boolean,
): { className: string; label: string } {
  const ready = activeProjectComplete || (planKind === 'home' && hasStarterHome)
  return {
    className: ready ? 'chip gold' : 'chip',
    label: planKind === 'business' ? 'open' : 'inside',
  }
}
