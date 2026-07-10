import { afterEach, describe, expect, test } from 'vitest'
import { ADVISOR_FEE } from '../game/catalog'
import { useGame } from './gameStore'

afterEach(() => {
  useGame.getState().reset()
})

describe('the paid advisor', () => {
  test('charges exactly the fee and logs the consultation', () => {
    useGame.setState({ money: 100, log: [], toasts: [] })

    const paid = useGame.getState().consultAdvisor()

    const state = useGame.getState()
    expect(paid).toBe(true)
    expect(state.money).toBe(100 - ADVISOR_FEE)
    expect(state.log.at(-1)).toContain('advisor')
  })

  test('refuses politely when the player cannot afford it — no money moves', () => {
    useGame.setState({ money: ADVISOR_FEE - 1, log: [], toasts: [] })

    const paid = useGame.getState().consultAdvisor()

    const state = useGame.getState()
    expect(paid).toBe(false)
    expect(state.money).toBe(ADVISOR_FEE - 1)
    expect(state.toasts.at(-1)?.tone).toBe('blocked')
  })
})
