import { describe, expect, test } from 'vitest'
import { selectedWorkerHours, workerHourChoices } from './workerContractView'

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
})
