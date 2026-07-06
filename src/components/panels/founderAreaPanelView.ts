import { formatMoney } from '../../game/engine'
import type {
  AreaFounderCovenantDashboard,
  FounderCovenantSignal,
} from '../../game/worldSim'

export function founderCovenantStatusLabel(status: AreaFounderCovenantDashboard['status']): string {
  switch (status) {
    case 'unclaimed':
      return 'Unclaimed'
    case 'active':
      return 'Active'
    case 'watch':
      return 'Watch'
    case 'manual_review':
      return 'Manual review'
  }
}

export function founderCovenantTone(status: AreaFounderCovenantDashboard['status']): 'stable' | 'warning' | 'critical' {
  if (status === 'manual_review') return 'critical'
  if (status === 'watch' || status === 'unclaimed') return 'warning'
  return 'stable'
}

export function founderCovenantSignalText(signal: FounderCovenantSignal): string {
  switch (signal.kind) {
    case 'founder_unavailable':
      return 'Founder unavailable'
    case 'no_business_built':
      return 'No business built'
    case 'understaffed_businesses':
      return `Understaffed: ${signal.businessIds?.join(', ') ?? 'businesses'}`
    case 'essential_shortage':
      return `Shortage: ${signal.businessKinds?.join(', ') ?? 'essential services'}`
    case 'founder_debt':
      return `Founder debt: ${formatMoney(signal.amount ?? 0)}`
  }
}
