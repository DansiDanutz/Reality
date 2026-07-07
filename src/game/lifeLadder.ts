import {
  businessDevelopmentLaborBreakdown,
  businessDevelopmentProgress,
  businessDevelopmentShortfall,
  type BusinessDevelopmentProject,
} from './businessDevelopment'
import {
  CONSTRUCTION_WORKERS,
  STARTER_HOUSE_RECIPE,
  constructionLaborBreakdown,
  constructionProgress,
  constructionShortfall,
  estimateConstructionWorkerHire,
  type ConstructionProject,
} from './construction'
import { RESOURCE_KINDS, RESOURCE_META, type ResourceInventory, type ResourceKind, freshResources } from './resources'
import type { AssetKind, Needs, ShopCategory } from './types'

export type LifeValue = 'body' | 'school' | 'work' | 'respect' | 'friendship' | 'community' | 'capital'

export type LifePlanRoute =
  | { kind: 'panel'; panel: 'work' | 'construction' | 'assets' | 'home' | 'business' | 'achievements' }
  | { kind: 'market'; focus: ShopCategory }
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
  remainingLaborMinutes: number
  playerOnlyDaysAtOneHour: number
  playerOnlyDaysAtTwoHours: number
  helperTwoHourDays: number
  helperTwoHourLaborMinutes: number
  helperTwoHourCost: number
  helperTwoHourAffordableToday: boolean
  helperTwoHourCashNeeded: number
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
}

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
  assets: { kind: AssetKind; incomePerDay: number }[]
  resources: ResourceInventory
  constructionProjects: ConstructionProject[]
  businessDevelopmentProjects: BusinessDevelopmentProject[]
  educationActions: number
  communityActionsThisWeek: number
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

function bodyRecoveryTask(snapshot: LifeLadderSnapshot): LifePlanTask | null {
  if (snapshot.health < 40) {
    return task('body-recover', 'Recover your body first', 'Health is low. Drink, eat, and rest before chasing money.', 'body', { kind: 'market', focus: 'health' }, 60)
  }
  if (snapshot.needs.hydration <= NEED_RECOVERY_FLOOR) {
    return task('drink-water', 'Drink water', 'Hydration is the fastest survival risk. Fix it before work or construction.', 'body', { kind: 'market', focus: 'drinks' }, 5)
  }
  if (snapshot.needs.hunger <= NEED_RECOVERY_FLOOR) {
    return task('eat-food', 'Eat a real meal', 'Food keeps the workday and construction day possible.', 'body', { kind: 'market', focus: 'food' }, 20)
  }
  if (snapshot.needs.energy <= 30) {
    return task('sleep-tonight', 'Sleep before pushing harder', 'Energy is too low for serious work. Rest protects tomorrow.', 'body', { kind: 'panel', panel: 'home' }, STANDARD_DAY_BUDGET.sleepMinutes)
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
        { kind: 'panel', panel: 'construction' },
        15,
      )
    }
    const meta = RESOURCE_META[kind]
    return task(
      isBusinessBuild ? `gather-business-building-${kind}` : `gather-${kind}`,
      isBusinessBuild ? `Gather ${meta.label.toLowerCase()} for ${project.name}` : `Gather ${meta.label.toLowerCase()}`,
      `${project.name} still needs ${meta.label.toLowerCase()}. Gather locally, then deposit it.`,
      'capital',
      { kind: 'panel', panel: 'construction' },
      meta.gatherMinutes,
    )
  }
  if (!progress.permitComplete) {
    if (snapshot.money >= project.permitFee + CASH_SAFETY_FLOOR) {
      return task(
        isBusinessBuild ? 'pay-business-building-permit' : 'pay-house-permit',
        isBusinessBuild ? `Pay ${project.name} permit` : 'Pay the building permit',
        `Pay ${project.permitFee} and keep the ${target} build legal.`,
        'respect',
        { kind: 'panel', panel: 'construction' },
        10,
      )
    }
    return task(
      isBusinessBuild ? 'work-for-business-building-permit' : 'work-for-permit',
      isBusinessBuild ? `Work for ${project.name}'s permit` : 'Work for permit money',
      'Earn before paying the permit so food and water stay safe.',
      'work',
      { kind: 'panel', panel: 'work' },
      STANDARD_DAY_BUDGET.workMinutes,
    )
  }
  if (!progress.laborComplete) {
    const helperEstimate = estimateConstructionWorkerHire(project, 'helper', 1)
    if (helperEstimate && helperEstimate.blockedBy === null && helperEstimate.laborMinutes > 0 && snapshot.money >= helperEstimate.cost + CASH_SAFETY_FLOOR) {
      return task(
        isBusinessBuild ? 'hire-business-building-worker-hour' : 'hire-house-worker-hour',
        isBusinessBuild ? `Hire 1h helper for ${project.name}` : 'Hire 1h helper for the house',
        `Workers Hall help costs $${helperEstimate.worker.ratePerHour}/hour and adds ${helperEstimate.laborMinutes}m of labor while your day stays balanced.`,
        'capital',
        { kind: 'panel', panel: 'construction' },
        5,
      )
    }
    return task(
      isBusinessBuild ? 'build-business-building-hour' : 'build-house-hour',
      isBusinessBuild ? `Work 60m on ${project.name}` : 'Work 60m on your house',
      `Use free time after work and body care to move the ${target} forward.`,
      'capital',
      { kind: 'panel', panel: 'construction' },
      60,
    )
  }
  return task(
    isBusinessBuild ? 'complete-business-building' : 'complete-house',
    isBusinessBuild ? `Open ${project.name}` : 'Complete the house',
    isBusinessBuild
      ? 'Materials, permit, and labor are ready. Finish the building so the business can start earning.'
      : 'Materials, permit, and labor are ready. Finish it and enter your own place.',
    'capital',
    { kind: 'panel', panel: 'construction' },
    10,
  )
}

