import { describe, expect, test } from 'vitest'
import { withoutPersistedToken } from './gameStore'

describe('session persistence boundary', () => {
  test('removes bearer tokens from the durable game save while preserving identity', () => {
    const state = {
      citizen: { citizenId: 'citizen-1', name: 'Ada', token: 'secret-token', online: true },
      money: 200_000,
    }
    const persisted = withoutPersistedToken(state)
    expect(persisted).toEqual({ citizen: { citizenId: 'citizen-1', name: 'Ada', online: false }, money: 200_000 })
    expect(JSON.stringify(persisted)).not.toContain('secret-token')
    expect(state.citizen.token).toBe('secret-token')
  })
})
