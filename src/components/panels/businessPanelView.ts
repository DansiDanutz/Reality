import type { ConstructionProject } from '../../game/construction'
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
