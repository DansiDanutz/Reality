import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, test } from 'vitest'
import type { RealityFounderCovenantReviewQueueDashboard } from '../../lib/realityArea'
import FounderCovenantOperatorPanel from './FounderCovenantOperatorPanel'
import {
  founderCovenantOperatorQueueApprovalSummary,
  founderCovenantOperatorQueueBlockerSummary,
  founderCovenantOperatorQueueEvidenceSummary,
  founderCovenantOperatorQueueOverdueCleanupSummary,
  founderCovenantOperatorQueueRecordReadySummary,
} from './founderAreaPanelView'
import { withRecordReadyCadenceFounder } from './founderCovenantTestHelpers'
import {
  formatCopiedContextClearedMessage,
  formatQueueLoadMessage,
  formatReviewRecordSuccessMessage,
  formatOperatorSessionClearedMessage,
  queueFounderWarningTelegramText,
  queueDigestText,
  queueHandoffText,
  queueManualReviewTelegramText,
  queueActionPresetLabel,
  queueCopiedStatusSummary,
  queueContextText,
  queueCoveragePresetLabel,
  queuePresetLabel,
  queuePriorityPresetLabel,
  queuePresetChipTone,
  queueSortChipTone,
  queueTelegramOutputsSummary,
  queueTelegramScaffoldText,
  queueViewChipTone,
} from './founderCovenantOperatorQueueView'

