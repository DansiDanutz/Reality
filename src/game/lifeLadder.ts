import {
  educationCourseById,
  educationRemainingMinutes,
  nextStudyBlockMinutes,
  type EducationCourse,
  type EducationCourseId,
  type EducationProgress,
} from './education'
import { jobById, RECIPES, SHOP_ITEMS } from './catalog'
import {
  businessDevelopmentLaborBreakdown,
  businessDevelopmentProgress,
  businessDevelopmentShortfall,
  estimateBusinessDevelopmentWorkerHire,
  type BusinessDevelopmentProject,
} from './businessDevelopment'
import {
  CONSTRUCTION_WORKERS,
  STARTER_HOUSE_RECIPE,
  businessConstructionRecipe,
  constructionLaborBreakdown,
  constructionProgress,
  constructionShortfall,
  createConstructionProjectFromRecipe,
  estimateConstructionWorkerHire,
  type ConstructionProject,
} from './construction'
import type { CommunityActionId } from './community'
import { communityAdvantageOf, millionairePathOf, type MillionairePath } from './millionairePath'
import { RESOURCE_KINDS, RESOURCE_META, type ResourceInventory, type ResourceKind, freshResources } from './resources'
import type { AssetKind, Needs, PlacedAsset, ShopCategory } from './types'

export type LifeValue = 'body' | 'school' | 'work' | 'respect' | 'friendship' | 'community' | 'capital'

export type ConstructionPlanAction = 'deposit' | 'permit' | 'work' | 'hire-helper' | 'complete'
export type BusinessDevelopmentPlanAction = 'deposit' | 'budget' | 'work' | 'hire-helper' | 'complete'
export type LifePlanMapTarget =
  | { kind: 'construction'; id: string }
  | { kind: 'asset'; id: string }

export type LifePlanRoute =
  | { kind: 'panel'; panel: 'work' | 'construction' | 'assets' | 'home' | 'business' | 'achievements'; target?: LifePlanMapTarget }
  | { kind: 'market'; focus: ShopCategory }
  | { kind: 'gather'; resourceKind: ResourceKind }
  | { kind: 'construction-action'; projectId: string; action: ConstructionPlanAction; hours?: number; resultKind?: AssetKind }
  | { kind: 'business-development-action'; projectId: string; action: BusinessDevelopmentPlanAction; hours?: number }
  | { kind: 'work-action'; action: 'shift' }
  | { kind: 'community-action'; actionId: CommunityActionId }
  | { kind: 'education-action'; courseId: EducationCourseId }
  | { kind: 'consume-action'; itemId: string }
  | { kind: 'cook-action'; recipeId: string }
  | { kind: 'survival-action'; action: 'drink-water' | 'sleep' }
  | { kind: 'none' }

export interface LifePlanTask {
  id: string
  title: string
  detail: string
  value: LifeValue
  minutes: number
  route: LifePlanRoute
}

export interface LifeRoutineBlock {
  id: string
  title: string
  detail: string
  value: LifeValue
  minutes: number
  route: LifePlanRoute
  taskId?: string
}

export interface LifeTimeBudget {
  sleepMinutes: number
  workMinutes: number
  bodyMinutes: number
  adminCommunityMinutes: number
  flexibleMinutes: number
}

export interface ResourceTripForecast {
  kind: ResourceKind
  missing: number
  trips: number
  minutes: number
}

export interface ConstructionDayForecast {
  upfrontCostRemaining: number
  upfrontCashNeeded: number
  upfrontAffordableToday: boolean
  permitRemaining: number
  permitCashNeeded: number
  permitAffordableToday: boolean
  remainingLaborMinutes: number
  playerOnlyDaysAtOneHour: number
  playerOnlyDaysAtTwoHours: number
  playerOnlyCompletionLifeDay: number
  helperTwoHourDays: number
  helperTwoHourCompletionLifeDay: number
  helperTwoHourLaborMinutes: number
  helperTwoHourCost: number
  helperTwoHourAffordableToday: boolean
  helperTwoHourCashNeeded: number
  activeWorkerCount: number
  activeWorkerPaidMinutesRemaining: number
  activeWorkerLaborMinutesRemaining: number
  activeWorkerCompletionLifeDay: number
  resourceTrips: ResourceTripForecast[]
  totalGatherMinutes: number
}

export interface BusinessDevelopmentDayForecast {
  budgetRemaining: number
  budgetAffordableToday: boolean
  budgetCashNeeded: number
  remainingLaborMinutes: number
  playerOnlyDaysAtOneHour: number
  playerOnlyDaysAtTwoHours: number
  playerOnlyCompletionLifeDay: number
  helperTwoHourDays: number
  helperTwoHourCompletionLifeDay: number
  helperTwoHourLaborMinutes: number
  helperTwoHourCost: number
  helperTwoHourAffordableToday: boolean
  helperTwoHourCashNeeded: number
  activeWorkerCount: number
  activeWorkerPaidMinutesRemaining: number
  activeWorkerLaborMinutesRemaining: number
  activeWorkerCompletionLifeDay: number
  resourceTrips: ResourceTripForecast[]
  totalGatherMinutes: number
}

export interface LifePlan {
  lifeDay: number
  primary: LifePlanTask
  agenda: LifePlanTask[]
  support: LifePlanTask[]
  routine: LifeRoutineBlock[]
  valuesCovered: LifeValue[]
  timeBudget: LifeTimeBudget
  constructionForecast: ConstructionDayForecast | null
  businessDevelopmentForecast: BusinessDevelopmentDayForecast | null
  millionairePath: MillionairePath
  millionaireTask: LifePlanTask
}

export type LifeLadderAsset = Pick<PlacedAsset, 'kind' | 'incomePerDay'> & Partial<PlacedAsset>

export interface LifeLadderSnapshot {
  lifeDay: number
  money: number
  needs: Needs
  health: number
  level: number
  xp: number
  jobId: string | null
  shiftsWorked: number
  activityKind: 'sleep' | 'shift' | 'cook' | 'gather' | 'construction' | 'study' | 'community' | 'business-development' | null
  assets: LifeLadderAsset[]
  inventory: Record<string, number>
  resources: ResourceInventory
  constructionProjects: ConstructionProject[]
  businessDevelopmentProjects: BusinessDevelopmentProject[]
  educationActions: number
  educationProgress: EducationProgress[]
  communityActionsThisWeek: number
  communityActionsToday: number
  communityRespect: number
  communityFriendship: number
  communityTrust: number
  communityHelperMinutesUsedThisWeek?: number
  seriousWorkMissedYesterday?: boolean
}

export const STANDARD_DAY_BUDGET: LifeTimeBudget = {
  sleepMinutes: 8 * 60,
  workMinutes: 8 * 60,
  bodyMinutes: 60,
  adminCommunityMinutes: 60,
  flexibleMinutes: 6 * 60,
}

const NEED_RECOVERY_FLOOR = 35
const CASH_SAFETY_FLOOR = 100
const PREFERRED_HELPER_HOURS = 2

function firstBusinessItem() {
  return SHOP_ITEMS
    .filter((item) => item.category === 'business' && item.placeable && (item.incomePerDay ?? 0) > 0)
    .sort((a, b) => a.price - b.price)[0] ?? null
}

