export interface HealthPolicyNeeds {
  hunger: number
  hydration: number
  energy: number
}

export const HEALTH_DEHYDRATION_DAMAGE_PER_HOUR = 6
export const HEALTH_NEGLECT_DAMAGE_PER_HOUR = 3
export const HEALTH_RECOVERY_PER_HOUR = 2

/** The single server/client health law used by every simulation adapter. */
export function advanceHealth(health: number, needs: HealthPolicyNeeds, hours: number): number {
  const span = Math.max(0, hours)
  if (needs.hydration <= 0) return clampHealth(health - HEALTH_DEHYDRATION_DAMAGE_PER_HOUR * span)
  if (needs.hunger <= 0 || needs.energy <= 0) return clampHealth(health - HEALTH_NEGLECT_DAMAGE_PER_HOUR * span)
  if (needs.hunger > 60 && needs.energy > 60 && needs.hydration > 50) {
    return clampHealth(health + HEALTH_RECOVERY_PER_HOUR * span)
  }
  return clampHealth(health)
}

function clampHealth(value: number): number {
  return Math.min(100, Math.max(0, value))
}
