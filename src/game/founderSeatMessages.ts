import { CITIZEN_BALANCE, FOUNDER_BALANCE, FOUNDER_SLOTS } from './catalog'
import { formatMoney } from './engine'

export function founderSeatGrantedLog(founderNumber: number): string {
  return `Founder #${String(founderNumber).padStart(4, '0')} - operating seat active under the Founder Covenant. ${formatMoney(FOUNDER_BALANCE)} game-only credits deposited.`
}

export function citizenGrantLog(): string {
  return `All ${FOUNDER_SLOTS.toLocaleString()} founder seats are claimed. Citizen grant: ${formatMoney(CITIZEN_BALANCE)} game-only credits.`
}