function firstBusinessShellProject(now = 0): { item: NonNullable<ReturnType<typeof firstBusinessItem>>; project: ConstructionProject } | null {
  const item = firstBusinessItem()
  if (!item) return null
  return {
    item,
    project: createConstructionProjectFromRecipe(businessConstructionRecipe(item), 0, 0, now),
  }
}

function task(id: string, title: string, detail: string, value: LifeValue, route: LifePlanRoute, minutes: number): LifePlanTask {
  return { id, title, detail, value, route, minutes }
}

function routineBlock(
  id: string,
  title: string,
  detail: string,
  value: LifeValue,
  route: LifePlanRoute,
  minutes: number,
  taskId?: string,
): LifeRoutineBlock {
  return { id, title, detail, value, route, minutes, taskId }
}

export function lifeDayFromCreatedAt(createdAt: number, now = Date.now()): number {
  if (!Number.isFinite(createdAt) || createdAt <= 0) return 1
  return Math.max(1, Math.floor(Math.max(0, now - createdAt) / 86_400_000) + 1)
}

function lowestNeed(needs: Needs): keyof Needs {
  const entries = Object.entries(needs) as [keyof Needs, number][]
  return entries.reduce((lowest, current) => current[1] < lowest[1] ? current : lowest)[0]
}

function marketFocusForNeed(need: keyof Needs): ShopCategory {
  if (need === 'hydration') return 'drinks'
  if (need === 'hunger') return 'food'
  if (need === 'hygiene' || need === 'fun') return 'leisure'
  return 'health'
}

function hasCookingAccess(snapshot: Pick<LifeLadderSnapshot, 'assets' | 'inventory'>): boolean {
  return snapshot.assets.some((asset) => asset.kind === 'home') ||
    ['hotplate', 'kitchen'].some((id) => (snapshot.inventory[id] ?? 0) > 0)
}

function readyRecipe(snapshot: Pick<LifeLadderSnapshot, 'assets' | 'inventory'>): { id: string; hunger: number } | null {
  if (!hasCookingAccess(snapshot)) return null
  return RECIPES
    .filter((recipe) => Object.entries(recipe.ingredients).every(([id, qty]) => (snapshot.inventory[id] ?? 0) >= qty))
    .map((recipe) => ({ id: recipe.id, hunger: recipe.effects.hunger ?? 0 }))
    .filter((recipe) => recipe.hunger > 0)
    .sort((a, b) => b.hunger - a.hunger)[0] ?? null
}

function bodyRecoveryTask(snapshot: LifeLadderSnapshot): LifePlanTask | null {
  if (snapshot.health < 40) {
    return task('body-recover', 'Recover your body first', 'Health is low. Drink, eat, and rest before chasing money.', 'body', { kind: 'market', focus: 'health' }, 60)
  }
  if (snapshot.needs.hydration <= NEED_RECOVERY_FLOOR) {
    return task('drink-water', 'Drink water', 'Hydration is the fastest survival risk. Fix it before work or construction.', 'body', { kind: 'survival-action', action: 'drink-water' }, 5)
  }
  if (snapshot.needs.hunger <= NEED_RECOVERY_FLOOR) {
    const ownedFood = strongestOwnedFood(snapshot.inventory)
    const recipe = ownedFood ? null : readyRecipe(snapshot)
    return task(
      'eat-food',
      'Eat a real meal',
      'Food keeps the workday and construction day possible.',
      'body',
      ownedFood
        ? { kind: 'consume-action', itemId: ownedFood.id }
        : recipe
          ? { kind: 'cook-action', recipeId: recipe.id }
          : { kind: 'market', focus: 'food' },
      20,
    )
  }
  if (snapshot.needs.energy <= 30) {
    return task('sleep-tonight', 'Sleep before pushing harder', 'Energy is too low for serious work. Rest protects tomorrow.', 'body', { kind: 'survival-action', action: 'sleep' }, STANDARD_DAY_BUDGET.sleepMinutes)
  }
  return null
}

function firstMissingResource(project: ConstructionProject, resources: ResourceInventory): ResourceKind | null {
  const missing = constructionShortfall(project)
  return RESOURCE_KINDS.find((kind) => missing[kind] > 0 && resources[kind] < missing[kind])
    ?? null
}

function firstMissingBusinessResource(project: BusinessDevelopmentProject, resources: ResourceInventory): ResourceKind | null {
  const missing = businessDevelopmentShortfall(project)
  return RESOURCE_KINDS.find((kind) => missing[kind] > 0 && resources[kind] < missing[kind])
    ?? null
}

function gatherResourceDetail(subject: string, kind: ResourceKind, missing: number, owned: number): string {
  const label = RESOURCE_META[kind].label.toLowerCase()
  const needed = Math.max(0, missing)
  const available = Math.max(0, owned)
  const remaining = Math.max(0, needed - available)
  if (available > 0) {
    return `${subject} still needs ${needed} ${label}. You have ${available}; gather ${remaining} more locally, then deposit it.`
  }
  return `${subject} still needs ${needed} ${label}. Gather ${remaining} locally, then deposit it.`
}

function moneyText(amount: number): string {
  return `$${Math.max(0, Math.ceil(amount)).toLocaleString()}`
}

function cashGapDetail(costLabel: string, cost: number, money: number, purpose: string): string {
  const needed = Math.max(0, cost + CASH_SAFETY_FLOOR - money)
  return `${costLabel} costs ${moneyText(cost)} plus ${moneyText(CASH_SAFETY_FLOOR)} safety cash. You have ${moneyText(money)}, so earn ${moneyText(needed)} before ${purpose}.`
}

function minutesText(minutes: number): string {
  const whole = Math.max(0, Math.ceil(minutes))
  const h = Math.floor(whole / 60)
  const m = whole % 60
  if (h <= 0) return `${m}m`
  if (m <= 0) return `${h}h`
  return `${h}h ${m}m`
}

function workerHireDetail(input: {
  ratePerHour: number
  cost: number
  hours: number
  laborMinutes: number
  remainingMinutes: number
  place: 'site' | 'interior'
}): string {
  const placeText = input.place === 'interior' ? 'inside' : 'on site'
  return `Workers Hall help costs ${moneyText(input.cost)} total for ${input.hours}h (${moneyText(input.ratePerHour)}/hour) and adds ${minutesText(input.laborMinutes)} ${placeText} against ${minutesText(input.remainingMinutes)} remaining.`
}

function activeWorkerLaborRemaining(
  remainingLaborMinutes: number,
  contracts: { paidMinutes: number; workedMinutes: number; laborMultiplier: number }[] = [],
): number {
  return Math.min(
    remainingLaborMinutes,
    contracts
      .filter((contract) => contract.workedMinutes < contract.paidMinutes)
      .reduce(
        (sum, contract) => sum + Math.max(0, contract.paidMinutes - contract.workedMinutes) * Math.max(0, contract.laborMultiplier),
        0,
      ),
  )
}

