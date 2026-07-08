import { workersHallActionFor } from '../../game/workersHall'
import type { MapTarget, PanelId } from '../../store/gameStore'

interface WorkersHallMapState {
  constructionProjects: Parameters<typeof workersHallActionFor>[0]['constructionProjects']
  businessDevelopmentProjects: Parameters<typeof workersHallActionFor>[0]['businessDevelopmentProjects']
  selectMapTarget: (target: MapTarget | null) => void
  setPanel: (panel: PanelId) => void
}

export function openWorkersHallFromMap(state: WorkersHallMapState): void {
  const action = workersHallActionFor(state)
  state.selectMapTarget(action.target)
  state.setPanel(action.panel)
}
