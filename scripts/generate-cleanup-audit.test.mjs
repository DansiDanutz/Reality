import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import {
  REPORT_RELATIVE_PATH,
  collectCleanupAudit,
  renderCleanupAudit,
  resolveReportPath,
  writeCleanupAudit,
} from './generate-cleanup-audit.mjs'

const tempRoots = []

const makeRepo = () => {
  const rootDir = mkdtempSync(path.join(tmpdir(), 'cleanup-audit-'))
  tempRoots.push(rootDir)
  return rootDir
}

const write = (rootDir, relativePath, contents) => {
  const absolutePath = path.join(rootDir, relativePath)
  mkdirSync(path.dirname(absolutePath), { recursive: true })
  writeFileSync(absolutePath, contents)
}

afterEach(() => {
  while (tempRoots.length) {
    const rootDir = tempRoots.pop()
    try {
      rmSync(rootDir, { recursive: true, force: true })
    } catch {
      // ignore temp cleanup failures in tests
    }
  }
})

describe('cleanup audit generator', () => {
  test('renders deterministic output from a bounded static snapshot', () => {
    const rootDir = makeRepo()
    write(rootDir, 'src/game/useful.ts', 'export const useful = 1\n')
    write(rootDir, 'api/health.ts', 'export const health = true\n')
    write(rootDir, 'e2e/smoke.test.ts', 'test("smoke", () => {})\n')
    write(rootDir, 'scripts/kept.mjs', 'export const kept = true\n')
    write(rootDir, 'scripts/kept.test.mjs', "import './kept.mjs'\n")
    write(rootDir, 'scripts/lonely.mjs', 'export const lonely = true\n')
    write(rootDir, 'scripts/orphan.test.mjs', 'export const orphan = true\n')
    write(rootDir, 'docs/guide.md', '# Guide\nSee scripts/kept.mjs\n')
    write(rootDir, 'docs/runbooks/copy-a.md', 'same copy\n')
    write(rootDir, 'docs/runbooks/copy-b.md', 'same copy\n')
    write(rootDir, '.github/workflows/ci.yml', 'name: ci\n')
    write(rootDir, '.github/workflows/cleanup-audit.yml', 'name: cleanup\n')
    write(rootDir, 'package.json', '{"scripts":{"kept":"node scripts/kept.mjs"}}\n')
    write(rootDir, 'dist/ignored.txt', 'ignored\n')
    write(rootDir, 'node_modules/pkg/ignored.js', 'ignored\n')

    const audit = collectCleanupAudit({ rootDir, git: { branch: 'audit/test', commit: 'abc1234' } })
    const first = renderCleanupAudit(audit)
    const second = renderCleanupAudit(collectCleanupAudit({ rootDir, git: { branch: 'audit/test', commit: 'abc1234' } }))

    expect(first).toBe(second)
    expect(first).toContain('Allowed write path: `docs/automation/cleanup-audit.md`')
    expect(first).toContain('Unit tests: `not-run`')
    expect(first).toContain('Browser E2E: `delegated-to-pr-ci`')
    expect(first).toContain('`scripts/lonely.mjs` has no textual references')
    expect(first).toContain('`scripts/orphan.test.mjs` has no sibling `.mjs` implementation file.')
    expect(first).toContain('`docs/runbooks/copy-a.md`')
    expect(first).toContain('Text files scanned: 13')
  })

  test('enforces the single allowed write path', () => {
    const rootDir = makeRepo()

    expect(resolveReportPath(rootDir)).toBe(path.join(rootDir, REPORT_RELATIVE_PATH))
    expect(() => resolveReportPath(rootDir, 'src/game/catalog.ts')).toThrow(
      'Cleanup audit may only write docs/automation/cleanup-audit.md; received src/game/catalog.ts',
    )
  })

  test('writes the report only to docs/automation/cleanup-audit.md', () => {
    const rootDir = makeRepo()
    const markdown = '# Cleanup Audit\n'

    const outputPath = writeCleanupAudit({ rootDir, markdown })

    expect(outputPath).toBe(path.join(rootDir, REPORT_RELATIVE_PATH))
    expect(readFileSync(outputPath, 'utf8')).toBe(markdown)
  })
})
