import { formatMoney } from '../../game/engine'
import type { MillionairePath } from '../../game/millionairePath'

export function millionaireEtaSummary(path: MillionairePath): string | null {
  if (path.stage === 'millionaire') return 'Path to $1M: reached · keep reinvesting'
  const pace = path.daysToMillionaire === null
    ? 'cashflow blocked'
    : `${path.daysToMillionaire}d at current pace`
  const advantage = path.communityAdvantage.dailyOpportunityValue > 0
    ? ` · ${path.communityAdvantage.label} +${formatMoney(path.communityAdvantage.dailyOpportunityValue)}/day`
    : ''
  return `Path to $1M: ${formatMoney(path.millionaireGap)} left · ${pace}${advantage}`
}
