import type { WorldParticipantLabel, WorldParticipantVisualTone } from '../../game/worldSim'

export interface FounderCitizenIdentitySource {
  displayName: string
  participantLabel: WorldParticipantLabel
  visualTone: WorldParticipantVisualTone
  simulated: boolean
}

export interface FounderCitizenIdentityBadge {
  label: WorldParticipantLabel
  className: string
  ariaLabel: string
  simulated: boolean
}

export function founderCitizenIdentityBadge(citizen: FounderCitizenIdentitySource): FounderCitizenIdentityBadge {
  const simulated = citizen.simulated || citizen.visualTone === 'simulated' || citizen.participantLabel === 'Sim Citizen'
  const label: WorldParticipantLabel = simulated ? 'Sim Citizen' : 'Real Citizen'
  return {
    label,
    simulated,
    className: `founder-citizen-badge ${simulated ? 'simulated' : 'real'}`,
    ariaLabel: simulated
      ? `${citizen.displayName} - Sim Citizen, simulated demo resident`
      : `${citizen.displayName} - Real Citizen`,
  }
}