function affordableConstructionHelperEstimate(project: ConstructionProject, money: number, communityCreditMinutes = 0) {
  const remaining = constructionLaborBreakdown(project).remainingMinutes
  const preferredHours = remaining > 60 ? PREFERRED_HELPER_HOURS : 1
  const estimates = [
    estimateConstructionWorkerHire(project, 'helper', preferredHours, communityCreditMinutes),
    preferredHours > 1 ? estimateConstructionWorkerHire(project, 'helper', 1, communityCreditMinutes) : null,
  ]
  return estimates.find((estimate) =>
    estimate &&
    estimate.blockedBy === null &&
    estimate.laborMinutes > 0 &&
    money >= estimate.cost + CASH_SAFETY_FLOOR
  ) ?? null
}

function affordableBusinessHelperEstimate(project: BusinessDevelopmentProject, money: number, communityCreditMinutes = 0) {
  const remaining = businessDevelopmentLaborBreakdown(project).remainingMinutes
  const preferredHours = remaining > 60 ? PREFERRED_HELPER_HOURS : 1
  const estimates = [
    estimateBusinessDevelopmentWorkerHire(project, 'helper', preferredHours, communityCreditMinutes),
    preferredHours > 1 ? estimateBusinessDevelopmentWorkerHire(project, 'helper', 1, communityCreditMinutes) : null,
  ]
  return estimates.find((estimate) =>
    estimate &&
    estimate.blockedBy === null &&
    estimate.laborMinutes > 0 &&
    money >= estimate.cost + CASH_SAFETY_FLOOR
  ) ?? null
}

function activeConstructionProject(snapshot: LifeLadderSnapshot): ConstructionProject | null {
  const hasHome = snapshot.assets.some((asset) => asset.kind === 'home')
  const homeProject = snapshot.constructionProjects.find((candidate) => candidate.resultKind === 'home') ?? null
  if (!hasHome) return homeProject
  return snapshot.constructionProjects[0] ?? null
}

function constructionPrimary(snapshot: LifeLadderSnapshot): LifePlanTask | null {
  const hasHome = snapshot.assets.some((asset) => asset.kind === 'home')
  const project = activeConstructionProject(snapshot)
  if (!project) {
    if (hasHome) return null
    return task('place-home-foundation', 'Place your Starter House foundation', 'A serious life needs a door. Pick a reachable map spot near home.', 'capital', { kind: 'panel', panel: 'construction' }, 30)
  }

  const isBusinessBuild = project.resultKind === 'business'
  const target = isBusinessBuild ? 'business' : 'house'
  const targetLabel = isBusinessBuild ? project.name : 'house'
  const progress = constructionProgress(project)
  if (!progress.resourcesComplete) {
    const kind = firstMissingResource(project, snapshot.resources)
    if (!kind) {
      return task(
        isBusinessBuild ? 'deposit-business-building-materials' : 'deposit-house-materials',
        isBusinessBuild ? `Deposit ${project.name} materials` : 'Deposit house materials',
        `Move gathered ingredients into the ${targetLabel} foundation so the build can advance.`,
        'capital',
        { kind: 'construction-action', projectId: project.id, action: 'deposit' },
        15,
      )
    }
    const meta = RESOURCE_META[kind]
    const missing = constructionShortfall(project)[kind]
    return task(
      isBusinessBuild ? `gather-business-building-${kind}` : `gather-${kind}`,
      isBusinessBuild ? `Gather ${meta.label.toLowerCase()} for ${project.name}` : `Gather ${meta.label.toLowerCase()}`,
      gatherResourceDetail(project.name, kind, missing, snapshot.resources[kind] ?? 0),
      'capital',
      { kind: 'gather', resourceKind: kind },
      meta.gatherMinutes,
    )
  }
  if (!progress.permitComplete) {
    if (snapshot.money >= project.permitFee + CASH_SAFETY_FLOOR) {
      return task(
        isBusinessBuild ? 'pay-business-building-permit' : 'pay-house-permit',
        isBusinessBuild ? `Pay ${project.name} permit` : 'Pay the building permit',
        `Pay ${moneyText(project.permitFee)} and keep at least ${moneyText(CASH_SAFETY_FLOOR)} for food and water so the ${target} build stays legal and safe.`,
        'respect',
        { kind: 'construction-action', projectId: project.id, action: 'permit' },
        10,
      )
    }
    return task(
      isBusinessBuild ? 'work-for-business-building-permit' : 'work-for-permit',
      isBusinessBuild ? `Work for ${project.name}'s permit` : 'Work for permit money',
      cashGapDetail(isBusinessBuild ? `${project.name} permit` : 'Building permit', project.permitFee, snapshot.money, 'paying the permit'),
      'work',
      { kind: 'work-action', action: 'shift' },
      STANDARD_DAY_BUDGET.workMinutes,
    )
  }
  if (!progress.laborComplete) {
    const labor = constructionLaborBreakdown(project)
    const activeWorkerLabor = activeWorkerLaborRemaining(labor.remainingMinutes, project.workerContracts)
    if (activeWorkerLabor >= labor.remainingMinutes && labor.remainingMinutes > 0) {
      return task(
        isBusinessBuild ? 'monitor-business-building-worker-finish' : 'monitor-house-worker-finish',
        isBusinessBuild ? `Let the helper finish ${project.name}` : 'Let the helper finish the house',
        `Paid Workers Hall time can cover the remaining ${minutesText(labor.remainingMinutes)}. Check the site and finish when the worker ledger turns ready.`,
        'capital',
        { kind: 'panel', panel: 'construction', target: { kind: 'construction', id: project.id } },
        5,
      )
    }
    const activeWorkers = (project.workerContracts ?? []).filter((contract) => contract.workedMinutes < contract.paidMinutes)
    if (activeWorkers.length > 0) {
      return task(
        isBusinessBuild ? 'build-business-building-with-worker-hour' : 'build-house-with-worker-hour',
        isBusinessBuild ? `Work beside the helper on ${project.name}` : 'Work beside the house helper',
        `A Workers Hall helper is already paid and active. Add 1h yourself while they continue; ${minutesText(labor.remainingMinutes)} remains before this hour.`,
        'capital',
        { kind: 'construction-action', projectId: project.id, action: 'work' },
        60,
      )
    }
    const helperEstimate = affordableConstructionHelperEstimate(project, snapshot.money, communityHelperCreditMinutes(snapshot))
    if (helperEstimate) {
      return task(
        isBusinessBuild ? 'hire-business-building-worker-hour' : 'hire-house-worker-hour',
        isBusinessBuild ? `Hire ${helperEstimate.hours}h helper for ${project.name}` : `Hire ${helperEstimate.hours}h helper for the house`,
        workerHireDetail({
          ratePerHour: helperEstimate.worker.ratePerHour,
          cost: helperEstimate.cost,
          hours: helperEstimate.hours,
          laborMinutes: helperEstimate.laborMinutes,
          remainingMinutes: labor.remainingMinutes,
          place: 'site',
        }),
        'capital',
        { kind: 'construction-action', projectId: project.id, action: 'hire-helper', hours: helperEstimate.hours },
        5,
      )
    }
    return task(
      isBusinessBuild ? 'build-business-building-hour' : 'build-house-hour',
      isBusinessBuild ? `Work 60m on ${project.name}` : 'Work 60m on your house',
      `Use free time after work and body care to add 1h yourself; ${minutesText(labor.remainingMinutes)} remains before this hour.`,
      'capital',
      { kind: 'construction-action', projectId: project.id, action: 'work' },
      60,
    )
  }
  return task(
    isBusinessBuild ? 'complete-business-building' : 'complete-house',
    isBusinessBuild ? `Open ${project.name}` : 'Enter the house',
    isBusinessBuild
      ? 'Materials, permit, and labor are ready. Finish the building so the business can start earning.'
      : 'Materials, permit, and labor are ready. Finish it and enter your own place.',
    'capital',
    { kind: 'construction-action', projectId: project.id, action: 'complete', resultKind: project.resultKind },
    10,
  )
}