describe('FounderCovenantOperatorPanel', () => {
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window
  })

  test('restores locally persisted review drafts for operator evidence work', () => {
    const storage = createStorage()
    storage.setItem('reality-founder-covenant-operator-view-v1', JSON.stringify({
      cursor: 'review-cursor-4',
      filter: 'manual_review',
      sort: 'priority',
      draftReviewNote: 'Need a clearer proof of activity.',
      draftReviewEvidenceKinds: ['population_growth', 'ideas_feedback'],
    }))
    ;(globalThis as { window?: { localStorage: Storage } }).window = { localStorage: storage }

    const html = renderToStaticMarkup(<FounderCovenantOperatorPanel />)

    expect(html).toContain('Need a clearer proof of activity.')
    expect(html).toContain('checked=""')
    expect(html).toContain('Clear draft')
    expect(html).toContain('Local draft: Population, Ideas · note &quot;Need a clearer proof of activity.&quot;')
  })

  test('renders an isolated operator queue shell without a loaded token', () => {
    const html = renderToStaticMarkup(<FounderCovenantOperatorPanel />)

    expect(html).toContain('Founder Ops')
    expect(html).toContain('Operator token')
    expect(html).toContain('Telegram operator auth idle')
    expect(html).toContain('enforcement locked')
    expect(html).toContain('ephemeral token')
    expect(html).toContain('player state isolated')
    expect(html).toContain('evidence writes only')
    expect(html).toContain('Review note')
    expect(html).toContain('Population')
    expect(html).toContain('Clear draft')
    expect(html).toContain('No operator queue loaded.')
    expect(html).not.toContain('operator-token')
    expect(html).not.toContain('Approve')
    expect(html).not.toContain('Replace')
  })

  test('renders an initial queue through the evidence-only queue panel', () => {
    const html = renderToStaticMarkup(<FounderCovenantOperatorPanel initialQueue={operatorQueue()} />)

    expect(html).toContain('Founder Review Queue')
    expect(html).toContain('Evidence only')
    expect(html).toContain('#0012 · Bucharest Founder Block')
    expect(html).toContain('Activity: Manual: Active no, Hospitalized yes, At risk yes · Watch: Useful no, Staffed no, Indebted yes · Met: Building yes')
    expect(html).toContain('Exposure: Founder $199,500 · debt $350 (1) · businesses 2 / $25 · unstaffed 1 · uninsured · hospitalized · game credits only')
    expect(html).toContain('Stages: Suggested: Warning · Locked: Active, Probation, Removed, Waitlist replacement')
    expect(html).toContain('Readiness: Blocked: 3 approval blockers before enforcement. · 3 evidence gaps, 1 approval request, 3 blockers, overdue')
    expect(html).toContain('Evidence: Population growth, External contribution, Ideas and feedback')
    expect(html).toContain('Actions: Record review evidence-only, Send warning locked')
    expect(html).toContain('Approvals: Send warning locked (2 blockers)')
    expect(html).toContain('Drafts: Manual review locked (Telegram)')
    expect(html).toContain('class="founder-ledger-chip warning"><span>Telegram</span><strong>Telegram manual + warning</strong></span>')
    expect(html).toContain('Priority: manual review, never reviewed, overdue, hospitalized, at risk')
    expect(html).toContain('Filter: All')
    expect(html).toContain('1 founder in current page · 1 never · 0 stale · 0 fresh')
    expect(html).toContain('All 1 · Never 1 · Stale 0 · Stale week 0 · Stale month 0 · Weekly due 0 · Monthly due 0 · Fresh 0 · Manual 1 · Evidence 1 · Next evidence 1 · Next blocked 0 · Next overdue 0 · Next record 0 · Next monitor 0 · Overdue 1 · Blocked 1 · Hospital 1 · Inactive 1 · Debt 1 · Risk 1 · Telegram 1 · Scan 0')
    expect(html).toContain('Sort: Priority')
    expect(html).toContain('Coverage')
    expect(html).toContain('<span>Never</span><strong>1</strong>')
    expect(html).toContain('<span>Fresh</span><strong>0</strong>')
    expect(html).toContain('<span>Stale</span><strong>0</strong>')
    expect(html).toContain('<span>Stale week</span><strong>0</strong>')
    expect(html).toContain('<span>Stale month</span><strong>0</strong>')
    expect(html).toContain('aria-label="Founder operator queue action mix"')
    expect(html).toContain('<span>Evidence next</span><strong>1</strong>')
    expect(html).toContain('<span>Blocked next</span><strong>0</strong>')
    expect(html).toContain('<span>Overdue next</span><strong>0</strong>')
    expect(html).toContain('aria-label="Founder operator queue view summary"')
    expect(html).toContain('class="founder-ledger-chip stable"><span>View</span><strong>All</strong>')
    expect(html).toContain('class="founder-ledger-chip stable"><span>Sort</span><strong>Priority</strong>')
    expect(html).not.toContain('<span>Preset</span>')
    expect(html).toContain('<span>Cursor</span><strong>start</strong>')
    expect(html).toContain('<span>Resume</span><strong>more</strong>')
    expect(html).toContain('<span>Weekly ready</span><strong>0</strong>')
    expect(html).toContain('<span>Monthly ready</span><strong>0</strong>')
    expect(html).toContain('title="Evidence: 1 founder queued · 3 gaps · 0 record ready"')
    expect(html).toContain('class="founder-ledger-chip warning" title="Evidence: 1 founder queued · 3 gaps · 0 record ready"><span>Evidence</span><strong>3</strong>')
    expect(html).toContain('title="Record ready: 0 founders · 0 weekly · 0 monthly"')
    expect(html).toContain('class="founder-ledger-chip warning" title="Record ready: 0 founders · 0 weekly · 0 monthly"><span>Record ready</span><strong>0</strong>')
    expect(html).toContain('title="Overdue cleanup: 0 founders · 1 overdue · 0 stale"')
    expect(html).toContain('class="founder-ledger-chip stable" title="Overdue cleanup: 0 founders · 1 overdue · 0 stale"><span>Overdue cleanup</span><strong>0</strong>')
    expect(html).toContain('title="Blockers: 3 total · 1 overdue · 1 hospitalized · 1 indebted"')
    expect(html).toContain('class="founder-ledger-chip critical" title="Blockers: 3 total · 1 overdue · 1 hospitalized · 1 indebted"><span>Blockers</span><strong>3</strong>')
    expect(html).toContain('title="Approvals: 1 warning · 0 probation · 0 replacement · 1 total"')
    expect(html).toContain('class="founder-ledger-chip warning" title="Approvals: 1 warning · 0 probation · 0 replacement · 1 total"><span>Approvals</span><strong>1</strong>')
    expect(html).toContain('title="Telegram drafts: 0 warning · 1 manual review · 1 total"')
    expect(html).toContain('class="founder-ledger-chip warning" title="Telegram drafts: 0 warning · 1 manual review · 1 total"><span>Drafts</span><strong>1</strong>')
    expect(html).toContain('title="Telegram outputs: review update · manual review draft · warning draft"')
    expect(html).toContain('class="founder-ledger-chip warning" title="Telegram outputs: review update · manual review draft · warning draft"><span>Telegram</span><strong>ready</strong>')
    expect(html).toContain('Telegram outputs: review update · manual review draft · warning draft')
    expect(html).toContain('Manual Telegram: Main founder approval required / Delivery disabled')
    expect(html).toContain('Warning Telegram: Blocked by approval workflow, Telegram delivery')
    expect(html).toContain('Record evidence')
    expect(html).toContain('Copy view')
    expect(html).toContain('Copy digest')
    expect(html).toContain('Copy Telegram')
    expect(html).toContain('Copy Best Telegram')
    expect(html).toContain('Copy Manual Telegram')
    expect(html).toContain('Copy Warning Telegram')
    expect(html).toContain('Clear copied')
    expect(html).toContain('Refresh page')
    expect(html).toContain('Restart scan')
    expect(html).toContain('Never')
    expect(html).toContain('Stale')
    expect(html).toContain('Stale week')
    expect(html).toContain('Stale month')
    expect(html).toContain('Weekly due')
    expect(html).toContain('Monthly due')
    expect(html).toContain('Fresh')
    expect(html).toContain('Next evidence')
    expect(html).toContain('Next blocked')
    expect(html).toContain('Next overdue')
    expect(html).toContain('Next record')
    expect(html).toContain('Next monitor')
    expect(html).toContain('Default View')
    expect(html).toContain('Coverage All')
    expect(html).toContain('Cleanup Never')
    expect(html).toContain('Cleanup Stale')
    expect(html).toContain('Cleanup Stale Week')
    expect(html).toContain('Cleanup Stale Month')
    expect(html).toContain('Review Weekly Due')
    expect(html).toContain('Review Monthly Due')
    expect(html).toContain('Audit Fresh')
    expect(html).toContain('Triage Manual')
    expect(html).toContain('Triage Evidence')
    expect(html).toContain('Triage Next Evidence')
    expect(html).toContain('Triage Next Blocked')
    expect(html).toContain('Triage Next Overdue')
    expect(html).toContain('Triage Next Record')
    expect(html).toContain('Triage Next Monitor')
    expect(html).toContain('Triage Overdue')
    expect(html).toContain('Triage Blocked')
    expect(html).toContain('Triage Hospital')
    expect(html).toContain('Triage Inactive')
    expect(html).toContain('Triage Debt')
    expect(html).toContain('Triage Risk')
    expect(html).toContain('Triage Telegram')
    expect(html).toContain('Triage Scan')
    expect(html).toContain('Inactive')
    expect(html).toContain('Debt')
    expect(html).toContain('Risk')
    expect(html).toContain('Telegram')
    expect(html).toContain('class="btn small primary" type="button">All</button>')
    expect(html).toContain('class="btn small primary" type="button">Priority</button>')
    expect(html).toContain('class="btn small primary" type="button">Default View</button>')
    expect(html).toContain('Founder #')
    expect(html).toContain('Action')
    expect(html).toContain('Next page')
    expect(html).toContain('More founders available')
    expect(html).toContain('Copy status: not copied yet')
    expect(html).toContain('View: All / Priority / start')
    expect(html).toContain('Start of queue · more founders available')
    expect(html).not.toContain('operator-token')
  })

  test('renders an operator authority error without queue data', () => {
    const html = renderToStaticMarkup(
      <FounderCovenantOperatorPanel initialError="Founder covenant review queue requires an operator token." />,
    )

    expect(html).toContain('Founder covenant review queue requires an operator token.')
    expect(html).not.toContain('Founder Review Queue')
  })

  test('renders Telegram operator readiness without printing the scoped token', () => {
    const html = renderToStaticMarkup(
      <FounderCovenantOperatorPanel
        initialOperatorAuth={{ status: 'ready', expiresAt: Date.parse('2026-07-06T12:15:00.000Z') }}
      />,
    )

    expect(html).toContain('Telegram operator ready until 12:15 UTC')
    expect(html).toContain('Operator token')
    expect(html).not.toContain('operator-token')
    expect(html).not.toContain('roqt1.')
  })

  test('renders compact copied queue status cues when a copied snapshot is available', () => {
    const html = renderToStaticMarkup(
      <FounderCovenantOperatorPanel
        initialCopiedQueueView={{
          filter: 'action_record',
          sort: 'action',
          scanCursor: 'cursor-5',
          nextCursor: 'cursor-6',
          digestSummary: 'Weekly/monthly founder review',
          lastTelegramFilter: 'Next record',
          lastTelegramOutput: 'Manual review draft',
          telegramSummary: 'Manual review Telegram draft',
          telegramRationale: 'Main founder approval required / Delivery disabled',
          focusSummary: 'Focus: 0 evidence queue · 0 gaps · 0 blocked · 0 approvals · 2 record ready · 0 overdue cleanup · Workflow split: 1 blocked approvals · 2 record ready · 0 overdue cleanup · Cadence ready: 2 weekly · 1 monthly',
          activitySummary: 'Founder state: inactive 1 · usefulness gaps 1 · build gaps 0 · staffing gaps 1 · debt risk 1 · hospitalized 1 · at risk 1',
          actionSummary: 'Action: monitor · monitor current founders',
        }}
        initialQueue={operatorQueue()}
      />,
    )

    expect(html).toContain('Copied view: Action Record')
    expect(html).toContain('Copied cursor: cursor-5 -&gt; cursor-6')
    expect(html).toContain('Copied digest: Weekly/monthly founder review')
    expect(html).toContain('Copied from filter: Next record')
    expect(html).toContain('Last Telegram output: Manual review draft')
    expect(html).toContain('Copied Telegram scaffold: Manual review Telegram draft')
    expect(html).toContain('Copied Telegram rationale: Main founder approval required / Delivery disabled')
    expect(html).toContain('Copied focus: Focus: 0 evidence queue · 0 gaps · 0 blocked · 0 approvals · 2 record ready · 0 overdue cleanup · Workflow split: 1 blocked approvals · 2 record ready · 0 overdue cleanup · Cadence ready: 2 weekly · 1 monthly')
    expect(html).toContain('Copied founder state: Founder state: inactive 1 · usefulness gaps 1 · build gaps 0 · staffing gaps 1 · debt risk 1 · hospitalized 1 · at risk 1')
    expect(html).toContain('Copied action: Action: monitor · monitor current founders')
    expect(html).not.toContain('Last copied:')
  })

  test('surfaces founder-state and cadence chips in the operator queue summary strip', () => {
    const html = renderToStaticMarkup(
      <FounderCovenantOperatorPanel
        initialQueue={{
          ...operatorQueue(),
          totals: {
            ...operatorQueue().totals,
            weeklyDue: 2,
            monthlyDue: 1,
          },
          items: [withRecordReadyCadenceFounder(operatorQueue().items[0], {
            cadence: 'monthly',
          })],
        }}
      />,
    )

    expect(html).toContain('title="Founder state: inactive 0 · usefulness gaps 0 · build gaps 0 · staffing gaps 0 · debt risk 0 · hospitalized 0 · at risk 0"')
    expect(html).toContain('class="founder-ledger-chip stable" title="Founder state: inactive 0 · usefulness gaps 0 · build gaps 0 · staffing gaps 0 · debt risk 0 · hospitalized 0 · at risk 0"><span>Inactive</span><strong>0</strong>')
    expect(html).toContain('class="founder-ledger-chip stable" title="Founder state: inactive 0 · usefulness gaps 0 · build gaps 0 · staffing gaps 0 · debt risk 0 · hospitalized 0 · at risk 0"><span>Debt risk</span><strong>0</strong>')
    expect(html).toContain('class="founder-ledger-chip stable" title="Founder state: inactive 0 · usefulness gaps 0 · build gaps 0 · staffing gaps 0 · debt risk 0 · hospitalized 0 · at risk 0"><span>Hospital</span><strong>0</strong>')
    expect(html).toContain('class="founder-ledger-chip stable" title="Founder state: inactive 0 · usefulness gaps 0 · build gaps 0 · staffing gaps 0 · debt risk 0 · hospitalized 0 · at risk 0"><span>At risk</span><strong>0</strong>')
    expect(html).toContain('title="Cadence ready: 1 weekly · 1 monthly"')
    expect(html).toContain('class="founder-ledger-chip warning" title="Cadence ready: 1 weekly · 1 monthly"><span>Weekly ready</span><strong>1</strong>')
    expect(html).toContain('class="founder-ledger-chip critical" title="Cadence ready: 1 weekly · 1 monthly"><span>Monthly ready</span><strong>1</strong>')
  })

  test('keeps manual operator token fallback visible when Telegram auth is unavailable', () => {
    const html = renderToStaticMarkup(
      <FounderCovenantOperatorPanel
        initialOperatorAuth={{
          status: 'unavailable',
          message: 'Telegram Mini App session not detected. Manual operator token remains available.',
        }}
      />,
    )

    expect(html).toContain('Telegram Mini App session not detected. Manual operator token remains available.')
    expect(html).toContain('Operator token')
    expect(html).toContain('Scan')
  })

  test('derives coverage preset context from filter and sort state', () => {
    expect(formatQueueLoadMessage({
      action: 'scan',
      scanCursor: null,
      nextCursor: 'next-review-cursor',
    })).toBe('Queue scanned: Cursor: start -> next-review-cursor · Start of queue · more founders available')
    expect(formatQueueLoadMessage({
      action: 'refresh',
      scanCursor: 'cursor-5',
      nextCursor: 'cursor-6',
    })).toBe('Queue refreshed: Cursor: cursor-5 -> cursor-6 · Resumed after cursor-5 · more founders available')
    expect(formatQueueLoadMessage({
      action: 'restart',
      scanCursor: null,
      nextCursor: null,
    })).toBe('Queue restarted: Cursor: start -> end · Start of queue · end of current queue')
    expect(formatQueueLoadMessage({
      action: 'next_page',
      scanCursor: 'cursor-6',
      nextCursor: null,
    })).toBe('Next queue page loaded: Cursor: cursor-6 -> end · Resumed after cursor-6 · end of current queue')
    expect(founderCovenantOperatorQueueApprovalSummary({
      totals: {
        ...operatorQueue().totals,
        warningApprovals: 1,
        probationApprovals: 2,
        replacementApprovals: 1,
        pendingApprovals: 4,
      },
    })).toBe('Approvals: 1 warning · 2 probation · 1 replacement · 4 total')
    expect(founderCovenantOperatorQueueBlockerSummary({
      totals: {
        ...operatorQueue().totals,
        blockers: 5,
        overdue: 2,
        hospitalized: 1,
        indebted: 3,
      },
    })).toBe('Blockers: 5 total · 2 overdue · 1 hospitalized · 3 indebted')
    expect(founderCovenantOperatorQueueEvidenceSummary({
      items: operatorQueue().items,
    })).toBe('Evidence: 1 founder queued · 3 gaps · 0 record ready')
    expect(founderCovenantOperatorQueueRecordReadySummary({
      items: operatorQueue().items,
    })).toBe('Record ready: 0 founders · 0 weekly · 0 monthly')
    expect(founderCovenantOperatorQueueOverdueCleanupSummary({
      items: operatorQueue().items,
    })).toBe('Overdue cleanup: 0 founders · 1 overdue · 0 stale')
    expect(formatCopiedContextClearedMessage({
      hadTelegramContext: true,
      hadDigestOrViewContext: true,
    })).toBe('Copied founder handoff cleared: queue snapshot and Telegram context reset.')
    expect(formatCopiedContextClearedMessage({
      hadTelegramContext: true,
      hadDigestOrViewContext: false,
    })).toBe('Copied founder handoff cleared: Telegram context reset.')
    expect(formatCopiedContextClearedMessage({
      hadTelegramContext: false,
      hadDigestOrViewContext: true,
    })).toBe('Copied founder handoff cleared: queue snapshot reset.')
    expect(formatCopiedContextClearedMessage({
      hadTelegramContext: false,
      hadDigestOrViewContext: false,
    })).toBe('Copied founder handoff cleared.')
    expect(formatOperatorSessionClearedMessage({
      hadReviewDraft: true,
      hadCopiedContext: true,
    })).toBe('Operator session cleared: local draft and copied handoff reset.')
    expect(formatOperatorSessionClearedMessage({
      hadReviewDraft: true,
      hadCopiedContext: false,
    })).toBe('Operator session cleared: local draft reset.')
    expect(formatOperatorSessionClearedMessage({
      hadReviewDraft: false,
      hadCopiedContext: true,
    })).toBe('Operator session cleared: copied handoff reset.')
    expect(formatOperatorSessionClearedMessage({
      hadReviewDraft: false,
      hadCopiedContext: false,
    })).toBe('Operator session cleared.')
    expect(formatReviewRecordSuccessMessage(
      '#0012 · Bucharest Founder Block',
      ['population_growth', 'ideas_feedback'],
      'Need a clearer proof of activity.',
    )).toBe(
      'Review evidence recorded for #0012 · Bucharest Founder Block: Population, Ideas · note "Need a clearer proof of activity."',
    )
    expect(formatReviewRecordSuccessMessage(
      '#0012 · Bucharest Founder Block',
      [],
      '',
    )).toBe(
      'Review evidence recorded for #0012 · Bucharest Founder Block: no evidence tags · no note',
    )
    expect(queueCoveragePresetLabel('all', 'coverage')).toBe('Coverage All')
    expect(queueCoveragePresetLabel('never_reviewed', 'coverage')).toBe('Cleanup Never')
    expect(queueCoveragePresetLabel('stale_reviewed', 'coverage')).toBe('Cleanup Stale')
    expect(queueCoveragePresetLabel('stale_weekly_due', 'coverage')).toBe('Cleanup Stale Week')
    expect(queueCoveragePresetLabel('stale_monthly_due', 'coverage')).toBe('Cleanup Stale Month')
    expect(queueCoveragePresetLabel('weekly_due', 'coverage')).toBe('Review Weekly Due')
    expect(queueCoveragePresetLabel('monthly_due', 'coverage')).toBe('Review Monthly Due')
    expect(queueCoveragePresetLabel('fresh_reviewed', 'coverage')).toBe('Audit Fresh')
    expect(queuePriorityPresetLabel('manual_review', 'priority')).toBe('Triage Manual')
    expect(queuePriorityPresetLabel('needs_evidence', 'priority')).toBe('Triage Evidence')
    expect(queuePriorityPresetLabel('action_evidence', 'priority')).toBe('Triage Next Evidence')
    expect(queuePriorityPresetLabel('action_blocked', 'priority')).toBe('Triage Next Blocked')
    expect(queuePriorityPresetLabel('action_overdue', 'priority')).toBe('Triage Next Overdue')
    expect(queuePriorityPresetLabel('action_record', 'priority')).toBe('Triage Next Record')
    expect(queuePriorityPresetLabel('action_monitor', 'priority')).toBe('Triage Next Monitor')
    expect(queueActionPresetLabel('all', 'action')).toBe('Action All')
    expect(queueActionPresetLabel('action_evidence', 'action')).toBe('Action Evidence')
    expect(queueActionPresetLabel('action_blocked', 'action')).toBe('Action Blocked')
    expect(queueActionPresetLabel('action_overdue', 'action')).toBe('Action Overdue')
    expect(queueActionPresetLabel('action_record', 'action')).toBe('Action Record')
    expect(queueActionPresetLabel('action_monitor', 'action')).toBe('Action Monitor')
    expect(queuePriorityPresetLabel('overdue', 'priority')).toBe('Triage Overdue')
    expect(queuePriorityPresetLabel('blocked', 'priority')).toBe('Triage Blocked')
    expect(queuePriorityPresetLabel('hospitalized', 'priority')).toBe('Triage Hospital')
    expect(queuePriorityPresetLabel('inactive', 'priority')).toBe('Triage Inactive')
    expect(queuePriorityPresetLabel('debt_risk', 'priority')).toBe('Triage Debt')
    expect(queuePriorityPresetLabel('at_risk', 'priority')).toBe('Triage Risk')
    expect(queuePriorityPresetLabel('telegram_ready', 'priority')).toBe('Triage Telegram')
    expect(queuePriorityPresetLabel('scan_anomaly', 'priority')).toBe('Triage Scan')
    expect(queuePresetLabel('manual_review', 'priority')).toBe('Triage Manual')
    expect(queuePresetLabel('needs_evidence', 'priority')).toBe('Triage Evidence')
    expect(queuePresetLabel('action_evidence', 'priority')).toBe('Triage Next Evidence')
    expect(queuePresetLabel('action_blocked', 'priority')).toBe('Triage Next Blocked')
    expect(queuePresetLabel('action_overdue', 'priority')).toBe('Triage Next Overdue')
    expect(queuePresetLabel('action_record', 'priority')).toBe('Triage Next Record')
    expect(queuePresetLabel('action_monitor', 'priority')).toBe('Triage Next Monitor')
    expect(queuePresetLabel('all', 'action')).toBe('Action All')
    expect(queuePresetLabel('action_record', 'action')).toBe('Action Record')
    expect(queuePresetLabel('overdue', 'priority')).toBe('Triage Overdue')
    expect(queuePresetLabel('blocked', 'priority')).toBe('Triage Blocked')
    expect(queuePresetLabel('hospitalized', 'priority')).toBe('Triage Hospital')
    expect(queuePresetLabel('inactive', 'priority')).toBe('Triage Inactive')
    expect(queuePresetLabel('debt_risk', 'priority')).toBe('Triage Debt')
    expect(queuePresetLabel('at_risk', 'priority')).toBe('Triage Risk')
    expect(queuePresetLabel('telegram_ready', 'priority')).toBe('Triage Telegram')
    expect(queuePresetLabel('scan_anomaly', 'priority')).toBe('Triage Scan')
    expect(queueCoveragePresetLabel('manual_review', 'coverage')).toBeNull()
    expect(queueViewChipTone('all')).toBe('stable')
    expect(queueViewChipTone('never_reviewed')).toBe('warning')
    expect(queueSortChipTone('priority')).toBe('stable')
    expect(queueSortChipTone('coverage')).toBe('warning')
    expect(queuePresetChipTone('all', 'priority')).toBe('stable')
    expect(queuePresetChipTone('all', 'coverage')).toBe('critical')
    expect(queueContextText('all', 'coverage', null)).toBe(
      'View: All / Coverage / start · Preset: Coverage All · sort coverage',
    )
    expect(queueContextText('stale_reviewed', 'coverage', 'cursor-2')).toBe(
      'View: Stale / Coverage / cursor-2 · Preset: Cleanup Stale · filter stale · sort coverage',
    )
    expect(queueContextText('weekly_due', 'coverage', 'cursor-3')).toBe(
      'View: Weekly due / Coverage / cursor-3 · Preset: Review Weekly Due · filter weekly due · sort coverage',
    )
    expect(queueContextText('monthly_due', 'coverage', null)).toBe(
      'View: Monthly due / Coverage / start · Preset: Review Monthly Due · filter monthly due · sort coverage',
    )
    expect(queueContextText('manual_review', 'priority', null)).toBe(
      'View: Manual / Priority / start · Preset: Triage Manual · filter manual',
    )
    expect(queueContextText('overdue', 'priority', 'cursor-9')).toBe(
      'View: Overdue / Priority / cursor-9 · Preset: Triage Overdue · filter overdue',
    )
    expect(queueContextText('inactive', 'priority', 'cursor-8')).toBe(
      'View: Inactive / Priority / cursor-8 · Preset: Triage Inactive · filter inactive',
    )
    expect(queueContextText('needs_evidence', 'priority', 'cursor-7')).toBe(
      'View: Evidence / Priority / cursor-7 · Preset: Triage Evidence · filter evidence',
    )
    expect(queueContextText('all', 'action', null)).toBe(
      'View: All / Action / start · Preset: Action All · sort action',
    )
    expect(queueContextText('action_record', 'action', 'cursor-5')).toBe(
      'View: Next record / Action / cursor-5 · Preset: Action Record · filter next record · sort action',
    )
    expect(queueCopiedStatusSummary({
      filter: 'action_record',
      sort: 'action',
      scanCursor: 'cursor-5',
      nextCursor: 'cursor-6',
      digestSummary: 'Weekly/monthly founder review',
      lastTelegramFilter: 'Next record',
      lastTelegramOutput: 'Manual review draft',
      telegramSummary: 'Manual review Telegram draft',
      telegramRationale: 'Main founder approval required / Delivery disabled',
      focusSummary: 'Focus: 0 evidence queue · 0 gaps · 0 blocked · 0 approvals · 2 record ready · 0 overdue cleanup · Workflow split: 1 blocked approvals · 2 record ready · 0 overdue cleanup · Cadence ready: 2 weekly · 1 monthly',
      activitySummary: 'Founder state: inactive 1 · usefulness gaps 1 · build gaps 0 · staffing gaps 1 · debt risk 1 · hospitalized 1 · at risk 1',
      actionSummary: 'Action: monitor · monitor current founders',
    })).toEqual([
      'Copied view: Action Record',
      'Copied cursor: cursor-5 -> cursor-6',
      'Copied digest: Weekly/monthly founder review',
      'Copied from filter: Next record',
      'Last Telegram output: Manual review draft',
      'Copied Telegram scaffold: Manual review Telegram draft',
      'Copied Telegram rationale: Main founder approval required / Delivery disabled',
      'Copied focus: Focus: 0 evidence queue · 0 gaps · 0 blocked · 0 approvals · 2 record ready · 0 overdue cleanup · Workflow split: 1 blocked approvals · 2 record ready · 0 overdue cleanup · Cadence ready: 2 weekly · 1 monthly',
      'Copied founder state: Founder state: inactive 1 · usefulness gaps 1 · build gaps 0 · staffing gaps 1 · debt risk 1 · hospitalized 1 · at risk 1',
      'Copied action: Action: monitor · monitor current founders',
    ])
    expect(queueHandoffText({
      filter: 'action_record',
      sort: 'action',
      scanCursor: 'cursor-5',
      nextCursor: 'cursor-6',
      queueSummary: '1 founder · 0 manual review · 1 fresh reviewed',
      focusSummary: 'Focus: 0 evidence queue · 0 gaps · 0 blocked · 0 approvals · 2 record ready · 0 overdue cleanup · Workflow split: 1 blocked approvals · 2 record ready · 0 overdue cleanup · Cadence ready: 2 weekly · 1 monthly',
      activitySummary: 'Founder state: inactive 1 · usefulness gaps 1 · build gaps 0 · staffing gaps 1 · debt risk 1 · hospitalized 1 · at risk 1',
      actionSummary: 'Action: monitor · monitor current founders',
    })).toBe(
      'View: Next record / Action / cursor-5 · Preset: Action Record · filter next record · sort action · Cursor: cursor-5 -> cursor-6 · Resumed after cursor-5 · more founders available · 1 founder · 0 manual review · 1 fresh reviewed · Focus: 0 evidence queue · 0 gaps · 0 blocked · 0 approvals · 2 record ready · 0 overdue cleanup · Workflow split: 1 blocked approvals · 2 record ready · 0 overdue cleanup · Cadence ready: 2 weekly · 1 monthly · Founder state: inactive 1 · usefulness gaps 1 · build gaps 0 · staffing gaps 1 · debt risk 1 · hospitalized 1 · at risk 1 · Action: monitor · monitor current founders',
    )
    expect(queueDigestText({
      scanCursor: 'cursor-5',
      nextCursor: 'cursor-6',
      queueSummary: '1 founder · 0 manual review · 1 fresh reviewed',
      focusSummary: 'Focus: 0 evidence queue · 0 gaps · 0 blocked · 0 approvals · 2 record ready · 0 overdue cleanup · Workflow split: 1 blocked approvals · 2 record ready · 0 overdue cleanup · Cadence ready: 2 weekly · 1 monthly',
      activitySummary: 'Founder state: inactive 1 · usefulness gaps 1 · build gaps 0 · staffing gaps 1 · debt risk 1 · hospitalized 1 · at risk 1',
      actionSummary: 'Action: monitor · monitor current founders',
    })).toBe(
      'Weekly/monthly founder review digest · Cursor: cursor-5 -> cursor-6 · Resumed after cursor-5 · more founders available · 1 founder · 0 manual review · 1 fresh reviewed · Focus: 0 evidence queue · 0 gaps · 0 blocked · 0 approvals · 2 record ready · 0 overdue cleanup · Workflow split: 1 blocked approvals · 2 record ready · 0 overdue cleanup · Cadence ready: 2 weekly · 1 monthly · Founder state: inactive 1 · usefulness gaps 1 · build gaps 0 · staffing gaps 1 · debt risk 1 · hospitalized 1 · at risk 1 · Action: monitor · monitor current founders',
    )
    expect(queueTelegramScaffoldText({
      scanCursor: 'cursor-5',
      nextCursor: 'cursor-6',
      queueSummary: '1 founder · 0 manual review · 1 fresh reviewed',
      focusSummary: 'Focus: 0 evidence queue · 0 gaps · 0 blocked · 0 approvals · 2 record ready · 0 overdue cleanup · Workflow split: 1 blocked approvals · 2 record ready · 0 overdue cleanup · Cadence ready: 2 weekly · 1 monthly',
      activitySummary: 'Founder state: inactive 1 · usefulness gaps 1 · build gaps 0 · staffing gaps 1 · debt risk 1 · hospitalized 1 · at risk 1',
      actionSummary: 'Action: monitor · monitor current founders',
      telegramSummary: 'Telegram drafts: 0 warning · 1 manual review · 1 total',
    })).toBe(
      'Reality founder review update\nQueue: 1 founder · 0 manual review · 1 fresh reviewed\nFocus: 0 evidence queue · 0 gaps · 0 blocked · 0 approvals · 2 record ready · 0 overdue cleanup · Workflow split: 1 blocked approvals · 2 record ready · 0 overdue cleanup · Cadence ready: 2 weekly · 1 monthly\nFounder state: inactive 1 · usefulness gaps 1 · build gaps 0 · staffing gaps 1 · debt risk 1 · hospitalized 1 · at risk 1\nAction: monitor · monitor current founders\nTelegram drafts: 0 warning · 1 manual review · 1 total\nCursor: cursor-5 -> cursor-6\nResumed after cursor-5 · more founders available',
    )
    expect(queueManualReviewTelegramText({
      draft: {
        title: 'Founder covenant manual review required',
        body: 'Founder covenant signals require human review. Replacement and waitlist handoff remain disabled.',
        channel: 'telegram',
      },
      queueSummary: '1 founder · 0 manual review · 1 fresh reviewed',
      focusSummary: 'Focus: 0 evidence queue · 0 gaps · 0 blocked · 0 approvals · 2 record ready · 0 overdue cleanup · Workflow split: 1 blocked approvals · 2 record ready · 0 overdue cleanup · Cadence ready: 2 weekly · 1 monthly',
      activitySummary: 'Founder state: inactive 1 · usefulness gaps 1 · build gaps 0 · staffing gaps 1 · debt risk 1 · hospitalized 1 · at risk 1',
      actionSummary: 'Action: monitor · monitor current founders',
    })).toBe(
      'Founder covenant manual review required (telegram)\nFounder covenant signals require human review. Replacement and waitlist handoff remain disabled.\nQueue: 1 founder · 0 manual review · 1 fresh reviewed\nFocus: 0 evidence queue · 0 gaps · 0 blocked · 0 approvals · 2 record ready · 0 overdue cleanup · Workflow split: 1 blocked approvals · 2 record ready · 0 overdue cleanup · Cadence ready: 2 weekly · 1 monthly\nFounder state: inactive 1 · usefulness gaps 1 · build gaps 0 · staffing gaps 1 · debt risk 1 · hospitalized 1 · at risk 1\nAction: monitor · monitor current founders',
    )
    expect(queueFounderWarningTelegramText({
      request: {
        label: 'Send warning',
        reason: 'Founder covenant signals suggest a warning.',
        blockers: ['approval_workflow_disabled', 'telegram_delivery_disabled'],
      },
      queueSummary: '1 founder · 0 manual review · 1 fresh reviewed',
      focusSummary: 'Focus: 0 evidence queue · 0 gaps · 0 blocked · 0 approvals · 2 record ready · 0 overdue cleanup · Workflow split: 1 blocked approvals · 2 record ready · 0 overdue cleanup · Cadence ready: 2 weekly · 1 monthly',
      activitySummary: 'Founder state: inactive 1 · usefulness gaps 1 · build gaps 0 · staffing gaps 1 · debt risk 1 · hospitalized 1 · at risk 1',
      actionSummary: 'Action: monitor · monitor current founders',
    })).toBe(
      'Send warning (telegram)\nFounder covenant signals suggest a warning.\n2 delivery blockers remain before send\nQueue: 1 founder · 0 manual review · 1 fresh reviewed\nFocus: 0 evidence queue · 0 gaps · 0 blocked · 0 approvals · 2 record ready · 0 overdue cleanup · Workflow split: 1 blocked approvals · 2 record ready · 0 overdue cleanup · Cadence ready: 2 weekly · 1 monthly\nFounder state: inactive 1 · usefulness gaps 1 · build gaps 0 · staffing gaps 1 · debt risk 1 · hospitalized 1 · at risk 1\nAction: monitor · monitor current founders',
    )
    expect(queueTelegramOutputsSummary({
      hasQueue: true,
      hasManualReviewDraft: true,
      hasFounderWarningDraft: true,
    })).toBe('Telegram outputs: review update · manual review draft · warning draft')
    expect(queueTelegramOutputsSummary({
      hasQueue: false,
      hasManualReviewDraft: false,
      hasFounderWarningDraft: false,
    })).toBe('Telegram outputs: none')
  })
})

