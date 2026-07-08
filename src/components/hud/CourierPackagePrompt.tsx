import { courierRequirementMet } from '../../game/courierPackages'
import { educationActionCount } from '../../game/education'
import { RESOURCE_META, type ResourceKind } from '../../game/resources'
import { useGame } from '../../store/gameStore'

function firstResourceFromRequirement(requirement: { kind: string; resource?: ResourceKind; resources?: Partial<Record<ResourceKind, number>> }): ResourceKind | null {
  if ((requirement.kind === 'resource' || requirement.kind === 'resource-gathered') && requirement.resource) return requirement.resource
  if ((requirement.kind === 'construction-deposit' || requirement.kind === 'construction-deposit-complete') && requirement.resources) {
    return (Object.keys(requirement.resources)[0] as ResourceKind | undefined) ?? null
  }
  return null
}

export default function CourierPackagePrompt() {
  const pkg = useGame((s) => s.activeCourierPackage)
  const panel = useGame((s) => s.panel)
  const targetsSeen = useGame((s) => s.targetsSeen)
  const opened = useGame((s) => pkg ? s.courierOpenedDays.includes(pkg.day) : false)
  const timesEaten = useGame((s) => s.timesEaten)
  const sawStreetMode = useGame((s) => s.sawStreetMode)
  const jobId = useGame((s) => s.jobId)
  const shiftsWorked = useGame((s) => s.shiftsWorked)
  const educationProgress = useGame((s) => s.educationProgress)
  const community = useGame((s) => s.community)
  const dailyCounters = useGame((s) => s.dailyCounters)
  const resources = useGame((s) => s.resources)
  const constructionProjects = useGame((s) => s.constructionProjects)
  const hasHome = useGame((s) => s.assets.some((asset) => asset.kind === 'home'))
  const resourceNodes = useGame((s) => s.resourceNodes)
  const open = useGame((s) => s.openCourierPackage)
  const complete = useGame((s) => s.completeCourierPackage)
  const openMarket = useGame((s) => s.openMarket)
  const setStreetMode = useGame((s) => s.setStreetMode)
  const startGatherResource = useGame((s) => s.startGatherResource)
  const startPlacingConstruction = useGame((s) => s.startPlacingConstruction)
  const depositConstructionResources = useGame((s) => s.depositConstructionResources)
  const startConstructionWork = useGame((s) => s.startConstructionWork)
  const setPanel = useGame((s) => s.setPanel)

  if (!pkg || panel || !targetsSeen) return null

  const ready = courierRequirementMet(pkg, {
    timesEaten,
    cookedToday: dailyCounters.cookedToday,
    consumedItemCountsToday: dailyCounters.consumedItemCountsToday,
    drinksToday: dailyCounters.drinksToday,
    hygieneToday: dailyCounters.hygieneToday,
    boughtToday: dailyCounters.boughtToday,
    workersHiredToday: dailyCounters.workersHiredToday,
    gatheredResourceAmountsToday: dailyCounters.gatheredResourceAmountsToday,
    sawStreetMode,
    resources,
    constructionProjects,
    hasHome,
    jobId,
    shiftsWorked,
    educationProgress,
    educationActions: educationActionCount(educationProgress),
    communityActionsThisWeek: community.actionsThisWeek,
  })
  const resourceKind = firstResourceFromRequirement(pkg.requirement)
  const resourceNode = resourceKind ? resourceNodes.find((node) => node.kind === resourceKind) : null
  const project = constructionProjects[0]

  const primaryAction = () => {
    open()
    if (ready) {
      complete()
      return
    }
    switch (pkg.requirement.kind) {
      case 'food':
        openMarket('food')
        return
      case 'cooked-meal':
        setPanel('cook')
        return
      case 'item-consumed':
        openMarket('food')
        return
      case 'job':
      case 'shift':
        setPanel('work')
        return
      case 'education-enrolled':
      case 'education-study':
      case 'education':
        openMarket('education')
        return
      case 'community':
        setPanel('achievements')
        return
      case 'street-mode-seen':
        setStreetMode(true)
        return
      case 'resource':
      case 'resource-gathered':
        if (resourceNode) startGatherResource(resourceNode.id)
        return
      case 'construction-site':
        startPlacingConstruction()
        return
      case 'construction-deposit':
      case 'construction-deposit-complete':
        if (project) depositConstructionResources(project.id)
        else startPlacingConstruction()
        return
      case 'construction-permit-complete':
      case 'construction-permit':
        setPanel('construction')
        return
      case 'construction-labor':
      case 'home-built-or-progress':
      case 'construction-built':
        if (project) startConstructionWork(project.id)
        else startPlacingConstruction()
        return
      case 'worker-hired':
        setPanel('construction')
        return
      case 'business-development-site':
      case 'business-development-deposit':
      case 'business-development-deposit-complete':
      case 'business-development-budget':
      case 'business-development-budget-complete':
      case 'business-development-labor':
      case 'business-upgraded':
        setPanel('business')
        return
      default:
        complete()
    }
  }

  const label = ready
    ? 'Claim reward'
    : pkg.requirement.kind === 'food'
      ? 'Find food'
      : pkg.requirement.kind === 'cooked-meal'
        ? 'Cook meal'
        : pkg.requirement.kind === 'item-consumed'
          ? 'Use item'
      : pkg.requirement.kind === 'job'
        ? 'Find work'
        : pkg.requirement.kind === 'shift'
          ? 'Work shift'
          : pkg.requirement.kind === 'education-enrolled'
            ? 'Enroll'
            : pkg.requirement.kind === 'education-study'
              ? 'Study'
            : pkg.requirement.kind === 'education'
              ? 'Study'
            : pkg.requirement.kind === 'community'
              ? 'Help'
      : pkg.requirement.kind === 'street-mode-seen'
        ? 'Walk'
        : pkg.requirement.kind === 'construction-site'
          ? 'Place site'
          : pkg.requirement.kind === 'construction-deposit' || pkg.requirement.kind === 'construction-deposit-complete'
            ? project ? 'Deposit materials' : 'Place site'
            : pkg.requirement.kind === 'construction-permit' || pkg.requirement.kind === 'construction-permit-complete'
              ? 'Pay permit'
            : pkg.requirement.kind === 'worker-hired'
              ? 'Hire worker'
            : pkg.requirement.kind === 'construction-labor' || pkg.requirement.kind === 'home-built-or-progress' || pkg.requirement.kind === 'construction-built'
              ? project ? 'Work 60m' : 'Place site'
              : pkg.requirement.kind === 'business-development-site' ||
                  pkg.requirement.kind === 'business-development-deposit' ||
                  pkg.requirement.kind === 'business-development-deposit-complete' ||
                  pkg.requirement.kind === 'business-development-budget' ||
                  pkg.requirement.kind === 'business-development-budget-complete' ||
                  pkg.requirement.kind === 'business-development-labor' ||
                  pkg.requirement.kind === 'business-upgraded'
                ? 'Open business'
              : resourceKind
                ? `Gather ${RESOURCE_META[resourceKind].label}`
                : 'Open package'

  return (
    <div className="courier-package" role="status" aria-live="polite">
      <div className="courier-stamp mono">DAY {pkg.day}</div>
      <div className="courier-body">
        <h2 className="courier-title">{pkg.title}</h2>
        <p className="courier-story">{opened ? pkg.story : 'A courier package is waiting at your door.'}</p>
        <p className="courier-objective">{pkg.objective}</p>
        <span className="courier-reward mono">+${pkg.rewardCash} · +{pkg.rewardXp} XP</span>
      </div>
      <div className="courier-actions">
        <button className={`btn small ${ready ? 'primary' : ''}`} onClick={primaryAction}>
          {label}
        </button>
        <button className="btn small ghost" onClick={() => setPanel('construction')}>
          Build
        </button>
      </div>
    </div>
  )
}
