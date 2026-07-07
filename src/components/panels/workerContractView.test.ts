import { describe, expect, test } from 'vitest'
import { activeWorkerContractViews, activeWorkerSummaryText, selectedWorkerHours, workerHourChoices } from './workerContractView'

describe('worker contract view helpers', () => {
  test('offers hour choices up to the worker daily cap', () => {
    expect(workerHourChoices(4)).toEqual([1, 2, 4])
    expect(workerHourChoices(6)).toEqual([1, 2, 4, 6])
    expect(workerHourChoices(8)).toEqual([1, 2, 4, 6, 8])
  })

  test('falls back to one hour when saved selection is not valid for that worker', () => {
    expect(selectedWorkerHours({ helper: 6 }, 'helper', 4)).toBe(1)
    expect(selectedWorkerHours({ helper: 2 }, 'helper', 4)).toBe(2)
  })

  test('summarizes active worker contracts with Workers Hall source, cost, and ETA', () => {
    const views = activeWorkerContractViews([{
      source: 'workers-hall',
      workerName: 'Local helper',
      paidUntil: 1_700_003_600_000,
      paidMinutes: 60,
      workedMinutes: 15,
      cost: 16,
    }], 1_700_000_900_000)

    expect(views).toEqual([{
      workerName: 'Local helper',
      sourceLabel: 'Workers Hall',
      paidText: '1h paid',
      progressText: '15m worked of 1h',
      costText: '$16',
      etaText: 'ends in 45m',
    }])
  })

  test('builds a compact active worker summary and omits finished contracts', () => {
    const summary = activeWorkerSummaryText([
      {
        source: 'workers-hall',
        workerName: 'Local helper',
        paidUntil: 1_700_003_600_000,
        paidMinutes: 60,
        workedMinutes: 15,
        cost: 16,
      },
      {
        source: 'workers-hall',
        workerName: 'Skilled builder',
        paidUntil: 1_700_003_600_000,
        paidMinutes: 60,
        workedMinutes: 60,
        cost: 28,
      },
    ], 1_700_000_900_000)

    expect(summary).toBe('1 worker active · Workers Hall: Local helper ends in 45m')
  })
})
