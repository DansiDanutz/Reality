import { missedSeriousWorkYesterday, type CommunityStats } from '../../game/community'
import { educationActionCount } from '../../game/education'
import type { Activity } from '../../game/engine'
import { lifeDayFromCreatedAt, type LifeLadderSnapshot, type LifePlanRoute } from '../../game/lifeLadder'
import { dispatchLifePlanRoute } from './goalsCardActions'
import { useGame } from '../../store/gameStore'

/**
 * ONE way to feed the life planner. Four surfaces consume planLifeDay /
 * planLifeRoadmap (guide bar, goals card, advisor, journey) — when each
 * assembled its own 20-field snapshot by hand, a missed field meant the
 * surfaces quietly disagreed (that's exactly how the helper-credit
 * double-spend slipped in). Every consumer now maps state through here.
 */

export interface LifePlanStateSlice {
  citizen: { createdAt: number } | null
  money: number
  needs: LifeLadderSnapshot['needs']
  health: number
  level: number
  xp: number
  jobId: string | null
  shiftsWorked: number
  activity: Activity | null
  assets: LifeLadderSnapshot['assets']
  inventory: Record<string, number>
  resources: LifeLadderSnapshot['resources']
  constructionProjects: LifeLadderSnapshot['constructionProjects']
  businessDevelopmentProjects: LifeLadderSnapshot['businessDevelopmentProjects']
  educationProgress: LifeLadderSnapshot['educationProgress']
  community: CommunityStats
}

export function lifeLadderSnapshotOf(s: LifePlanStateSlice): LifeLadderSnapshot | null {
  if (!s.citizen) return null
  return {
    lifeDay: lifeDayFromCreatedAt(s.citizen.createdAt),
    money: s.money,
    needs: s.needs,
    health: s.health,
    level: s.level,
    xp: s.xp,
    jobId: s.jobId,
    shiftsWorked: s.shiftsWorked,
    activityKind: (s.activity?.kind ?? null) as LifeLadderSnapshot['activityKind'],
    assets: s.assets,
    inventory: s.inventory,
    resources: s.resources,
    constructionProjects: s.constructionProjects,
    businessDevelopmentProjects: s.businessDevelopmentProjects,
    educationActions: educationActionCount(s.educationProgress),
    educationProgress: s.educationProgress,
    communityActionsThisWeek: s.community.actionsThisWeek,
    communityActionsToday: s.community.actionsToday,
    communityRespect: s.community.respect,
    communityFriendship: s.community.friendship,
    communityTrust: s.community.trust,
    brokenCommitments: s.community.brokenCommitments,
    communityHelperMinutesUsedThisWeek: s.community.helperMinutesUsedThisWeek,
    seriousWorkMissedYesterday: missedSeriousWorkYesterday(s.community),
  }
}

/** Run a life-plan route against the live store — the one dispatcher every
 *  "do it" button shares (guide bar, goals card, journey). */
export function runLifePlanRoute(route: LifePlanRoute): void {
  const s = useGame.getState()
  dispatchLifePlanRoute(route, {
    resourceNodes: s.resourceNodes,
    openMarket: s.openMarket,
    selectMapTarget: s.selectMapTarget,
    setPanel: s.setPanel,
    startGatherResource: s.startGatherResource,
    depositConstructionResources: s.depositConstructionResources,
    payConstructionPermit: s.payConstructionPermit,
    startConstructionWork: s.startConstructionWork,
    hireConstructionWorker: s.hireConstructionWorker,
    completeConstructionIfReady: s.completeConstructionIfReady,
    depositBusinessDevelopmentResources: s.depositBusinessDevelopmentResources,
    payBusinessDevelopmentBudget: s.payBusinessDevelopmentBudget,
    startBusinessDevelopmentWork: s.startBusinessDevelopmentWork,
    hireBusinessDevelopmentWorker: s.hireBusinessDevelopmentWorker,
    completeBusinessDevelopmentIfReady: s.completeBusinessDevelopmentIfReady,
    startShift: s.startShift,
    startCommunityAction: s.startCommunityAction,
    startStudy: s.startStudy,
    consume: s.consume,
    cook: s.cook,
    quickDrink: s.quickDrink,
    startSleep: s.startSleep,
  })
}
