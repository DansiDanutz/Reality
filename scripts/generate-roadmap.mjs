#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const outFile = path.join(root, 'public', 'roadmap.html')
const planFile = path.join(root, 'docs', 'roadmap-weekly-plan.json')

const read = (file) => readFileSync(path.join(root, file), 'utf8')

const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

const stripMarkdown = (value) =>
  String(value ?? '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[\u2705\u{1f51c}]/gu, '')
    .trim()

const execText = (cmd, args, options = {}) => {
  try {
    return execFileSync(cmd, args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      ...options,
    }).trim()
  } catch {
    return ''
  }
}

const parsePlan = () => {
  try {
    return JSON.parse(readFileSync(planFile, 'utf8'))
  } catch {
    return { stillTestingFallback: [], thisWeekPlan: [] }
  }
}

const parseAchievements = () => {
  const source = read('src/game/achievements.ts')
  const pattern =
    /id:\s*'((?:\\.|[^'])*)'[\s\S]*?title:\s*'((?:\\.|[^'])*)'[\s\S]*?detail:\s*'((?:\\.|[^'])*)'[\s\S]*?category:\s*'((?:\\.|[^'])*)'[\s\S]*?tier:\s*'((?:\\.|[^'])*)'[\s\S]*?xp:\s*([\d_]+)[\s\S]*?bounty:\s*([\d_]+)/g
  const achievements = []
  for (const match of source.matchAll(pattern)) {
    achievements.push({
      id: match[1].replaceAll("\\'", "'"),
      title: match[2].replaceAll("\\'", "'"),
      detail: match[3].replaceAll("\\'", "'"),
      category: match[4],
      tier: match[5],
      xp: Number(match[6].replaceAll('_', '')),
      bounty: Number(match[7].replaceAll('_', '')),
    })
  }
  return achievements
}

