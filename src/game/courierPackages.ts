import { RESOURCE_META, type ResourceKind } from './resources'
import type { ConstructionProject } from './construction'
import type { EducationCourseId, EducationProgress } from './education'
import type { LifePlanTask } from './lifeLadder'

export type CourierRequirement =
  | { kind: 'none' }
  | { kind: 'food'; timesEaten: number }
  | { kind: 'job' }
  | { kind: 'shift'; shiftsWorked: number }
  | { kind: 'education-enrolled'; courseId: EducationCourseId }
  | { kind: 'education'; educationActions: number }
  | { kind: 'community'; actionsThisWeek: number }
  | { kind: 'street-mode-seen' }
  | { kind: 'resource'; resource: ResourceKind; amount: number }
  | { kind: 'construction-site' }
  | { kind: 'construction-deposit'; resources: Partial<Record<ResourceKind, number>> }
  | { kind: 'construction-labor'; minutes: number }
  | { kind: 'home-built-or-progress'; laborMinutes: number }

export interface CourierPackage {
  day: number
  title: string
  story: string
  objective: string
  rewardCash: number
  rewardXp: number
  requirement: CourierRequirement
  targetResource?: ResourceKind
}

export interface CourierSnapshot {
  timesEaten: number
  sawStreetMode: boolean
  resources: Partial<Record<ResourceKind, number>>
  constructionProjects: ConstructionProject[]
  hasHome: boolean
  jobId?: string | null
  shiftsWorked?: number
  educationProgress?: EducationProgress[]
  educationActions?: number
  communityActionsThisWeek?: number
}

export const COURIER_MVP_DAYS = 10
export const COURIER_CAMPAIGN_DAYS = 60

export const COURIER_PACKAGES: CourierPackage[] = [
  {
    day: 1,
    title: 'The first package',
    story: 'A courier knocks once and hands you a sealed envelope: one instruction per day. That is how the city teaches.',
    objective: 'Open your first package and learn the rule.',
    rewardCash: 75,
    rewardXp: 20,
    requirement: { kind: 'none' },
  },
  {
    day: 2,
    title: 'Eat in the city',
    story: 'The package smells faintly of bread. Today is about finding food before ambition gets loud.',
    objective: 'Eat once from the Market or a food stop.',
    rewardCash: 125,
    rewardXp: 25,
    requirement: { kind: 'food', timesEaten: 1 },
  },
  {
    day: 3,
    title: 'Walk the neighborhood',
    story: 'The courier leaves a folded street map. The city is not a menu. It is a place.',
    objective: 'Enter Walk mode at least once.',
    rewardCash: 150,
    rewardXp: 30,
    requirement: { kind: 'street-mode-seen' },
  },
  {
    day: 4,
    title: 'Bring back wood',
    story: 'A pencil mark circles a patch of green. Every home starts with something carried by hand.',
    objective: 'Gather at least 25 wood.',
    rewardCash: 175,
    rewardXp: 35,
    requirement: { kind: 'resource', resource: 'wood', amount: 25 },
    targetResource: 'wood',
  },
  {
    day: 5,
    title: 'Stone for the foundation',
    story: 'Today the envelope is heavier. The note says: a door needs a foundation before it needs a key.',
    objective: 'Gather at least 15 stone.',
    rewardCash: 200,
    rewardXp: 40,
    requirement: { kind: 'resource', resource: 'stone', amount: 15 },
    targetResource: 'stone',
  },
  {
    day: 6,
    title: 'Place the foundation',
    story: 'The courier brings a permit sketch. Pick the spot where your first real home will stand.',
    objective: 'Place a Starter House construction site.',
    rewardCash: 250,
    rewardXp: 50,
    requirement: { kind: 'construction-site' },
  },
  {
    day: 7,
    title: 'Feed the frame',
    story: 'A checklist is clipped to the package: wood, stone, patience.',
    objective: 'Deposit at least 25 wood and 15 stone into your construction site.',
    rewardCash: 300,
    rewardXp: 55,
    requirement: { kind: 'construction-deposit', resources: { wood: 25, stone: 15 } },
  },
  {
    day: 8,
    title: 'Metal and glass',
    story: 'The courier points past the trees toward the industrial edge of town. The house needs strength and light.',
    objective: 'Gather at least 8 metal and 5 glass.',
    rewardCash: 350,
    rewardXp: 60,
    requirement: { kind: 'construction-deposit', resources: { metal: 8, glass: 5 } },
  },
  {
    day: 9,
    title: 'Put in the hours',
    story: 'No material replaces labor. Today the city asks for sweat equity.',
    objective: 'Complete at least 60 minutes of construction labor.',
    rewardCash: 400,
    rewardXp: 70,
    requirement: { kind: 'construction-labor', minutes: 60 },
  },
  {
    day: 10,
    title: 'A door of your own',
    story: 'The courier leaves the package on the foundation. Finish it now, or prove the house is truly underway.',
    objective: 'Own a home or complete at least 120 minutes of construction labor.',
    rewardCash: 500,
    rewardXp: 90,
    requirement: { kind: 'home-built-or-progress', laborMinutes: 120 },
  },
]

