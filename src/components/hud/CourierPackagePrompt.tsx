import { courierRequirementMet, courierRequirementProgress } from '../../game/courierPackages'
import { educationActionCount } from '../../game/education'
import { RESOURCE_META, type ResourceKind } from '../../game/resources'
import { useIsMobile } from '../../lib/useIsMobile'
import { useGame } from '../../store/gameStore'

function firstResourceFromRequirement(requirement: { kind: string; resource?: ResourceKind; resources?: Partial<Record<ResourceKind, number>> }): ResourceKind | null {
  if (requirement.kind === 'resource' && requirement.resource) return requirement.resource
  if (requirement.kind === 'construction-deposit' && requirement.resources) {
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
  const activity = useGame((s) => s.activity)
  const placing = useGame((s) => s.placing)
  const placingConstruction = useGame((s) => s.placingConstruction)
  const isMobile = useIsMobile()

  if (!pkg || panel || !targetsSeen) return null
  // A phone screen fits one commitment: while a shift/sleep/etc. runs (guide,
  // opt-in nudge and activity banner stacked at the bottom) or the player is
  // placing a building (ghost pin + Place-here confirm own the screen), the
  // day's mission steps aside. It returns the moment the citizen is free.
  // Desktop has room for both.
  if (isMobile && (activity || placing || placingConstruction)) return null

  const ready = courierRequirementMet(pkg, {
    timesEaten,
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
  const progress = courierRequirementProgress(pkg, {
    timesEaten,
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
        if (resourceNode) startGatherResource(resourceNode.id)
        return
      case 'construction-site':
        startPlacingConstruction()
        return
      case 'construction-deposit':
        if (project) depositConstructionResources(project.id)
        else startPlacingConstruction()
        return
      case 'construction-labor':
      case 'home-built-or-progress':
        if (project) startConstructionWork(project.id)
        else startPlacingConstruction()
        return
      default:
        complete()
    }
  }

  const label = ready
    ? 'Claim reward'
    : pkg.requirement.kind === 'food'
      ? 'Find food'
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
          : pkg.requirement.kind === 'construction-deposit'
            ? project ? 'Deposit materials' : 'Place site'
            : pkg.requirement.kind === 'construction-labor' || pkg.requirement.kind === 'home-built-or-progress'
              ? project ? 'Work 60m' : 'Place site'
              : resourceKind
                ? `Gather ${RESOURCE_META[resourceKind].label}`
                : 'Open package'

  const actionLabel = ready ? 'Claim reward' : progress.nextAction

  return (
    <div className="courier-package" role="status" aria-live="polite">
      <div className="courier-stamp mono">DAY {pkg.day}</div>
      <div className="courier-body">
        <h2 className="courier-title">{pkg.title}</h2>
        <p className="courier-story">{opened ? pkg.story : 'A courier package is waiting at your door.'}</p>
        <p className="courier-objective">{pkg.objective}</p>
        <p className={`courier-progress${ready ? ' ready' : ''}`} role="status" aria-label={`Courier progress: ${progress.detail}`}>
          {progress.detail}
        </p>
        {!ready && progress.missing.length > 0 && (
          <p className="courier-missing" role="note">Needs: {progress.missing.join(' · ')}</p>
        )}
        <span className="courier-reward mono">+${pkg.rewardCash} · +{pkg.rewardXp} XP</span>
      </div>
      <div className="courier-actions">
        <button className={`btn small ${ready ? 'primary' : ''}`} onClick={primaryAction} aria-label={`${actionLabel}. ${ready ? 'Claim courier reward.' : progress.missing.join(' ')}`}>
          {label}
        </button>
        <button className="btn small ghost" onClick={() => setPanel('construction')} aria-label="Open construction panel">
          Build
        </button>
      </div>
    </div>
  )
}