function workPrimary(snapshot: LifeLadderSnapshot): LifePlanTask | null {
  if (!snapshot.jobId) {
    return task('find-job', 'Find honest work', 'Choose a job before chasing bigger capital. Work funds food, permits, and the first build.', 'work', { kind: 'panel', panel: 'work' }, 30)
  }
  if (snapshot.shiftsWorked <= 0) {
    return task('first-shift', 'Complete your first shift', 'The first paycheck turns the life plan from idea into habit.', 'work', { kind: 'work-action', action: 'shift' }, STANDARD_DAY_BUDGET.workMinutes)
  }
  if (snapshot.money < CASH_SAFETY_FLOOR) {
    return task('cash-floor-shift', 'Rebuild your cash floor', 'Work before spending. Keep food, water, and permits funded.', 'work', { kind: 'work-action', action: 'shift' }, STANDARD_DAY_BUDGET.workMinutes)
  }
  return null
}

function seriousWorkRepairPrimary(snapshot: LifeLadderSnapshot): LifePlanTask | null {
  if (!snapshot.jobId || !snapshot.seriousWorkMissedYesterday) return null
  return task(
    'repair-serious-work',
    'Restart serious work',
    'Yesterday was missed. Work one reliable shift today to rebuild rhythm and respect.',
    'respect',
    { kind: 'work-action', action: 'shift' },
    STANDARD_DAY_BUDGET.workMinutes,
  )
}

function activeEducationCourse(progress: EducationProgress[]): { course: EducationCourse; progress: EducationProgress } | null {
  for (const item of progress) {
    if (item.completedAt !== null) continue
    const course = educationCourseById(item.courseId)
    if (!course || educationRemainingMinutes(course, item) <= 0) continue
    return { course, progress: item }
  }
  return null
}

function schoolPrimary(snapshot: LifeLadderSnapshot): LifePlanTask | null {
  const active = activeEducationCourse(snapshot.educationProgress)
  if (active) {
    const remaining = educationRemainingMinutes(active.course, active.progress)
    return task(
      `study-${active.course.id}`,
      `Study ${active.course.name}`,
      `${remaining} minutes remain. Finish the course block before chasing the next credential.`,
      'school',
      { kind: 'education-action', courseId: active.course.id },
      nextStudyBlockMinutes(active.course, active.progress),
    )
  }
  if (snapshot.lifeDay > 14) return null
  if (snapshot.educationActions > 0 || snapshot.level > 1 || snapshot.xp >= 40) return null
  if (snapshot.money < 80 + CASH_SAFETY_FLOOR) return null
  return task('study-first-course', 'Study one useful skill', 'School compounds wages. Do one course while your body and income are safe.', 'school', { kind: 'market', focus: 'education' }, 60)
}

function businessPrimary(snapshot: LifeLadderSnapshot): LifePlanTask | null {
  if (!snapshot.assets.some((asset) => asset.kind === 'home')) return null
  const project = snapshot.businessDevelopmentProjects[0] ?? null
  if (project) {
    const progress = businessDevelopmentProgress(project)
    if (!progress.resourcesComplete) {
      const kind = firstMissingBusinessResource(project, snapshot.resources)
      if (!kind) {
        return task('deposit-business-materials', `Deposit ${project.businessName} materials`, 'Move gathered ingredients into the interior plan so the upgrade can advance.', 'capital', { kind: 'business-development-action', projectId: project.id, action: 'deposit' }, 15)
      }
      const meta = RESOURCE_META[kind]
      const missing = businessDevelopmentShortfall(project)[kind]
      return task(
        `gather-business-${kind}`,
        `Gather ${meta.label.toLowerCase()} for ${project.businessName}`,
        gatherResourceDetail(`${project.businessName}'s interior`, kind, missing, snapshot.resources[kind] ?? 0),
        'capital',
        { kind: 'gather', resourceKind: kind },
        meta.gatherMinutes,
      )
    }
    if (!progress.budgetComplete) {
      if (snapshot.money >= project.budgetCost + CASH_SAFETY_FLOOR) {
        return task('pay-business-budget', `Pay ${project.businessName} budget`, `Pay ${moneyText(project.budgetCost)} and keep at least ${moneyText(CASH_SAFETY_FLOOR)} safe cash to unlock interior labor for level ${project.levelTo}.`, 'respect', { kind: 'business-development-action', projectId: project.id, action: 'budget' }, 10)
      }
      return task('work-for-business-budget', `Work for ${project.businessName}'s budget`, cashGapDetail(`${project.businessName} interior budget`, project.budgetCost, snapshot.money, 'funding the upgrade'), 'work', { kind: 'work-action', action: 'shift' }, STANDARD_DAY_BUDGET.workMinutes)
    }
    if (!progress.laborComplete) {
      const labor = businessDevelopmentLaborBreakdown(project)
      const activeWorkerLabor = activeWorkerLaborRemaining(labor.remainingMinutes, project.workerContracts)
      if (activeWorkerLabor >= labor.remainingMinutes && labor.remainingMinutes > 0) {
        return task(
          'monitor-business-worker-finish',
          `Let the helper finish ${project.businessName}`,
          `Paid Workers Hall time can cover the remaining ${minutesText(labor.remainingMinutes)} inside. Check the business and finish when the worker ledger turns ready.`,
          'capital',
          { kind: 'panel', panel: 'business', target: { kind: 'asset', id: project.businessId } },
          5,
        )
      }
      const activeWorkers = (project.workerContracts ?? []).filter((contract) => contract.workedMinutes < contract.paidMinutes)
      if (activeWorkers.length > 0) {
        return task('develop-business-with-worker-hour', `Work beside the helper inside ${project.businessName}`, `A Workers Hall helper is already paid and active. Add 1h inside while they continue; ${minutesText(labor.remainingMinutes)} remains before this hour.`, 'capital', { kind: 'business-development-action', projectId: project.id, action: 'work' }, 60)
      }
      const helperEstimate = affordableBusinessHelperEstimate(project, snapshot.money, communityHelperCreditMinutes(snapshot))
      if (helperEstimate) {
        return task(
          'hire-business-worker-hour',
          `Hire ${helperEstimate.hours}h worker for ${project.businessName}`,
          workerHireDetail({
            ratePerHour: helperEstimate.worker.ratePerHour,
            cost: helperEstimate.cost,
            hours: helperEstimate.hours,
            laborMinutes: helperEstimate.laborMinutes,
            remainingMinutes: labor.remainingMinutes,
            place: 'interior',
          }),
          'capital',
          { kind: 'business-development-action', projectId: project.id, action: 'hire-helper', hours: helperEstimate.hours },
          5,
        )
      }
      return task('develop-business-hour', `Work 60m inside ${project.businessName}`, `Use free time after work and body care to add 1h inside; ${minutesText(labor.remainingMinutes)} remains before this hour.`, 'capital', { kind: 'business-development-action', projectId: project.id, action: 'work' }, 60)
    }
    return task('finish-business-development', `Finish ${project.businessName} L${project.levelTo}`, 'Materials, budget, and labor are ready. Make the interior upgrade permanent.', 'capital', { kind: 'business-development-action', projectId: project.id, action: 'complete' }, 10)
  }
  const business = snapshot.assets.find((asset) => asset.kind === 'business') ?? null
  if (business) {
    const route: LifePlanRoute = business.id
      ? { kind: 'panel', panel: 'business', target: { kind: 'asset', id: business.id } }
      : { kind: 'panel', panel: 'business' }
    return task('plan-business-development', 'Plan the next business upgrade', 'Turn profit into layout, tools, and service quality before chasing a second business.', 'capital', route, 20)
  }
  const shell = firstBusinessShellProject()
  if (!shell) {
    return task('build-first-business', 'Build the first business', 'Use stable home life to start an earning building, not instant magic income.', 'capital', { kind: 'market', focus: 'business' }, 45)
  }
  const cashNeeded = Math.max(0, shell.item.price + CASH_SAFETY_FLOOR - snapshot.money)
  if (cashNeeded > 0) {
    return task(
      'build-first-business',
      `Save for ${shell.item.name} foundation`,
      `${shell.item.name} costs $${shell.item.price.toLocaleString()} before the map shell. Save $${cashNeeded.toLocaleString()} more, then place it and build through materials, permit, and labor.`,
      'work',
      snapshot.jobId ? { kind: 'work-action', action: 'shift' } : { kind: 'panel', panel: 'work' },
      snapshot.jobId ? STANDARD_DAY_BUDGET.workMinutes : 30,
    )
  }
  return task(
    'build-first-business',
    `Place ${shell.item.name} foundation`,
    `Buy ${shell.item.name} from Market > Businesses, place the map shell, then gather ingredients, pay the permit, and build it before it earns.`,
    'capital',
    { kind: 'market', focus: 'business' },
    45,
  )
}