const countCatalog = () => {
  const catalog = read('src/game/catalog.ts')
  return {
    shopItems: (catalog.match(/^  \{ id: /gm) ?? []).length,
    jobs: (catalog.match(/^  \{ id: '[^']+', title:/gm) ?? []).length,
    recipes: (catalog.match(/^  \{ id: '[^']+', name: .* ingredients:/gm) ?? []).length,
    lifeEvents: (catalog.match(/^  \{ text:/gm) ?? []).length,
  }
}

const walkFiles = (dir) => {
  const base = path.join(root, dir)
  if (!existsSync(base)) return []
  const files = []
  for (const entry of readdirSync(base)) {
    const full = path.join(base, entry)
    const rel = path.relative(root, full)
    const stat = statSync(full)
    if (stat.isDirectory()) files.push(...walkFiles(rel))
    else files.push(rel)
  }
  return files
}

const titleize = (value) =>
  value
    .replace(/\.test\.tsx?$/, '')
    .replace(/^src\/game\//, '')
    .replace(/^src\/lib\//, '')
    .replace(/^api\//, '')
    .replace(/^src\/components\/panels\//, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())

const collectTestedAreas = () => {
  const files = [...walkFiles('src'), ...walkFiles('api')]
    .filter((file) => /\.test\.tsx?$/.test(file))
    .sort()
  return files.map((file) => ({ title: titleize(file), file }))
}

const mainRef = () => {
  if (execText('git', ['rev-parse', '--verify', '--quiet', 'origin/main'])) return 'origin/main'
  if (execText('git', ['rev-parse', '--verify', '--quiet', 'main'])) return 'main'
  return 'HEAD'
}

const recentCommits = (ref) => {
  const output = execText('git', ['log', ref, '--date=short', '--pretty=format:%h%x09%cs%x09%s', '-18'])
  if (!output) return []
  return output.split('\n').map((line) => {
    const [sha, date, ...rest] = line.split('\t')
    return { sha, date, subject: rest.join('\t') }
  })
}

const roadmapPhases = () => {
  const roadmap = read('docs/ROADMAP.md')
  const phases = []
  const lines = roadmap.split('\n')
  let current = null
  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (current) phases.push(current)
      current = { title: stripMarkdown(line.replace(/^## /, '')), items: [] }
      continue
    }
    if (!current) continue
    if (line.startsWith('- ')) current.items.push(stripMarkdown(line.replace(/^- /, '')))
  }
  if (current) phases.push(current)
  return phases.slice(0, 5)
}

const fetchOpenPrs = () => {
  if (process.env.ROADMAP_FETCH_GITHUB !== '1') return []
  const repo = process.env.GITHUB_REPOSITORY || 'DansiDanutz/Reality'
  const raw = execText('gh', [
    'pr',
    'list',
    '--repo',
    repo,
    '--state',
    'open',
    '--limit',
    '30',
    '--json',
    'number,title,headRefName,updatedAt,isDraft,mergeStateStatus,reviewDecision,url',
  ])
  if (!raw) return []
  try {
    return JSON.parse(raw)
  } catch {
    return []
  }
}

const statusTone = (value) => {
  if (value === 'success' || value === 'passed') return 'good'
  if (value === 'failure' || value === 'failed') return 'bad'
  return 'warn'
}

const money = (value) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)

const renderList = (items, renderer) =>
  items.length
    ? items.map(renderer).join('\n')
    : '<li class="empty">No entries found for this snapshot.</li>'

const renderPlanItems = (items) =>
  renderList(
    items,
    (item) => `
      <li class="road-row">
        <strong>${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(item.detail)}</span>
        ${item.source ? `<em>${escapeHtml(item.source)}</em>` : ''}
      </li>`,
  )

const main = () => {
  const generatedAt = new Date()
  const plan = parsePlan()
  const achievements = parseAchievements()
  const catalog = countCatalog()
  const tests = collectTestedAreas()
  const baseRef = mainRef()
  const commits = recentCommits(baseRef)
  const phases = roadmapPhases()
  const openPrs = fetchOpenPrs()
  const branch = execText('git', ['branch', '--show-current']) || 'unknown'
  const commit = execText('git', ['rev-parse', '--short', 'HEAD']) || 'unknown'
  const testStatus = process.env.ROADMAP_TEST_STATUS || 'not-run-locally'
  const buildStatus = process.env.ROADMAP_BUILD_STATUS || 'not-run-locally'
  const verifyStatus = testStatus === 'success' && buildStatus === 'success'
    ? 'passed'
    : testStatus === 'failure' || buildStatus === 'failure'
      ? 'failed'
      : 'pending'
  const stillTesting = openPrs.length
    ? openPrs.map((pr) => ({
      title: `#${pr.number} ${pr.title}`,
      detail: `${pr.isDraft ? 'Draft' : 'Open'} PR on ${pr.headRefName}; merge state: ${pr.mergeStateStatus ?? 'unknown'}.`,
      source: pr.url,
    }))
    : plan.stillTestingFallback

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Reality Roadmap</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #060914;
      --panel: rgba(13, 18, 32, 0.9);
      --panel-2: rgba(18, 27, 45, 0.88);
      --line: rgba(171, 188, 214, 0.18);
      --text: #f4f7fb;
      --muted: #9ba9bd;
      --gold: #f2b84b;
      --green: #54d18f;
      --blue: #62b7ff;
      --red: #ff7d7d;
      --shadow: 0 22px 70px rgba(0, 0, 0, 0.35);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      color: var(--text);
      background:
        radial-gradient(circle at 18% 6%, rgba(98, 183, 255, 0.15), transparent 27rem),
        radial-gradient(circle at 84% 16%, rgba(242, 184, 75, 0.12), transparent 25rem),
        linear-gradient(180deg, #080d19 0%, var(--bg) 42%, #03050c 100%);
    }

    body::before {
      content: "";
      position: fixed;
      inset: 0;
      pointer-events: none;
      background-image:
        radial-gradient(circle, rgba(255, 255, 255, 0.2) 0 1px, transparent 1.5px),
        radial-gradient(circle, rgba(98, 183, 255, 0.16) 0 1px, transparent 1.4px);
      background-size: 82px 82px, 137px 137px;
      opacity: 0.22;
      mask-image: linear-gradient(180deg, black, transparent 78%);
    }

    a { color: inherit; }
    .page { width: min(1180px, calc(100% - 32px)); margin: 0 auto; padding: 34px 0 56px; }
    header { display: grid; gap: 20px; margin-bottom: 24px; }
    .topline { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
    .title h1 { margin: 0; font-size: clamp(2.25rem, 5vw, 5.2rem); line-height: 0.92; letter-spacing: 0; }
    .title p { margin: 14px 0 0; max-width: 740px; color: var(--muted); font-size: 1.02rem; line-height: 1.6; }
    .stamp {
      min-width: 230px;
      padding: 14px 16px;
      border: 1px solid var(--line);
      background: rgba(255, 255, 255, 0.045);
      border-radius: 8px;
      color: var(--muted);
      font-size: 0.86rem;
      line-height: 1.5;
      text-align: right;
    }
    .stamp strong { display: block; color: var(--text); font-size: 0.94rem; }

    .stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .stat {
      border: 1px solid var(--line);
      background: var(--panel);
      border-radius: 8px;
      padding: 16px;
      box-shadow: var(--shadow);
    }
    .stat span { display: block; color: var(--muted); font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.08em; }
    .stat strong { display: block; margin-top: 8px; font-size: 1.78rem; line-height: 1; }
    .stat small { display: block; margin-top: 9px; color: var(--muted); line-height: 1.35; }

    .grid { display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 18px; align-items: start; }
    .section {
      border: 1px solid var(--line);
      background: var(--panel);
      border-radius: 8px;
      box-shadow: var(--shadow);
      overflow: hidden;
    }
    .section + .section { margin-top: 18px; }
    .section-head {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: center;
      padding: 18px 20px;
      border-bottom: 1px solid var(--line);
      background: rgba(255, 255, 255, 0.035);
    }
    h2 { margin: 0; font-size: 1rem; letter-spacing: 0.02em; }
    .section-head p { margin: 4px 0 0; color: var(--muted); font-size: 0.88rem; }
    .chip {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 28px;
      padding: 0 10px;
      border-radius: 999px;
      border: 1px solid var(--line);
      color: var(--muted);
      font-size: 0.78rem;
      white-space: nowrap;
    }
    .chip.good { color: #c7f7dd; border-color: rgba(84, 209, 143, 0.35); background: rgba(84, 209, 143, 0.1); }
    .chip.warn { color: #ffe1a7; border-color: rgba(242, 184, 75, 0.35); background: rgba(242, 184, 75, 0.1); }
    .chip.bad { color: #ffd0d0; border-color: rgba(255, 125, 125, 0.35); background: rgba(255, 125, 125, 0.1); }

    .road-list, .commit-list, .test-list { list-style: none; margin: 0; padding: 0; }
    .road-row, .commit-row, .test-row {
      display: grid;
      gap: 5px;
      padding: 14px 20px;
      border-bottom: 1px solid var(--line);
    }
    .road-row:last-child, .commit-row:last-child, .test-row:last-child { border-bottom: 0; }
    .road-row strong, .commit-row strong, .test-row strong { font-size: 0.94rem; }
    .road-row span, .commit-row span, .test-row span { color: var(--muted); font-size: 0.86rem; line-height: 1.45; }
    .road-row em, .commit-row em, .test-row em { color: var(--blue); font-size: 0.78rem; font-style: normal; overflow-wrap: anywhere; }

    .achievement-table { width: 100%; border-collapse: collapse; }
    .achievement-table th,
    .achievement-table td {
      padding: 11px 12px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      vertical-align: top;
      font-size: 0.86rem;
    }
    .achievement-table th {
      color: var(--muted);
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      background: rgba(255, 255, 255, 0.025);
    }
    .achievement-table td:first-child { width: 28%; font-weight: 700; }
    .achievement-table td:nth-child(2) { color: var(--muted); line-height: 1.45; }
    .tier { color: var(--gold); font-weight: 700; text-transform: capitalize; }
    .category { color: var(--blue); text-transform: capitalize; }
    .mono { font-variant-numeric: tabular-nums; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }

    .phase-wrap { display: grid; gap: 12px; padding: 18px 20px; }
    .phase {
      display: grid;
      gap: 10px;
      padding: 14px;
      background: var(--panel-2);
      border: 1px solid var(--line);
      border-radius: 8px;
    }
    .phase strong { color: var(--text); }
    .phase ul { margin: 0; padding-left: 18px; color: var(--muted); font-size: 0.86rem; line-height: 1.45; }

    .source-bar {
      margin-top: 18px;
      padding: 14px 16px;
      border: 1px solid var(--line);
      border-radius: 8px;
      color: var(--muted);
      background: rgba(255, 255, 255, 0.035);
      font-size: 0.84rem;
      line-height: 1.5;
    }

    @media (max-width: 920px) {
      .topline { display: grid; }
      .stamp { text-align: left; }
      .stats, .grid { grid-template-columns: 1fr; }
      .achievement-table { display: block; overflow-x: auto; }
    }

    @media (max-width: 640px) {
      .page { width: min(100% - 20px, 1180px); padding-top: 18px; }
      .title h1 { font-size: 2.2rem; }
      .section-head { align-items: flex-start; flex-direction: column; }
      .achievement-table,
      .achievement-table tbody,
      .achievement-table tr,
      .achievement-table td { display: block; width: 100%; }
      .achievement-table thead { display: none; }
      .achievement-table tr { padding: 12px 14px; border-bottom: 1px solid var(--line); }
      .achievement-table td { padding: 4px 0; border-bottom: 0; }
      .achievement-table td:first-child { width: 100%; font-size: 0.95rem; }
      .achievement-table td:nth-child(2) { font-size: 0.88rem; }
      .achievement-table td:nth-child(n+3) { display: inline-block; width: auto; margin-right: 12px; }
    }
  </style>
</head>
<body>
  <main class="page">
    <header>
      <div class="topline">
        <div class="title">
          <h1>Reality Roadmap</h1>
          <p>Daily generated status for what is already on main, what is implemented and tested, what is still under review, and what the team is focusing on this week.</p>
        </div>
        <div class="stamp">
          <strong>${escapeHtml(generatedAt.toUTCString())}</strong>
          Branch <span class="mono">${escapeHtml(branch)}</span> at <span class="mono">${escapeHtml(commit)}</span><br />
          Source: local repo plus GitHub PRs when the cron runs in CI.
        </div>
      </div>
      <section class="stats" aria-label="Roadmap summary">
        <div class="stat"><span>Achievements</span><strong>${achievements.length}</strong><small>Implemented in <span class="mono">src/game/achievements.ts</span></small></div>
        <div class="stat"><span>Market Items</span><strong>${catalog.shopItems}</strong><small>${catalog.jobs} jobs, ${catalog.recipes} recipes, ${catalog.lifeEvents} life events</small></div>
        <div class="stat"><span>Test Files</span><strong>${tests.length}</strong><small>Unit and API coverage discovered in source</small></div>
        <div class="stat"><span>Verify</span><strong>${escapeHtml(verifyStatus)}</strong><small>Tests: ${escapeHtml(testStatus)} &middot; Build: ${escapeHtml(buildStatus)}</small></div>
      </section>
    </header>

    <div class="grid">
      <div>
        <section class="section">
          <div class="section-head">
            <div>
              <h2>Implemented And Tested Achievements</h2>
              <p>All achievement definitions detected in source. The achievement constitution test file is present and part of CI.</p>
            </div>
            <span class="chip ${statusTone(verifyStatus)}">${escapeHtml(verifyStatus)}</span>
          </div>
          <table class="achievement-table">
            <thead>
              <tr>
                <th>Achievement</th>
                <th>Requirement</th>
                <th>Category</th>
                <th>Tier</th>
                <th>Reward</th>
              </tr>
            </thead>
            <tbody>
              ${achievements.map((item) => `
                <tr>
                  <td>${escapeHtml(item.title)}<br /><span class="mono">${escapeHtml(item.id)}</span></td>
                  <td>${escapeHtml(item.detail)}</td>
                  <td><span class="category">${escapeHtml(item.category)}</span></td>
                  <td><span class="tier">${escapeHtml(item.tier)}</span></td>
                  <td class="mono">${item.xp} XP &middot; ${money(item.bounty)}</td>
                </tr>`).join('\n')}
            </tbody>
          </table>
        </section>

        <section class="section">
          <div class="section-head">
            <div>
              <h2>Added To Main</h2>
              <p>Recent commits currently present on <span class="mono">${escapeHtml(baseRef)}</span>.</p>
            </div>
            <span class="chip">${commits.length} commits</span>
          </div>
          <ul class="commit-list">
            ${renderList(commits, (commitItem) => `
              <li class="commit-row">
                <strong>${escapeHtml(commitItem.subject)}</strong>
                <span><span class="mono">${escapeHtml(commitItem.sha)}</span> &middot; ${escapeHtml(commitItem.date)}</span>
              </li>`)}
          </ul>
        </section>
      </div>

      <aside>
        <section class="section">
          <div class="section-head">
            <div>
              <h2>Roadmap Phases</h2>
              <p>Read from <span class="mono">docs/ROADMAP.md</span>.</p>
            </div>
          </div>
          <div class="phase-wrap">
            ${phases.map((phase) => `
              <article class="phase">
                <strong>${escapeHtml(phase.title)}</strong>
                <ul>${phase.items.slice(0, 5).map((item) => `<li>${escapeHtml(item)}</li>`).join('\n')}</ul>
              </article>`).join('\n')}
          </div>
        </section>

        <section class="section">
          <div class="section-head">
            <div>
              <h2>Still Testing</h2>
              <p>${openPrs.length ? 'Open GitHub PRs from the cron run.' : 'Fallback testing list from docs/roadmap-weekly-plan.json.'}</p>
            </div>
            <span class="chip warn">${stillTesting.length} items</span>
          </div>
          <ul class="road-list">${renderPlanItems(stillTesting)}</ul>
        </section>

        <section class="section">
          <div class="section-head">
            <div>
              <h2>This Week</h2>
              <p>Planned focus for the current working week.</p>
            </div>
          </div>
          <ul class="road-list">${renderPlanItems(plan.thisWeekPlan ?? [])}</ul>
        </section>

        <section class="section">
          <div class="section-head">
            <div>
              <h2>Tested Areas</h2>
              <p>Detected test files that protect source behavior.</p>
            </div>
            <span class="chip">${tests.length} files</span>
          </div>
          <ul class="test-list">
            ${renderList(tests.slice(0, 28), (test) => `
              <li class="test-row">
                <strong>${escapeHtml(test.title)}</strong>
                <span class="mono">${escapeHtml(test.file)}</span>
              </li>`)}
          </ul>
        </section>
      </aside>
    </div>

    <p class="source-bar">
      Generated by <span class="mono">scripts/generate-roadmap.mjs</span>. The daily cron runs tests/build, regenerates this page, and opens or updates a PR instead of pushing directly to protected main.
    </p>
  </main>
</body>
</html>
`

  mkdirSync(path.dirname(outFile), { recursive: true })
  writeFileSync(outFile, html)
  console.log(`Generated ${path.relative(root, outFile)} with ${achievements.length} achievements, ${tests.length} test files, and ${commits.length} commits.`)
}

main()