export function courierPackageForDay(citizenAgeDay: number): CourierPackage | null {
  if (citizenAgeDay < 1 || citizenAgeDay > COURIER_MVP_DAYS) return null
  return COURIER_PACKAGES[citizenAgeDay - 1] ?? null
}

export function courierRequirementMet(pkg: CourierPackage, snapshot: CourierSnapshot): boolean {
  const requirement = pkg.requirement
  switch (requirement.kind) {
    case 'none':
      return true
    case 'food':
      return snapshot.timesEaten >= requirement.timesEaten
    case 'job':
      return Boolean(snapshot.jobId)
    case 'shift':
      return (snapshot.shiftsWorked ?? 0) >= requirement.shiftsWorked
    case 'education-enrolled':
      return (snapshot.educationProgress ?? []).some((progress) => progress.courseId === requirement.courseId)
    case 'education':
      return (snapshot.educationActions ?? 0) >= requirement.educationActions
    case 'community':
      return (snapshot.communityActionsThisWeek ?? 0) >= requirement.actionsThisWeek
    case 'street-mode-seen':
      return snapshot.sawStreetMode
    case 'resource':
      return (snapshot.resources[requirement.resource] ?? 0) >= requirement.amount
    case 'construction-site':
      return snapshot.constructionProjects.length > 0 || snapshot.hasHome
    case 'construction-deposit':
      return snapshot.constructionProjects.some((project) =>
        Object.entries(requirement.resources).every(
          ([kind, amount]) => project.deposited[kind as ResourceKind] >= (amount ?? 0),
        ),
      ) || snapshot.hasHome
    case 'construction-labor':
      return snapshot.constructionProjects.some((project) => project.laborDoneMinutes >= requirement.minutes) || snapshot.hasHome
    case 'home-built-or-progress':
      return snapshot.hasHome || snapshot.constructionProjects.some((project) => project.laborDoneMinutes >= requirement.laborMinutes)
  }
}

export function shouldCreateCourierPackage(args: {
  citizenAgeDay: number
  localDay: number
  courierLastDay: number
  completedDays: number[]
}): CourierPackage | null {
  if (args.courierLastDay === args.localDay) return null
  if (args.completedDays.includes(args.citizenAgeDay)) return null
  return courierPackageForDay(args.citizenAgeDay)
}

export function courierPackageForLifePlan(citizenAgeDay: number, primary: LifePlanTask, snapshot: CourierSnapshot): CourierPackage | null {
  const base = courierPackageForDay(citizenAgeDay)
  if (!base) return null
  const requirement = courierRequirementForLifePlan(primary, snapshot) ?? base.requirement
  const targetResource = primary.route.kind === 'gather' ? primary.route.resourceKind : base.targetResource
  return {
    ...base,
    title: primary.title,
    story: `${base.story} Today's note points at the Life Ladder: ${primary.detail}`,
    objective: primary.title,
    requirement,
    targetResource,
  }
}

function courierRequirementForLifePlan(primary: LifePlanTask, snapshot: CourierSnapshot): CourierRequirement | null {
  const route = primary.route
  if (route.kind === 'panel' && route.panel === 'work') return { kind: 'job' }
  if (route.kind === 'work-action') return { kind: 'shift', shiftsWorked: (snapshot.shiftsWorked ?? 0) + 1 }
  if (route.kind === 'market' && route.focus === 'education') return { kind: 'education-enrolled', courseId: 'course' }
  if (route.kind === 'education-action') {
    return { kind: 'education', educationActions: (snapshot.educationActions ?? 0) + 1 }
  }
  if (route.kind === 'community-action') return { kind: 'community', actionsThisWeek: (snapshot.communityActionsThisWeek ?? 0) + 1 }
  if (route.kind === 'gather') {
    return {
      kind: 'resource',
      resource: route.resourceKind,
      amount: (snapshot.resources[route.resourceKind] ?? 0) + RESOURCE_META[route.resourceKind].yieldAmount,
    }
  }
  if (route.kind === 'construction-action') {
    const project = snapshot.constructionProjects.find((candidate) => candidate.id === route.projectId)
    if (route.action === 'work' || route.action === 'hire-helper') {
      return { kind: 'construction-labor', minutes: (project?.laborDoneMinutes ?? 0) + 60 }
    }
    if (route.action === 'complete') {
      return { kind: 'home-built-or-progress', laborMinutes: project?.laborDoneMinutes ?? 0 }
    }
    return null
  }
  if (route.kind === 'panel' && route.panel === 'construction') return { kind: 'construction-site' }
  if (route.kind === 'consume-action' || route.kind === 'cook-action' || (route.kind === 'market' && route.focus === 'food')) {
    return { kind: 'food', timesEaten: snapshot.timesEaten + 1 }
  }
  return null
}