function communityPrimary(snapshot: LifeLadderSnapshot): LifePlanTask | null {
  if (snapshot.lifeDay < 2) return null
  if (snapshot.communityActionsToday > 0) return null
  if (snapshot.communityActionsThisWeek > 0) return null
  return task('help-local-person', 'Help one local person', 'Respect and friendship grow from showing up before anyone owes you.', 'community', { kind: 'community-action', actionId: 'help-errand' }, 35)
}

function placedAssetForPath(asset: LifeLadderAsset, index: number): PlacedAsset {
  const fallback = asset.kind === 'home'
    ? { itemId: 'studio', name: 'Studio Apartment' }
    : { itemId: 'foodcart', name: 'Food Cart' }
  return {
    id: asset.id ?? `${asset.kind}-${index + 1}`,
    itemId: asset.itemId ?? fallback.itemId,
    kind: asset.kind,
    name: asset.name ?? fallback.name,
    lat: asset.lat ?? 0,
    lng: asset.lng ?? 0,
    incomePerDay: asset.incomePerDay,
    pendingIncome: asset.pendingIncome ?? 0,
    placedAtMinute: asset.placedAtMinute ?? 0,
    level: asset.level,
  }
}

function millionairePathFor(snapshot: LifeLadderSnapshot): MillionairePath {
  return millionairePathOf({
    money: snapshot.money,
    inventory: snapshot.inventory,
    assets: snapshot.assets.map(placedAssetForPath),
    needs: snapshot.needs,
    health: snapshot.health,
    level: snapshot.level,
    jobWage: snapshot.jobId ? jobById(snapshot.jobId)?.wage ?? 0 : 0,
    shiftsWorked: snapshot.shiftsWorked,
    educationActions: snapshot.educationActions,
    educationProgress: snapshot.educationProgress,
    communityRespect: snapshot.communityRespect,
    communityFriendship: snapshot.communityFriendship,
    communityTrust: snapshot.communityTrust,
  })
}

function millionairePathTask(
  path: MillionairePath,
  candidates: {
    body: LifePlanTask | null
    work: LifePlanTask | null
    school: LifePlanTask | null
    construction: LifePlanTask | null
    business: LifePlanTask | null
    steady: LifePlanTask
  },
): LifePlanTask {
  if (path.nextAction === 'recover-body') {
    return candidates.body ?? task('millionaire-recover-body', 'Recover before the money push', path.nextActionDetail, 'body', { kind: 'market', focus: 'health' }, 60)
  }
  if (path.nextAction === 'find-job' || path.nextAction === 'work-shift') {
    return candidates.work ?? task('millionaire-work-shift', 'Work the next safe shift', path.nextActionDetail, 'work', { kind: 'work-action', action: 'shift' }, STANDARD_DAY_BUDGET.workMinutes)
  }
  if (path.nextAction === 'study') {
    return candidates.school ?? task('millionaire-study-skill', 'Study the next useful skill', path.nextActionDetail, 'school', { kind: 'market', focus: 'education' }, 60)
  }
  if (path.nextAction === 'build-home') {
    return candidates.construction ?? task('millionaire-start-home', 'Start the home build', path.nextActionDetail, 'capital', { kind: 'panel', panel: 'construction' }, 30)
  }
  if (path.nextAction === 'buy-business') {
    return candidates.business ?? task('millionaire-build-business', 'Build the first business', path.nextActionDetail, 'capital', { kind: 'market', focus: 'business' }, 45)
  }
  if (path.nextAction === 'upgrade-business') {
    return candidates.business ?? task('millionaire-upgrade-business', 'Upgrade the first business', path.nextActionDetail, 'capital', { kind: 'panel', panel: 'business' }, 20)
  }
  if (path.nextAction === 'reinvest') {
    return candidates.business ?? task('millionaire-reinvest', 'Reinvest the surplus', path.nextActionDetail, 'capital', { kind: 'panel', panel: 'assets' }, 60)
  }
  return task('millionaire-keep-growing', 'Keep wealth productive', path.nextActionDetail, 'capital', { kind: 'panel', panel: 'assets' }, 30)
}