function workPrimary(snapshot: LifeLadderSnapshot): LifePlanTask | null {
  if (!snapshot.jobId) {
    return task('find-job', 'Find honest work', 'Choose a job before chasing bigger capital. Work funds food, permits, and the first build.', 'work', { kind: 'panel', panel: 'work' }, 30)
  }
  if (snapshot.shiftsWorked <= 0) {
    return task('first-shift', 'Complete your first shift', 'The first paycheck turns the life plan from idea into habit.', 'work', { kind: 'panel', panel: 'work' }, STANDARD_DAY_BUDGET.workMinutes)
  }
  if (snapshot.money < CASH_SAFETY_FLOOR) {
    return task('cash-floor-shift', 'Rebuild your cash floor', 'Work before spending. Keep food, water, and permits funded.', 'work', { kind: 'panel', panel: 'work' }, STANDARD_DAY_BUDGET.workMinutes)
  }
  return null
}

function schoolPrimary(snapshot: LifeLadderSnapshot): LifePlanTask | null {
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
        return task('deposit-business-materials', `Deposit ${project.businessName} materials`, 'Move gathered ingredients into the interior plan so the upgrade can advance.', 'capital', { kind: 'panel', panel: 'business' }, 15)
      }
      const meta = RESOURCE_META[kind]
      return task(`gather-business-${kind}`, `Gather ${meta.label.toLowerCase()} for ${project.businessName}`, `${project.businessName}'s interior still needs ${meta.label.toLowerCase()}. Gather locally, then deposit it.`, 'capital', { kind: 'panel', panel: 'construction' }, meta.gatherMinutes)
    }
    if (!progress.budgetComplete) {
      if (snapshot.money >= project.budgetCost + CASH_SAFETY_FLOOR) {
        return task('pay-business-budget', `Pay ${project.businessName} budget`, `Pay ${project.budgetCost} to unlock interior labor for level ${project.levelTo}.`, 'respect', { kind: 'panel', panel: 'business' }, 10)
      }
      return task('work-for-business-budget', `Work for ${project.businessName}'s budget`, 'Earn before funding the upgrade so food and water stay safe.', 'work', { kind: 'panel', panel: 'work' }, STANDARD_DAY_BUDGET.workMinutes)
    }
    if (!progress.laborComplete) {
      const labor = businessDevelopmentLaborBreakdown(project)
      const helper = CONSTRUCTION_WORKERS.find((worker) => worker.id === 'helper')
      if (helper && labor.remainingMinutes >= 120 && snapshot.money >= helper.ratePerHour + CASH_SAFETY_FLOOR) {
        return task('hire-business-worker-hour', `Hire 1h worker for ${project.businessName}`, 'Keep the interior moving while your own day stays balanced.', 'capital', { kind: 'panel', panel: 'business' }, 5)
      }
      return task('develop-business-hour', `Work 60m inside ${project.businessName}`, 'Use free time after work and body care to build the business from the inside.', 'capital', { kind: 'panel', panel: 'business' }, 60)
    }
    return task('finish-business-development', `Finish ${project.businessName} L${project.levelTo}`, 'Materials, budget, and labor are ready. Make the interior upgrade permanent.', 'capital', { kind: 'panel', panel: 'business' }, 10)
  }
  const business = snapshot.assets.find((asset) => asset.kind === 'business') ?? null
  if (business) {
    return task('plan-business-development', 'Plan the next business upgrade', 'Turn profit into layout, tools, and service quality before chasing a second business.', 'capital', { kind: 'panel', panel: 'business' }, 20)
  }
  return task('build-first-business', 'Build the first business', 'Use stable home life to start an earning building, not instant magic income.', 'capital', { kind: 'market', focus: 'business' }, 45)
}

