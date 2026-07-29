#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

export const REPORT_RELATIVE_PATH = 'docs/automation/cleanup-audit.md'

const TARGET_DIRECTORIES = ['src', 'api', 'scripts', 'docs', 'e2e', '.github/workflows']
const IGNORED_DIRECTORIES = new Set(['.git', '.omx', 'dist', 'node_modules'])
const TEXT_FILE_PATTERN = /\.(?:css|html|js|json|md|mjs|sh|ts|tsx|yaml|yml)$/i

function toPosix(value) {
  return value.split(path.sep).join('/')
}

function sortList(values) {
  return [...values].sort((left, right) => left.localeCompare(right))
}

function execText(rootDir, command, args) {
  try {
    return execFileSync(command, args, {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return ''
  }
}

function walkFiles(rootDir, relativeDir) {
  const absoluteDir = path.join(rootDir, relativeDir)
  if (!existsSync(absoluteDir)) return []

  const files = []
  for (const entry of readdirSync(absoluteDir).sort((left, right) => left.localeCompare(right))) {
    if (IGNORED_DIRECTORIES.has(entry)) continue
    const absolutePath = path.join(absoluteDir, entry)
    const relativePath = toPosix(path.relative(rootDir, absolutePath))
    const stats = statSync(absolutePath)
    if (stats.isDirectory()) {
      files.push(...walkFiles(rootDir, relativePath))
      continue
    }
    if (relativePath !== REPORT_RELATIVE_PATH) files.push(relativePath)
  }

  return files
}

function rootTextFiles(rootDir) {
  const files = []
  for (const entry of readdirSync(rootDir).sort((left, right) => left.localeCompare(right))) {
    if (IGNORED_DIRECTORIES.has(entry)) continue
    const absolutePath = path.join(rootDir, entry)
    const stats = statSync(absolutePath)
    if (!stats.isFile() || !TEXT_FILE_PATTERN.test(entry)) continue
    files.push(entry)
  }
  return files
}

function readTextFile(rootDir, relativePath) {
  return readFileSync(path.join(rootDir, relativePath), 'utf8')
}

function listTextFiles(rootDir) {
  const files = [
    ...rootTextFiles(rootDir),
    ...TARGET_DIRECTORIES.flatMap((directory) => walkFiles(rootDir, directory)),
  ]
  const textFiles = files.filter((relativePath) => TEXT_FILE_PATTERN.test(relativePath))
  return sortList(new Set(textFiles))
}

function referenceSetFor(targets, corpus) {
  const references = new Map(targets.map((target) => [target, new Set()]))

  for (const [file, text] of corpus.entries()) {
    for (const target of targets) {
      if (file === target) continue
      const basename = path.posix.basename(target)
      if (text.includes(target) || text.includes(basename)) references.get(target).add(file)
    }
  }

  return references
}

function duplicateGroups(files, corpus) {
  const hashes = new Map()

  for (const file of files) {
    const digest = createHash('sha1').update(corpus.get(file)).digest('hex')
    if (!hashes.has(digest)) hashes.set(digest, [])
    hashes.get(digest).push(file)
  }

  return [...hashes.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([digest, group]) => ({ digest: digest.slice(0, 12), files: sortList(group) }))
    .sort((left, right) => left.files[0].localeCompare(right.files[0]))
}

function gitInfo(rootDir) {
  return {
    branch: execText(rootDir, 'git', ['branch', '--show-current']) || 'unknown',
    commit: execText(rootDir, 'git', ['rev-parse', '--short', 'HEAD']) || 'unknown',
  }
}

export function assertAllowedWritePath(relativePath) {
  const normalized = toPosix(relativePath)
  if (normalized !== REPORT_RELATIVE_PATH) {
    throw new Error(`Cleanup audit may only write ${REPORT_RELATIVE_PATH}; received ${normalized}`)
  }
  return normalized
}

export function resolveReportPath(rootDir, relativePath = REPORT_RELATIVE_PATH) {
  return path.join(rootDir, assertAllowedWritePath(relativePath))
}

export function collectCleanupAudit({ rootDir = process.cwd(), git = gitInfo(rootDir) } = {}) {
  const textFiles = listTextFiles(rootDir)
  const corpus = new Map(textFiles.map((file) => [file, readTextFile(rootDir, file)]))
  const scriptFiles = textFiles.filter((file) => file.startsWith('scripts/') && file.endsWith('.mjs') && !file.endsWith('.test.mjs'))
  const scriptTests = textFiles.filter((file) => file.startsWith('scripts/') && file.endsWith('.test.mjs'))
  const docsFiles = textFiles.filter((file) => file.startsWith('docs/') && file.endsWith('.md'))
  const workflowFiles = textFiles.filter((file) => file.startsWith('.github/workflows/') && /\.ya?ml$/i.test(file))
  const scriptReferences = referenceSetFor(scriptFiles, corpus)
  const unreferencedScripts = scriptFiles
    .filter((file) => scriptReferences.get(file).size === 0)
  const orphanScriptTests = scriptTests.filter((file) => !existsSync(path.join(rootDir, file.replace(/\.test\.mjs$/, '.mjs'))))
  const duplicateTextGroups = duplicateGroups([...scriptFiles, ...scriptTests, ...docsFiles], corpus)

  return {
    git,
    verification: {
      tests: process.env.CLEANUP_AUDIT_TEST_STATUS || 'not-run',
      build: process.env.CLEANUP_AUDIT_BUILD_STATUS || 'not-run',
      lint: process.env.CLEANUP_AUDIT_LINT_STATUS || 'not-run',
      e2e: 'delegated-to-pr-ci',
    },
    reportPath: REPORT_RELATIVE_PATH,
    scope: {
      sourceFiles: textFiles.filter((file) => file.startsWith('src/')).length,
      apiFiles: textFiles.filter((file) => file.startsWith('api/')).length,
      e2eFiles: textFiles.filter((file) => file.startsWith('e2e/')).length,
      scriptFiles: scriptFiles.length,
      scriptTests: scriptTests.length,
      docsFiles: docsFiles.length,
      workflowFiles: workflowFiles.length,
      textFiles: textFiles.length,
    },
    candidates: {
      unreferencedScripts,
      orphanScriptTests: sortList(orphanScriptTests),
      duplicateTextGroups,
    },
  }
}

function renderCandidateList(items, renderItem) {
  return items.length ? items.map((item) => `- ${renderItem(item)}`).join('\n') : '- None.'
}

export function renderCleanupAudit(audit) {
  return `# Cleanup Audit

Generated by \`scripts/generate-cleanup-audit.mjs\`. This routine is deterministic for a given commit and may write only \`${audit.reportPath}\`.

## Scope Guard

- Branch: \`${audit.git.branch}\`
- Commit: \`${audit.git.commit}\`
- Allowed write path: \`${audit.reportPath}\`
- Mutation policy: audit-only; no product, test, or workflow source edits.

## Static Evidence Snapshot

- Unit tests: \`${audit.verification.tests}\`
- Production build: \`${audit.verification.build}\`
- Lint: \`${audit.verification.lint}\`
- Browser E2E: \`${audit.verification.e2e}\`
- Text files scanned: ${audit.scope.textFiles}
- Source files scanned: ${audit.scope.sourceFiles}
- API files scanned: ${audit.scope.apiFiles}
- E2E files scanned: ${audit.scope.e2eFiles}
- Automation scripts scanned: ${audit.scope.scriptFiles}
- Script tests scanned: ${audit.scope.scriptTests}
- Markdown docs scanned: ${audit.scope.docsFiles}
- Workflow files scanned: ${audit.scope.workflowFiles}

## Manual Review Candidates

### Unreferenced Scripts

${renderCandidateList(audit.candidates.unreferencedScripts, (file) => `\`${file}\` has no textual references in the scanned repo corpus.`)}

### Orphan Script Tests

${renderCandidateList(audit.candidates.orphanScriptTests, (file) => `\`${file}\` has no sibling \`.mjs\` implementation file.`)}

### Exact Duplicate Docs Or Scripts

${renderCandidateList(audit.candidates.duplicateTextGroups, ({ digest, files }) => `sha1 \`${digest}\` shared by ${files.map((file) => `\`${file}\``).join(', ')}.`)}

## Operator Rules

- Confirm every candidate with \`rg\`, build, lint, and tests before deleting anything.
- Keep cleanup same-layer and evidence-backed; this report does not authorize source mutations.
- If the generator ever changes a path other than \`${audit.reportPath}\`, treat the run as invalid.
`
}

export function writeCleanupAudit({ rootDir = process.cwd(), markdown, relativePath = REPORT_RELATIVE_PATH } = {}) {
  const outputPath = resolveReportPath(rootDir, relativePath)
  mkdirSync(path.dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, markdown)
  return outputPath
}

function main() {
  const rootDir = process.cwd()
  const audit = collectCleanupAudit({ rootDir })
  const markdown = renderCleanupAudit(audit)
  writeCleanupAudit({ rootDir, markdown })
  process.stdout.write(`${REPORT_RELATIVE_PATH}\n`)
}

if (import.meta.url === new URL(process.argv[1], 'file://').href) main()