function supportTasks(snapshot: LifeLadderSnapshot): LifePlanTask[] {
  const lowest = lowestNeed(snapshot.needs)
  const ownedRecovery = lowest === 'energy' ? null : strongestOwnedNeedItem(snapshot.inventory, lowest)
  const recipe = lowest === 'hunger' && !ownedRecovery ? readyRecipe(snapshot) : null
  const bodyRoute: LifePlanRoute = ownedRecovery
    ? { kind: 'consume-action', itemId: ownedRecovery.id }
    : recipe
      ? { kind: 'cook-action', recipeId: recipe.id }
    : lowest === 'hunger' && hasCookingAccess(snapshot)
      ? { kind: 'market', focus: 'groceries' }
    : lowest === 'hydration' && snapshot.money >= 1
      ? { kind: 'survival-action', action: 'drink-water' }
      : lowest === 'energy'
        ? { kind: 'survival-action', action: 'sleep' }
        : { kind: 'market', focus: marketFocusForNeed(lowest) }
  const body = task('support-body', `Protect ${lowest}`, 'Drink, eat, clean up, or sleep before the day gets expensive.', 'body', bodyRoute, 30)
  const activeCourse = activeEducationCourse(snapshot.educationProgress)
  const school = activeCourse
    ? task(
        `support-study-${activeCourse.course.id}`,
        `Study ${activeCourse.course.name}`,
        `${educationRemainingMinutes(activeCourse.course, activeCourse.progress)} minutes remain in this course.`,
        'school',
        { kind: 'education-action', courseId: activeCourse.course.id },
        nextStudyBlockMinutes(activeCourse.course, activeCourse.progress),
      )
    : task('support-school', 'Learn one small thing', 'A course, certification, or focused practice makes future work easier.', 'school', { kind: 'market', focus: 'education' }, 45)
  const work = task(snapshot.jobId ? 'support-shift' : 'support-job', snapshot.jobId ? 'Keep work reliable' : 'Choose a job', 'Respect starts with showing up when you said you would.', 'work', snapshot.jobId ? { kind: 'work-action', action: 'shift' } : { kind: 'panel', panel: 'work' }, snapshot.jobId ? STANDARD_DAY_BUDGET.workMinutes : 30)
  const respect = task('support-respect', 'Keep one commitment', 'Finish the shift, build hour, or study block you start today.', 'respect', { kind: 'panel', panel: 'achievements' }, 10)
  const friendship = task('support-friendship', 'Check on one friend', 'Friendship is not decoration. It keeps life stable when the grind gets hard.', 'friendship', { kind: 'community-action', actionId: 'check-neighbor' }, 20)
  const community = task('support-community', 'Help one local person', 'Community grows trust first, rewards second.', 'community', { kind: 'community-action', actionId: 'help-errand' }, 35)
  const hasBusinessProject = snapshot.businessDevelopmentProjects.length > 0
  const capital = task(
    'support-capital',
    snapshot.constructionProjects.length > 0 ? 'Move the build forward' : hasBusinessProject ? 'Move the business interior forward' : 'Save toward ownership',
    'Turn work into a house, then a business, then cashflow.',
    'capital',
    { kind: 'panel', panel: snapshot.constructionProjects.length > 0 ? 'construction' : hasBusinessProject ? 'business' : 'assets' },
    60,
  )
  return [body, school, work, respect, friendship, community, capital]
}

function strongestOwnedFood(inventory: Record<string, number>): { id: string; hunger: number } | null {
  const item = strongestOwnedNeedItem(inventory, 'hunger')
  return item ? { id: item.id, hunger: item.amount } : null
}

function strongestOwnedNeedItem(inventory: Record<string, number>, need: keyof Needs): { id: string; amount: number } | null {
  return SHOP_ITEMS
    .filter((item) => item.category !== 'groceries' && (need !== 'hunger' || item.category !== 'furniture') && (inventory[item.id] ?? 0) > 0 && (item.effects?.[need] ?? 0) > 0)
    .map((item) => ({ id: item.id, amount: item.effects?.[need] ?? 0 }))
    .sort((a, b) => b.amount - a.amount)[0] ?? null
}

function compactAgenda(tasks: (LifePlanTask | null)[]): LifePlanTask[] {
  const seen = new Set<string>()
  const agenda: LifePlanTask[] = []
  for (const item of tasks) {
    if (!item || seen.has(item.id)) continue
    seen.add(item.id)
    agenda.push(item)
    if (agenda.length >= 3) break
  }
  return agenda
}

function firstTaskByValue(tasks: LifePlanTask[], values: LifeValue[]): LifePlanTask | null {
  return tasks.find((item) => values.includes(item.value)) ?? null
}

function growthRoutineTask(snapshot: LifeLadderSnapshot, tasks: LifePlanTask[]): LifePlanTask | null {
  const school = firstTaskByValue(tasks, ['school'])
  if (school && (school.route.kind === 'education-action' || school.id === 'study-first-course')) return school
  if (snapshot.communityActionsToday > 0) return school ?? firstTaskByValue(tasks, ['respect'])
  const community = firstTaskByValue(tasks, ['community'])
  if (snapshot.communityActionsThisWeek <= 0 && community) return community
  const friendship = firstTaskByValue(tasks, ['friendship'])
  return friendship ?? community ?? school ?? firstTaskByValue(tasks, ['respect'])
}

function buildDailyRoutine(snapshot: LifeLadderSnapshot, primary: LifePlanTask, agenda: LifePlanTask[], support: LifePlanTask[]): LifeRoutineBlock[] {
  const taskPool = [primary, ...agenda, ...support]
  const bodyTask = primary.value === 'body' ? primary : firstTaskByValue(taskPool, ['body'])
  const workTask = firstTaskByValue(taskPool, ['work'])
  const growthTask = growthRoutineTask(snapshot, taskPool)
  const capitalTask = firstTaskByValue(taskPool, ['capital'])
  const hasActiveBuild = snapshot.constructionProjects.length > 0 || snapshot.businessDevelopmentProjects.length > 0

  return [
    routineBlock(
      'sleep-block',
      'Sleep',
      'Protect the next day with a full rest window.',
      'body',
      { kind: 'survival-action', action: 'sleep' },
      STANDARD_DAY_BUDGET.sleepMinutes,
    ),
    routineBlock(
      'body-block',
      bodyTask?.title ?? 'Food, water, hygiene',
      bodyTask?.detail ?? 'Keep hunger, hydration, hygiene, and energy above the danger zone.',
      'body',
      bodyTask?.route ?? { kind: 'market', focus: 'food' },
      STANDARD_DAY_BUDGET.bodyMinutes,
      bodyTask?.id,
    ),
    routineBlock(
      'work-block',
      workTask?.title ?? (snapshot.jobId ? 'Work a reliable shift' : 'Find honest work'),
      workTask?.detail ?? (snapshot.jobId ? 'Income funds food, permits, workers, and ownership.' : 'A job turns the day into a repeatable plan.'),
      'work',
      workTask?.route ?? { kind: 'panel', panel: 'work' },
      snapshot.jobId ? STANDARD_DAY_BUDGET.workMinutes : 30,
      workTask?.id,
    ),
    routineBlock(
      'growth-block',
      growthTask?.title ?? 'Study or help someone',
      growthTask?.detail ?? 'School, respect, friendship, and community make the money loop stable.',
      growthTask?.value ?? 'school',
      growthTask?.route ?? { kind: 'market', focus: 'education' },
      STANDARD_DAY_BUDGET.adminCommunityMinutes,
      growthTask?.id,
    ),
    routineBlock(
      'free-time-block',
      capitalTask ? `Free time: ${capitalTask.title}` : 'Free time: save toward ownership',
      hasActiveBuild
        ? 'Use the hours outside sleep and work to gather, deposit, build, or hire help.'
        : 'Turn surplus money and time into a house, business, and compounding cashflow.',
      'capital',
      capitalTask?.route ?? { kind: 'panel', panel: 'assets' },
      STANDARD_DAY_BUDGET.flexibleMinutes,
      capitalTask?.id,
    ),
  ]
}