function createStorage(): Storage {
  const store = new Map<string, string>()
  return {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key: string) {
      return store.get(key) ?? null
    },
    key(index: number) {
      return [...store.keys()][index] ?? null
    },
    removeItem(key: string) {
      store.delete(key)
    },
    setItem(key: string, value: string) {
      store.set(key, value)
    },
  }
}

function operatorQueue(): RealityFounderCovenantReviewQueueDashboard {
  return {
    generatedAt: '2026-07-06T04:00:00.000Z',
    evidenceOnly: true,
    automationEnabled: false,
    executionEnabled: false,
    replacementEnabled: false,
    waitlistHandoffEnabled: false,
    approvalWorkflowEnabled: false,
    limit: 1,
    pages: 1,
    pagesScanned: 1,
    cursor: null,
    nextCursor: 'next-review-cursor',
    scanned: 1,
    caughtUp: 1,
    current: 0,
    failed: 0,
    hasMore: true,
    totals: {
      founders: 1,
      active: 0,
      useful: 0,
      building: 1,
      staffed: 0,
      indebted: 1,
      hospitalized: 1,
      atRisk: 1,
      manualReviewRequired: 1,
      neverReviewed: 1,
      freshReviewed: 0,
      staleReviewed: 0,
      staleWeeklyDue: 0,
      staleMonthlyDue: 0,
      scanAnomalies: 0,
      weeklyDue: 0,
      monthlyDue: 0,
      warningApprovals: 1,
      probationApprovals: 0,
      replacementApprovals: 0,
      warningDrafts: 0,
      manualReviewDrafts: 1,
      overdue: 1,
      totalFounderCash: 199_500,
      totalOutstandingDebt: 350,
      totalBusinessCash: 25,
      unstaffedBusinesses: 1,
      insuredFounders: 0,
      pendingApprovals: 1,
      pendingNotifications: 1,
      blockers: 3,
    },
    items: [{
      areaId: 'founder-area-0012',
      areaLabel: 'Bucharest Founder Block',
      founderCitizenId: 'founder-12',
      founderNumber: 12,
      updatedAt: '2026-07-06T04:00:00.000Z',
      checkedAt: '2026-07-06T04:00:00.000Z',
      lastReviewAt: null,
      reviewFreshness: 'never',
      latestReview: null,
      nextWeeklyReviewAt: '2026-07-12T04:00:00.000Z',
      nextMonthlyReviewAt: '2026-08-05T04:00:00.000Z',
      weeklyReviewDue: false,
      monthlyReviewDue: false,
      overdue: true,
      covenantStatus: 'manual_review',
      nextAction: 'manual_review',
      manualReviewRequired: true,
      replacementEnabled: false,
      waitlistHandoffEnabled: false,
      activityReview: {
        checkedAt: '2026-07-06T04:00:00.000Z',
        active: false,
        useful: false,
        building: true,
        staffed: false,
        indebted: true,
        hospitalized: true,
        atRisk: true,
        score: 35,
      },
      activitySignals: [{
        key: 'active',
        label: 'Active',
        value: false,
        status: 'manual_review',
        summary: 'No recent founder activity is visible.',
        manualOnly: true,
        automationEnabled: false,
        executionEnabled: false,
      }, {
        key: 'useful',
        label: 'Useful',
        value: false,
        status: 'watch',
        summary: 'Usefulness needs reviewer evidence.',
        manualOnly: true,
        automationEnabled: false,
        executionEnabled: false,
      }, {
        key: 'building',
        label: 'Building',
        value: true,
        status: 'met',
        summary: 'Founder has built or owns local business activity.',
        manualOnly: true,
        automationEnabled: false,
        executionEnabled: false,
      }, {
        key: 'staffed',
        label: 'Staffed',
        value: false,
        status: 'watch',
        summary: 'Founder businesses need staffing attention.',
        manualOnly: true,
        automationEnabled: false,
        executionEnabled: false,
      }, {
        key: 'indebted',
        label: 'Indebted',
        value: true,
        status: 'watch',
        summary: 'Founder has outstanding debt.',
        manualOnly: true,
        automationEnabled: false,
        executionEnabled: false,
      }, {
        key: 'hospitalized',
        label: 'Hospitalized',
        value: true,
        status: 'manual_review',
        summary: 'Founder is unavailable in hospital.',
        manualOnly: true,
        automationEnabled: false,
        executionEnabled: false,
      }, {
        key: 'at_risk',
        label: 'At risk',
        value: true,
        status: 'manual_review',
        summary: 'Founder covenant status requires manual attention.',
        manualOnly: true,
        automationEnabled: false,
        executionEnabled: false,
      }],
      reviewInputs: [{
        kind: 'population_growth',
        label: 'Population growth',
        status: 'manual_needed',
        evidence: 'Invite quality and local population growth need manual proof until invite tracking exists.',
        manualEvidenceRequired: true,
      }, {
        kind: 'external_contribution',
        label: 'External contribution',
        status: 'manual_needed',
        evidence: 'GitHub, code, design, docs, and testing contributions must be attached by reviewers manually.',
        manualEvidenceRequired: true,
      }, {
        kind: 'ideas_feedback',
        label: 'Ideas and feedback',
        status: 'manual_needed',
        evidence: 'Useful ideas, bug reports, and economy feedback must be attached by reviewers manually.',
        manualEvidenceRequired: true,
      }],
      stages: [{
        kind: 'active',
        label: 'Active',
        status: 'locked',
        reason: 'Founder has covenant signals requiring reviewer attention.',
        requiresMainFounderApproval: false,
        manualOnly: true,
        automationEnabled: false,
        executionEnabled: false,
      }, {
        kind: 'warning',
        label: 'Warning',
        status: 'recommended',
        reason: 'Covenant signals suggest a manual founder warning.',
        requiresMainFounderApproval: true,
        manualOnly: true,
        automationEnabled: false,
        executionEnabled: false,
      }, {
        kind: 'probation',
        label: 'Probation',
        status: 'locked',
        reason: 'Founder score and signals do not suggest probation.',
        requiresMainFounderApproval: true,
        manualOnly: true,
        automationEnabled: false,
        executionEnabled: false,
      }, {
        kind: 'removed',
        label: 'Removed',
        status: 'locked',
        reason: 'Removal is not suggested by current covenant signals.',
        requiresMainFounderApproval: true,
        manualOnly: true,
        automationEnabled: false,
        executionEnabled: false,
      }, {
        kind: 'waitlist_replacement',
        label: 'Waitlist replacement',
        status: 'locked',
        reason: 'Waitlist handoff is disabled until the manual replacement workflow is approved.',
        requiresMainFounderApproval: true,
        manualOnly: true,
        automationEnabled: false,
        executionEnabled: false,
      }],
      reviewReadiness: {
        status: 'blocked',
        label: 'Blocked',
        summary: '3 approval blockers before enforcement.',
        evidenceRequiredCount: 3,
        approvalRequestCount: 1,
        blockerCount: 3,
        overdue: true,
        manualOnly: true,
        automationEnabled: false,
        executionEnabled: false,
      },
      reviewChecklist: [{
        key: 'active',
        label: 'Active',
        status: 'manual_review',
        evidence: 'Founder is unavailable and needs manual review.',
      }],
      manualActions: [{
        kind: 'record_review',
        label: 'Record review',
        recommended: true,
        requiresApproval: true,
        automationEnabled: false,
        authorityGate: {
          requiredRole: 'area_reviewer',
          status: 'evidence_only',
          approvedById: null,
          approvedAt: null,
          executionEnabled: false,
        },
        reason: 'Reviewer notes are manual evidence only; no automatic enforcement runs.',
        clientPayload: null,
      }, {
        kind: 'send_warning',
        label: 'Send warning',
        recommended: true,
        requiresApproval: true,
        automationEnabled: false,
        authorityGate: {
          requiredRole: 'main_founder',
          status: 'approval_required',
          approvedById: null,
          approvedAt: null,
          executionEnabled: false,
        },
        reason: 'Covenant signals suggest a manual founder warning.',
        clientPayload: null,
      }],
      economicExposure: {
        founderCash: 199_500,
        outstandingDebt: 350,
        debtCount: 1,
        businessCash: 25,
        businessCount: 2,
        unstaffedBusinessCount: 1,
        insured: false,
        hospitalized: true,
        gameCreditsOnly: true,
        payoutEligibleCredits: 0,
        manualPayoutReviewRequired: true,
      },
      reviewQueue: {
        evidenceOnly: true,
        automationEnabled: false,
        executionEnabled: false,
        nextStep: 'main_founder_approval',
        recordReviewEnabled: true,
        recommendedActionKinds: ['send_warning'],
        pendingApprovalKinds: ['send_warning'],
        pendingApprovalCount: 1,
        pendingNotificationKinds: ['manual_review_required'],
        pendingNotificationCount: 1,
        blockerCount: 3,
        blockers: ['approval_workflow_disabled', 'telegram_delivery_disabled', 'replacement_disabled'],
      },
      signalCounts: { total: 2, info: 0, warning: 1, critical: 1 },
      signalKinds: ['founder_debt', 'review_due'],
      recommendedActionKinds: ['send_warning'],
      pendingApprovalRequests: [{
        id: 'founder-area-0012:1783310400000:covenant-approval:send_warning:founder-12',
        at: '2026-07-06T04:00:00.000Z',
        kind: 'send_warning',
        label: 'Send warning',
        reason: 'Founder covenant signals suggest a warning.',
        status: 'pending_manual_approval',
        recommended: true,
        requiresApproval: true,
        approvalEnabled: false,
        automationEnabled: false,
        executionEnabled: false,
        authorityGate: {
          requiredRole: 'main_founder',
          status: 'approval_required',
          approvedById: null,
          approvedAt: null,
          executionEnabled: false,
        },
        notificationDraftId: 'founder-area-0012:1783310400000:covenant-notification:founder_warning:founder-12',
        blockers: ['approval_workflow_disabled', 'telegram_delivery_disabled'],
      }],
      pendingApprovalKinds: ['send_warning'],
      pendingNotificationDrafts: [{
        id: 'founder-area-0012:1783310400000:covenant-notification:manual_review_required:founder-12',
        at: '2026-07-06T04:00:00.000Z',
        kind: 'manual_review_required',
        channel: 'telegram',
        recipientCitizenId: 'founder-12',
        title: 'Founder covenant manual review required',
        body: 'Founder covenant signals require human review. Replacement and waitlist handoff remain disabled.',
        requiresApproval: true,
        sendEnabled: false,
        authorityGate: {
          requiredRole: 'main_founder',
          status: 'approval_required',
          approvedById: null,
          approvedAt: null,
          executionEnabled: false,
        },
      }],
      pendingNotificationKinds: ['manual_review_required'],
      blockerCount: 3,
      scanStatus: 'caught_up',
      transactionsAdded: 1,
    }],
    results: [{
      citizenId: 'founder-12',
      areaId: 'founder-area-0012',
      status: 'caught_up',
      updatedAt: '2026-07-06T04:00:00.000Z',
      transactionsAdded: 1,
    }],
  }
}
