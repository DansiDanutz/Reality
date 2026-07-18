import type { Advice, AdviceAction } from '../../game/engine'
import type { LifePlan, LifePlanTask } from '../../game/lifeLadder'

/**
 * One Voice — the referee between the game's two brains. The citizen's
 * advice ladder (adviceOf) is warm and urgent; the life planner
 * (planLifeDay) is the strategist behind Today and the 30-day journey.
 * When both spoke through different surfaces they could disagree ("work a
 * shift" vs "rest first"), and a player who catches the game contradicting
 * itself stops trusting the answer to "what next?".
 *
 * The rule: the citizen keeps his voice for what's URGENT (body, money
 * waiting, an activity in progress). For strategy — careers, purchases,
 * what to do with a free day — the guide speaks the plan, verbatim the
 * same task the Today card and journey show.
 */

export type GuideMessage =
  | { kind: 'advice'; text: string; action: AdviceAction; cta?: string }
  | { kind: 'plan'; text: string; cta: string; task: LifePlanTask }

/** Advice actions the citizen keeps: survival, collectable money, and the
 *  "I'm busy" lines during activities. Everything else defers to the plan. */
const URGENT_ADVICE = new Set(['drink', 'eat', 'sleep', 'collect', 'none'])

export function guideMessage(advice: Advice, plan: LifePlan | null): GuideMessage {
  if (!plan || URGENT_ADVICE.has(advice.action)) {
    return { kind: 'advice', text: advice.text, action: advice.action, cta: advice.cta }
  }
  const task = plan.primary
  return {
    kind: 'plan',
    text: `${task.title} — ${task.detail}`,
    cta: 'Do it',
    task,
  }
}
