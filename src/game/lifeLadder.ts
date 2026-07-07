import {
  CONSTRUCTION_WORKERS,
  STARTER_HOUSE_RECIPE,
  constructionLaborBreakdown,
  constructionProgress,
  constructionShortfall,
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
  resourceTrips: ResourceTripForecast[]
  totalGatherMinutes: number
}

export interface LifePlan {
  lifeDay: number
  primary: LifePlanTask
  support: LifePlanTask[]
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
  activityKind: 'sleep' | 'shift' | 'cook' | 'gather' | 'construction' | null
  assets: { kind: AssetKind; incomePerDay: number }[]
  resources: ResourceInventory
  constructionProjects: ConstructionProject[]
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
    ?? RESOURCE_KINDS.find((kind) => missing[kind] > 0)
    ?? null
}

function constructionPrimary(snapshot: LifeLadderSnapshot): LifePlanTask | null {
  if (snapshot.assets.some((asset) => asset.kind === 'home')) return null
  const project = snapshot.constructionProjects.find((candidate) => candidate.resultKind === 'home') ?? null
  if (!project) {
    return task('place-home-foundation', 'Place your Starter House foundation', 'A serious life needs a door. Pick a reachable map spot near home.', 'capital', { kind: 'panel', panel: 'construction' }, 30)
  }

  const progress = constructionProgress(project)
  if (!progress.resourcesComplete) {
    const kind = firstMissingResource(project, snapshot.resources)
    if (!kind) return task('deposit-house-materials', 'Deposit house materials', 'Move gathered ingredients into the foundation so the build can advance.', 'capital', { kind: 'panel', panel: 'construction' }, 15)
    const meta = RESOURCE_META[kind]
    return task(`gather-${kind}`, `Gather ${meta.label.toLowerCase()}`, `${project.name} still needs ${meta.label.toLowerCase()}. Gather locally, then deposit it.`, 'capital', { kind: 'panel', panel: 'construction' }, meta.gatherMinutes)
  }
  if (!progress.permitComplete) {
    if (snapshot.money >= project.permitFee + CASH_SAFETY_FLOOR) {
      return task('pay-house-permit', 'Pay the building permit', `Pay ${project.permitFee} and keep the build legal.`, 'respect', { kind: 'panel', panel: 'construction' }, 10)
    }
    return task('work-for-permit', 'Work for permit money', 'Earn before paying the permit so food and water stay safe.', 'work', { kind: 'panel', panel: 'work' }, STANDARD_DAY_BUDGET.workMinutes)
  }
  if (!progress.laborComplete) {
    return task('build-house-hour', 'Work 60m on your house', 'Use free time after work and body care to move the house forward.', 'capital', { kind: 'panel', panel: 'construction' }, 60)
  }
  return task('complete-house', 'Complete the house', 'Materials, permit, and labor are ready. Finish it and enter your own place.', 'capital', { kind: 'panel', panel: 'construction' }, 10)
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
  if (snapshot.assets.some((asset) => asset.kind === 'business')) {
    return task('collect-and-reinvest', 'Collect and reinvest profits', 'Owner days are still serious days: collect income, then upgrade or save.', 'capital', { kind: 'panel', panel: 'assets' }, 20)
  }
  return task('build-first-business', 'Build the first business', 'Use stable home life to start an earning building, not instant magic income.', 'capital', { kind: 'market', focus: 'business' }, 45)
}

function supportTasks(snapshot: LifeLadderSnapshot): LifePlanTask[] {
  const lowest = lowestNeed(snapshot.needs)
  const body = task('support-body', `Protect ${lowest}`, 'Drink, eat, clean up, or sleep before the day gets expensive.', 'body', { kind: 'market', focus: lowest === 'hydration' ? 'drinks' : lowest === 'hunger' ? 'food' : 'health' }, 30)
  const school = task('support-school', 'Learn one small thing', 'A course, certification, or focused practice makes future work easier.', 'school', { kind: 'market', focus: 'education' }, 45)
  const work = task(snapshot.jobId ? 'support-shift' : 'support-job', snapshot.jobId ? 'Keep work reliable' : 'Choose a job', 'Respect starts with showing up when you said you would.', 'work', { kind: 'panel', panel: 'work' }, snapshot.jobId ? STANDARD_DAY_BUDGET.workMinutes : 30)
  const respect = task('support-respect', 'Keep one commitment', 'Finish the shift, build hour, or study block you start today.', 'respect', { kind: 'panel', panel: 'achievements' }, 10)
  const friendship = task('support-friendship', 'Check on one friend', 'Friendship is not decoration. It keeps life stable when the grind gets hard.', 'friendship', { kind: 'panel', panel: 'achievements' }, 15)
  const community = task('support-community', 'Help one local person', 'Community grows trust first, rewards second.', 'community', { kind: 'panel', panel: 'achievements' }, 30)
  const capital = task('support-capital', snapshot.constructionProjects.length > 0 ? 'Move the build forward' : 'Save toward ownership', 'Turn work into a house, then a business, then cashflow.', 'capital', { kind: 'panel', panel: snapshot.constructionProjects.length > 0 ? 'construction' : 'assets' }, 60)
  return [body, school, work, respect, friendship, community, capital]
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
    permitFee: STARTER_HOUSE_RECIPE.permitFee,
    permitFeePaid: false,
    incomePerDay: 0,
    status: 'planned',
    placedAt: 0,
  },
  resources: ResourceInventory = freshResources(),
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
  return {
    remainingLaborMinutes,
    playerOnlyDaysAtOneHour: Math.ceil(remainingLaborMinutes / 60),
    playerOnlyDaysAtTwoHours: Math.ceil(remainingLaborMinutes / 120),
    helperTwoHourDays: Math.ceil(remainingLaborMinutes / (60 + helperDailyMinutes)),
    resourceTrips,
    totalGatherMinutes,
  }
}

export function planLifeDay(snapshot: LifeLadderSnapshot): LifePlan {
  const active = snapshot.activityKind
    ? task('finish-active-commitment', 'Finish the current commitment', 'Respect grows when you finish what you start.', 'respect', { kind: 'none' }, 0)
    : null
  const primary =
    active
    ?? bodyRecoveryTask(snapshot)
    ?? workPrimary(snapshot)
    ?? schoolPrimary(snapshot)
    ?? constructionPrimary(snapshot)
    ?? businessPrimary(snapshot)
    ?? task('steady-owner-day', 'Run a steady owner day', 'Collect, study, help someone, and reinvest the surplus.', 'capital', { kind: 'panel', panel: 'assets' }, 60)

  const support = supportTasks(snapshot)
  const valuesCovered = Array.from(new Set([primary, ...support].map((item) => item.value)))
  const homeProject = snapshot.constructionProjects.find((candidate) => candidate.resultKind === 'home') ?? null
  return {
    lifeDay: snapshot.lifeDay,
    primary,
    support,
    valuesCovered,
    timeBudget: STANDARD_DAY_BUDGET,
    constructionForecast: homeProject || !snapshot.assets.some((asset) => asset.kind === 'home')
      ? constructionDayForecast(homeProject ?? undefined, snapshot.resources)
      : null,
  }
}
