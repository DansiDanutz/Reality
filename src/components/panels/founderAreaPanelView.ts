import { formatMoney } from '../../game/engine'
import type {
  AreaFounderCovenantDashboard,
  FounderCovenantActivityReview,
  FounderCovenantSignal,
} from '../../game/worldSim'

export type FounderCovenantReviewTone = 'stable' | 'warning' | 'critical'

export interface FounderCovenantReviewItem {
  key: string
  label: string
  value: string
  tone: FounderCovenantReviewTone
}

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

export function founderCovenantReviewItems(review: FounderCovenantActivityReview): FounderCovenantReviewItem[] {
  return [
    positiveFlag('active', 'Active', review.active),
    positiveFlag('useful', 'Useful', review.useful),
    positiveFlag('building', 'Building', review.building),
    positiveFlag('staffed', 'Staffed', review.staffed),
    riskFlag('indebted', 'Debt', review.indebted),
    riskFlag('hospitalized', 'Hospital', review.hospitalized),
    riskFlag('atRisk', 'At risk', review.atRisk),
  ]
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

function positiveFlag(key: string, label: string, on: boolean): FounderCovenantReviewItem {
  return {
    key,
    label,
    value: on ? 'yes' : 'no',
    tone: on ? 'stable' : 'warning',
  }
}

function riskFlag(key: string, label: string, on: boolean): FounderCovenantReviewItem {
  return {
    key,
    label,
    value: on ? 'yes' : 'no',
    tone: on ? 'critical' : 'stable',
  }
}