function resourceTripForecasts(shortfall: ResourceInventory, resources: ResourceInventory): {
  resourceTrips: ResourceTripForecast[]
  totalGatherMinutes: number
} {
  const resourceTrips = RESOURCE_KINDS.map((kind) => {
    const missing = Math.max(0, shortfall[kind] - (resources[kind] ?? 0))
    const meta = RESOURCE_META[kind]
    const trips = Math.ceil(missing / meta.yieldAmount)
    return { kind, missing, trips, minutes: trips * meta.gatherMinutes }
  })
  return {
    resourceTrips,
    totalGatherMinutes: resourceTrips.reduce((sum, item) => sum + item.minutes, 0),
  }
}

function activeWorkerForecast(
  remainingLaborMinutes: number,
  contracts: { paidMinutes: number; workedMinutes: number; laborMultiplier: number }[] = [],
): {
  activeWorkerCount: number
  activeWorkerPaidMinutesRemaining: number
  activeWorkerLaborMinutesRemaining: number
} {
  const activeContracts = contracts.filter((contract) => contract.workedMinutes < contract.paidMinutes)
  const activeWorkerPaidMinutesRemaining = activeContracts.reduce((sum, contract) => sum + Math.max(0, contract.paidMinutes - contract.workedMinutes), 0)
  const activeWorkerLaborMinutesRemaining = Math.min(
    remainingLaborMinutes,
    activeContracts.reduce((sum, contract) => sum + Math.max(0, contract.paidMinutes - contract.workedMinutes) * Math.max(0, contract.laborMultiplier), 0),
  )
  return {
    activeWorkerCount: activeContracts.length,
    activeWorkerPaidMinutesRemaining,
    activeWorkerLaborMinutesRemaining,
  }
}

function forecastLaborDays(remainingLaborMinutes: number, dailyLaborMinutes: number): number {
  if (remainingLaborMinutes <= 0) return 0
  return Math.max(1, Math.ceil(remainingLaborMinutes / Math.max(1, dailyLaborMinutes)))
}

function forecastLaborDaysWithOneTimeHelp(remainingLaborMinutes: number, dailyLaborMinutes: number, oneTimeLaborMinutes: number): number {
  if (remainingLaborMinutes <= 0) return 0
  const remainingAfterHelp = Math.max(0, remainingLaborMinutes - Math.max(0, oneTimeLaborMinutes))
  if (remainingAfterHelp <= 0) return 1
  return forecastLaborDays(remainingAfterHelp, dailyLaborMinutes)
}

function completionLifeDay(currentLifeDay: number, laborDays: number): number {
  const safeCurrentDay = Math.max(1, Math.floor(Number.isFinite(currentLifeDay) ? currentLifeDay : 1))
  if (laborDays <= 0) return safeCurrentDay
  return safeCurrentDay + laborDays - 1
}

function communityHelperCreditMinutes(snapshot: Pick<LifeLadderSnapshot, 'communityRespect' | 'communityFriendship' | 'communityTrust' | 'shiftsWorked' | 'communityHelperMinutesUsedThisWeek'>): number {
  const advantage = communityAdvantageOf({
    communityRespect: snapshot.communityRespect,
    communityFriendship: snapshot.communityFriendship,
    communityTrust: snapshot.communityTrust,
    shiftsWorked: snapshot.shiftsWorked,
  })
  return Math.max(0, advantage.weeklyHelperMinutes - Math.max(0, Math.floor(snapshot.communityHelperMinutesUsedThisWeek ?? 0)))
}

export function constructionDayForecast(
  project: ConstructionProject = {
    id: 'starter-house-plan',
    recipeId: STARTER_HOUSE_RECIPE.id,
    name: STARTER_HOUSE_RECIPE.name,
    itemId: STARTER_HOUSE_RECIPE.itemId,
    resultKind: STARTER_HOUSE_RECIPE.resultKind,
    lat: 0,
    lng: 0,
    required: freshResources(STARTER_HOUSE_RECIPE.required),
    deposited: freshResources(),
    laborRequiredMinutes: STARTER_HOUSE_RECIPE.laborRequiredMinutes,
    laborDoneMinutes: 0,
    hiredLaborMinutes: 0,
    workerContracts: [],
    permitFee: STARTER_HOUSE_RECIPE.permitFee,
    permitFeePaid: false,
    incomePerDay: 0,
    status: 'planned',
    placedAt: 0,
  },
  resources: ResourceInventory = freshResources(),
  money = 0,
  cashSafetyFloor = CASH_SAFETY_FLOOR,
  upfrontCost = 0,
  currentLifeDay = 1,
  communityCreditMinutes = 0,
): ConstructionDayForecast {
  const { resourceTrips, totalGatherMinutes } = resourceTripForecasts(constructionShortfall(project), resources)
  const remainingLaborMinutes = constructionLaborBreakdown(project).remainingMinutes
  const upfrontCostRemaining = Math.max(0, Math.floor(upfrontCost))
  const upfrontCashNeeded = Math.max(0, upfrontCostRemaining + cashSafetyFloor - money)
  const permitRemaining = project.permitFeePaid ? 0 : Math.max(0, project.permitFee)
  const permitCashNeeded = Math.max(0, permitRemaining + cashSafetyFloor - money)
  const helper = CONSTRUCTION_WORKERS.find((worker) => worker.id === 'helper')
  const helperDailyMinutes = helper ? Math.round(2 * 60 * helper.laborMultiplier) : 0
  const helperEstimate = helper ? estimateConstructionWorkerHire(project, 'helper', 2, communityCreditMinutes) : null
  const helperCost = helperEstimate?.cost ?? (helper ? helper.ratePerHour * 2 : 0)
  const helperCashNeeded = Math.max(0, helperCost + cashSafetyFloor - money)
  const activeWorkers = activeWorkerForecast(remainingLaborMinutes, project.workerContracts)
  const playerOnlyDaysAtOneHour = forecastLaborDays(remainingLaborMinutes, 60)
  const playerOnlyDaysAtTwoHours = forecastLaborDays(remainingLaborMinutes, 120)
  const helperTwoHourDays = forecastLaborDays(remainingLaborMinutes, 60 + helperDailyMinutes)
  const activeWorkerDays = activeWorkers.activeWorkerCount > 0
    ? forecastLaborDaysWithOneTimeHelp(remainingLaborMinutes, 60, activeWorkers.activeWorkerLaborMinutesRemaining)
    : 0
  return {
    upfrontCostRemaining,
    upfrontCashNeeded,
    upfrontAffordableToday: upfrontCashNeeded <= 0,
    permitRemaining,
    permitCashNeeded,
    permitAffordableToday: permitCashNeeded <= 0,
    remainingLaborMinutes,
    playerOnlyDaysAtOneHour,
    playerOnlyDaysAtTwoHours,
    playerOnlyCompletionLifeDay: completionLifeDay(currentLifeDay, playerOnlyDaysAtOneHour),
    helperTwoHourDays,
    helperTwoHourCompletionLifeDay: completionLifeDay(currentLifeDay, helperTwoHourDays),
    helperTwoHourLaborMinutes: helperDailyMinutes,
    helperTwoHourCost: helperCost,
    helperTwoHourAffordableToday: helperCashNeeded <= 0,
    helperTwoHourCashNeeded: helperCashNeeded,
    activeWorkerCompletionLifeDay: activeWorkerDays > 0 ? completionLifeDay(currentLifeDay, activeWorkerDays) : 0,
    ...activeWorkers,
    resourceTrips,
    totalGatherMinutes,
  }
}

