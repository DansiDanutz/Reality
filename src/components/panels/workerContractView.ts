import { formatMoney } from '../../game/engine'
import type { WorkerContractSource } from '../../game/construction'

const WORKER_HOUR_CHOICES = [1, 2, 4, 6, 8]

export interface WorkerContractViewInput {
  source?: WorkerContractSource
  workerName: string
  paidUntil: number
  paidMinutes: number
  workedMinutes: number
  cost: number
}

export interface ActiveWorkerContractView {
  workerName: string
  sourceLabel: string
  paidText: string
  progressText: string
  costText: string
  etaText: string
}

export function workerHourChoices(maxHours: number): number[] {
  const cap = Math.max(1, Math.floor(maxHours))
  return WORKER_HOUR_CHOICES.filter((hours) => hours <= cap)
}

export function selectedWorkerHours(selection: Record<string, number>, workerId: string, maxHours: number): number {
  const choices = workerHourChoices(maxHours)
  const selected = selection[workerId]
  return choices.includes(selected) ? selected : choices[0]
}

export function workerCommunityCreditText(creditMinutes = 0, creditValue = 0): string {
  if (creditMinutes <= 0 || creditValue <= 0) return ''
  return `${formatMinutes(creditMinutes)} community help (${formatMoney(creditValue)})`
}

function formatMinutes(minutes: number): string {
  const rounded = Math.max(0, Math.round(minutes))
  const h = Math.floor(rounded / 60)
  const m = rounded % 60
  if (h <= 0) return `${m}m`
  if (m <= 0) return `${h}h`
  return `${h}h ${m}m`
}

function workerSourceLabel(source: WorkerContractSource | undefined): string {
  if (source === 'workers-hall') return 'Workers Hall'
  return 'Workers Hall'
}

function activeMinutesRemaining(contract: WorkerContractViewInput, now: number): number {
  const paidRemaining = Math.max(0, Math.ceil(contract.paidMinutes - contract.workedMinutes))
  const clockRemaining = Math.max(0, Math.ceil((contract.paidUntil - now) / 60_000))
  return Math.min(paidRemaining, clockRemaining)
}

export function activeWorkerContractViews(
  contracts: readonly WorkerContractViewInput[] = [],
  now = Date.now(),
): ActiveWorkerContractView[] {
  return contracts
    .filter((contract) => contract.workedMinutes < contract.paidMinutes)
    .map((contract) => {
      const remaining = activeMinutesRemaining(contract, now)
      const worked = Math.min(contract.paidMinutes, Math.max(0, contract.workedMinutes))
      return {
        workerName: contract.workerName,
        sourceLabel: workerSourceLabel(contract.source),
        paidText: `${formatMinutes(contract.paidMinutes)} paid`,
        progressText: `${formatMinutes(worked)} worked of ${formatMinutes(contract.paidMinutes)}`,
        costText: formatMoney(contract.cost),
        etaText: remaining > 0 ? `ends in ${formatMinutes(remaining)}` : 'ending now',
      }
    })
}

export function activeWorkerSummaryText(
  contracts: readonly WorkerContractViewInput[] = [],
  now = Date.now(),
): string | null {
  const views = activeWorkerContractViews(contracts, now)
  if (views.length <= 0) return null
  const first = views[0]
  const count = `${views.length} worker${views.length === 1 ? '' : 's'} active`
  return `${count} · ${first.sourceLabel}: ${first.workerName} ${first.etaText}`
}
