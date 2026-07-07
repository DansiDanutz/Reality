import { describe, expect, test } from 'vitest'
import { founderCitizenIdentityBadge } from './founderCitizenIdentity'

describe('founderCitizenIdentityBadge', () => {
  test('marks Sim Citizens as simulated demo residents', () => {
    expect(founderCitizenIdentityBadge({
      displayName: 'Demo Food Resident (Sim)',
      participantLabel: 'Sim Citizen',
      visualTone: 'simulated',
      simulated: true,
    })).toEqual({
      label: 'Sim Citizen',
      simulated: true,
      className: 'founder-citizen-badge simulated',
      ariaLabel: 'Demo Food Resident (Sim) - Sim Citizen, simulated demo resident',
    })
  })

  test('keeps real citizens visually separate from simulated residents', () => {
    expect(founderCitizenIdentityBadge({
      displayName: 'David',
      participantLabel: 'Real Citizen',
      visualTone: 'real',
      simulated: false,
    })).toEqual({
      label: 'Real Citizen',
      simulated: false,
      className: 'founder-citizen-badge real',
      ariaLabel: 'David - Real Citizen',
    })
  })

  test('fails closed to simulated when server identity fields disagree', () => {
    expect(founderCitizenIdentityBadge({
      displayName: 'Imported Resident',
      participantLabel: 'Real Citizen',
      visualTone: 'simulated',
      simulated: false,
    })).toMatchObject({
      label: 'Sim Citizen',
      simulated: true,
      className: 'founder-citizen-badge simulated',
    })
  })
})