function communityPrimary(snapshot: LifeLadderSnapshot): LifePlanTask | null {
  if (snapshot.lifeDay < 2) return null
  if (snapshot.communityActionsThisWeek > 0) return null
  return task('help-local-person', 'Help one local person', 'Respect and friendship grow from showing up before anyone owes you.', 'community', { kind: 'panel', panel: 'achievements' }, 35)
}

function supportTasks(snapshot: LifeLadderSnapshot): LifePlanTask[] {
  const lowest = lowestNeed(snapshot.needs)
  const body = task('support-body', `Protect ${lowest}`, 'Drink, eat, clean up, or sleep before the day gets expensive.', 'body', { kind: 'market', focus: lowest === 'hydration' ? 'drinks' : lowest === 'hunger' ? 'food' : 'health' }, 30)
  const school = task('support-school', 'Learn one small thing', 'A course, certification, or focused practice makes future work easier.', 'school', { kind: 'market', focus: 'education' }, 45)
  const work = task(snapshot.jobId ? 'support-shift' : 'support-job', snapshot.jobId ? 'Keep work reliable' : 'Choose a job', 'Respect starts with showing up when you said you would.', 'work', { kind: 'panel', panel: 'work' }, snapshot.jobId ? STANDARD_DAY_BUDGET.workMinutes : 30)
  const respect = task('support-respect', 'Keep one commitment', 'Finish the shift, build hour, or study block you start today.', 'respect', { kind: 'panel', panel: 'achievements' }, 10)
  const friendship = task('support-friendship', 'Check on one friend', 'Friendship is not decoration. It keeps life stable when the grind gets hard.', 'friendship', { kind: 'panel', panel: 'achievements' }, 15)
  const community = task('support-community', 'Help one local person', 'Community grows trust first, rewards second.', 'community', { kind: 'panel', panel: 'achievements' }, 30)
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

function buildDailyRoutine(snapshot: LifeLadderSnapshot, primary: LifePlanTask, agenda: LifePlanTask[], support: LifePlanTask[]): LifeRoutineBlock[] {
  const taskPool = [primary, ...agenda, ...support]
  const bodyTask = primary.value === 'body' ? primary : firstTaskByValue(taskPool, ['body'])
  const workTask = firstTaskByValue(taskPool, ['work'])
  const growthTask = firstTaskByValue(taskPool, ['school', 'community', 'friendship', 'respect'])
  const capitalTask = firstTaskByValue(taskPool, ['capital'])
  const hasActiveBuild = snapshot.constructionProjects.length > 0 || snapshot.businessDevelopmentProjects.length > 0

  return [
    routineBlock(
      'sleep-block',
      'Sleep',
      'Protect the next day with a full rest window.',
      'body',
      { kind: 'panel', panel: snapshot.assets.some((asset) => asset.kind === 'home') ? 'home' : 'assets' },
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
): ConstructionDayForecast {
  const shortfall = constructionShortfall(project)
  const resourceTrips = RESOURCE_KINDS.map((kind) => {
    const missing = Math.max(0, shortfall[kind] - (resources[kind] ?? 0))
    const meta = RESOURCE_META[kind]
    const trips = Math.ceil(missing / meta.yieldAmount)
    return { kind, missing, trips, minutes: trips * meta.gatherMinutes }
  })
  const totalGatherMinutes = resourceTrips.reduce((sum, item) => sum + item.minutes, 0)
  const remainingLaborMinutes = constructionLaborBreakdown(project).remainingMinutes
  const helper = CONSTRUCTION_WORKERS.find((worker) => worker.id === 'helper')
  const helperDailyMinutes = helper ? Math.round(2 * 60 * helper.laborMultiplier) : 0
  const helperCost = helper ? helper.ratePerHour * 2 : 0
  const helperCashNeeded = Math.max(0, helperCost + cashSafetyFloor - money)
  return {
    remainingLaborMinutes,
    playerOnlyDaysAtOneHour: Math.ceil(remainingLaborMinutes / 60),
    playerOnlyDaysAtTwoHours: Math.ceil(remainingLaborMinutes / 120),
    helperTwoHourDays: Math.ceil(remainingLaborMinutes / (60 + helperDailyMinutes)),
    helperTwoHourLaborMinutes: helperDailyMinutes,
    helperTwoHourCost: helperCost,
    helperTwoHourAffordableToday: helperCashNeeded <= 0,
    helperTwoHourCashNeeded: helperCashNeeded,
    resourceTrips,
    totalGatherMinutes,
  }
}

export function planLifeDay(snapshot: LifeLadderSnapshot): LifePlan {
  const active = snapshot.activityKind
    ? task('finish-active-commitment', 'Finish the current commitment', 'Respect grows when you finish what you start.', 'respect', { kind: 'none' }, 0)
    : null
  const body = bodyRecoveryTask(snapshot)
  const work = workPrimary(snapshot)
  const school = schoolPrimary(snapshot)
  const construction = constructionPrimary(snapshot)
  const community = communityPrimary(snapshot)
  const business = businessPrimary(snapshot)
  const businessBeforeCommunity = business && business.id !== 'build-first-business' ? business : null
  const steady = task('steady-owner-day', 'Run a steady owner day', 'Collect, study, help someone, and reinvest the surplus.', 'capital', { kind: 'panel', panel: 'assets' }, 60)
  const primary =
    active
    ?? body
    ?? work
    ?? school
    ?? construction
    ?? businessBeforeCommunity
    ?? community
    ?? business
    ?? steady

  const support = supportTasks(snapshot)
  const agenda = compactAgenda([
    primary,
    body,
    work,
    school,
    construction,
    businessBeforeCommunity,
    community,
    business,
    ...support,
    steady,
  ])
  const valuesCovered = Array.from(new Set([primary, ...support].map((item) => item.value)))
  const activeProject = activeConstructionProject(snapshot)
  const hasHome = snapshot.assets.some((asset) => asset.kind === 'home')
  return {
    lifeDay: snapshot.lifeDay,
    primary,
    agenda,
    support,
    routine: buildDailyRoutine(snapshot, primary, agenda, support),
    valuesCovered,
    timeBudget: STANDARD_DAY_BUDGET,
    constructionForecast: activeProject || !hasHome
      ? constructionDayForecast(activeProject ?? undefined, snapshot.resources, snapshot.money)
      : null,
  }
}
