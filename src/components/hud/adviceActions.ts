import type { AdviceAction } from '../../game/engine'
import { useGame } from '../../store/gameStore'

/**
 * Turn a guide advice action into the actual game move. Shared by the
 * desktop guide card (MoodCard) and the mobile guide bar (ActionDock),
 * so "the guide's button always does what it says" holds on every screen.
 */
export function runAdviceAction(action: AdviceAction): void {
  const s = useGame.getState()
  switch (action) {
    case 'drink':
      s.quickDrink()
      break
    case 'eat':
      s.openMarket('food')
      break
    case 'sleep':
      s.startSleep()
      break
    case 'find-job':
      s.setPanel('work')
      break
    case 'start-shift':
      if (s.jobId) s.startShift()
      else s.setPanel('work')
      break
    case 'leisure':
      s.openMarket('leisure')
      break
    case 'collect':
      s.collectIncome()
      break
    case 'buy-home':
      s.openMarket('home')
      break
    case 'buy-business':
      s.openMarket('business')
      break
  }
}