export function businessDevelopmentDayForecast(
  project: BusinessDevelopmentProject,
  resources: ResourceInventory = freshResources(),
  money = 0,
  cashSafetyFloor = CASH_SAFETY_FLOOR,
  currentLifeDay = 1,
  communityCreditMinutes = 0,
): BusinessDevelopmentDayForecast {
  const { resourceTrips, totalGatherMinutes } = resourceTripForecasts(businessDevelopmentShortfall(project), resources)
  const budgetRemaining = project.budgetPaid ? 0 : project.budgetCost
  const budgetCashNeeded = Math.max(0, budgetRemaining + cashSafetyFloor - money)
  const remainingLaborMinutes = businessDevelopmentLaborBreakdown(project).remainingMinutes
  const helper = CONSTRUCTION_WORKERS.find((worker) => worker.id === 'helper')
  const helperDailyMinutes = helper ? Math.round(2 * 60 * helper.laborMultiplier) : 0
  const helperEstimate = helper ? estimateBusinessDevelopmentWorkerHire(project, 'helper', 2, communityCreditMinutes) : null
  const helperCost = helperEstimate?.cost ?? (helper ? helper.ratePerHour * 2 : 0)
  const helperCashNeeded = Math.max(0, budgetRemaining + helperCost + cashSafetyFloor - money)
  const activeWorkers = activeWorkerForecast(remainingLaborMinutes, project.workerContracts)
  const playerOnlyDaysAtOneHour = forecastLaborDays(remainingLaborMinutes, 60)
  const playerOnlyDaysAtTwoHours = forecastLaborDays(remainingLaborMinutes, 120)
  const helperTwoHourDays = forecastLaborDays(remainingLaborMinutes, 60 + helperDailyMinutes)
  const activeWorkerDays = activeWorkers.activeWorkerCount > 0
    ? forecastLaborDaysWithOneTimeHelp(remainingLaborMinutes, 60, activeWorkers.activeWorkerLaborMinutesRemaining)
    : 0
  return {
    budgetRemaining,
    budgetAffordableToday: budgetCashNeeded <= 0,
    budgetCashNeeded,
    remainingLaborMinutes,
    playerOnlyDaysAtOneHour,
    playerOnlyDaysAtTwoHours,
    playerOnlyCompletionLifeDay: completionLifeDay(currentLifeDay, playerOnlyDaysAtOneHour),
    helperTwoHourDays,
    helperTwoHourCompletionLifeDay: completionLifeDay(currentLifeDay, helperTwoHourDays),
    helperTwoHourLaborMinutes: helperDailyMinutes,
    helperTwoHourCost: helperCost,
    helperTwoHourAffordableToday: helperCashNeeded <= 0,
    helperTwoHourCashNeeded: helperCashNeeded,
    activeWorkerCompletionLifeDay: activeWorkerDays > 0 ? completionLifeDay(currentLifeDay, activeWorkerDays) : 0,
    ...activeWorkers,
    resourceTrips,
    totalGatherMinutes,
  }
}

export function planLifeDay(snapshot: LifeLadderSnapshot): LifePlan {
  const active = snapshot.activityKind
    ? task('finish-active-commitment', 'Finish the current commitment', 'Respect grows when you finish what you start.', 'respect', { kind: 'none' }, 0)
    : null
  const body = bodyRecoveryTask(snapshot)
  const seriousWorkRepair = seriousWorkRepairPrimary(snapshot)
  const work = workPrimary(snapshot)
  const school = schoolPrimary(snapshot)
  const construction = constructionPrimary(snapshot)
  const community = communityPrimary(snapshot)
  const business = businessPrimary(snapshot)
  const businessBeforeCommunity = business && business.id !== 'build-first-business' ? business : null
  const steady = task('steady-owner-day', 'Run a steady owner day', 'Collect, study, help someone, and reinvest the surplus.', 'capital', { kind: 'panel', panel: 'assets' }, 60)
  const millionairePath = millionairePathFor(snapshot)
  const millionaireTask = millionairePathTask(millionairePath, {
    body,
    work,
    school,
    construction,
    business,
    steady,
  })
  const primary =
    active
    ?? body
    ?? seriousWorkRepair
    ?? work
    ?? school
    ?? construction
    ?? businessBeforeCommunity
    ?? community
    ?? millionaireTask
    ?? business
    ?? steady

  const support = supportTasks(snapshot)
  const agenda = compactAgenda([
    primary,
    body,
    seriousWorkRepair,
    work,
    school,
    construction,
    businessBeforeCommunity,
    community,
    millionaireTask,
    business,
    ...support,
    steady,
  ])
  const valuesCovered = Array.from(new Set([primary, ...support].map((item) => item.value)))
  const activeProject = activeConstructionProject(snapshot)
  const activeBusinessDevelopmentProject = snapshot.businessDevelopmentProjects[0] ?? null
  const helperCreditMinutes = communityHelperCreditMinutes(snapshot)
  const hasHome = snapshot.assets.some((asset) => asset.kind === 'home')
  const hasBusiness = snapshot.assets.some((asset) => asset.kind === 'business')
  const firstBusinessShell = hasHome && !hasBusiness && !activeProject
    ? firstBusinessShellProject(snapshot.lifeDay)
    : null
  return {
    lifeDay: snapshot.lifeDay,
    primary,
    agenda,
    support,
    routine: buildDailyRoutine(snapshot, primary, agenda, support),
    valuesCovered,
    timeBudget: STANDARD_DAY_BUDGET,
    constructionForecast: activeProject || !hasHome
      ? constructionDayForecast(activeProject ?? undefined, snapshot.resources, snapshot.money, CASH_SAFETY_FLOOR, 0, snapshot.lifeDay, helperCreditMinutes)
      : firstBusinessShell
        ? constructionDayForecast(firstBusinessShell.project, snapshot.resources, snapshot.money, CASH_SAFETY_FLOOR, firstBusinessShell.item.price, snapshot.lifeDay, helperCreditMinutes)
      : null,
    businessDevelopmentForecast: activeBusinessDevelopmentProject
      ? businessDevelopmentDayForecast(activeBusinessDevelopmentProject, snapshot.resources, snapshot.money, CASH_SAFETY_FLOOR, snapshot.lifeDay, helperCreditMinutes)
      : null,
    millionairePath,
    millionaireTask,
  }
}
