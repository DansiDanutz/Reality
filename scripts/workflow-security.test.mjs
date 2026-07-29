import { readFile } from 'node:fs/promises'
import { describe, expect, test } from 'vitest'

const workflowPaths = [
  new URL('../.github/workflows/ci.yml', import.meta.url),
  new URL('../.github/workflows/cleanup-audit.yml', import.meta.url),
  new URL('../.github/workflows/roadmap-daily.yml', import.meta.url),
]

describe('workflow security boundary', () => {
  test('pins first-party actions to immutable commits', async () => {
    for (const path of workflowPaths) {
      const workflow = await readFile(path, 'utf8')
      for (const line of workflow.split('\n').filter((candidate) => candidate.includes('uses: actions/'))) {
        expect(line).toMatch(/uses: actions\/[a-z-]+@[0-9a-f]{40}(?:\s+#.*)?$/)
      }
    }
  })

  test('keeps verification jobs explicitly read-only', async () => {
    const workflow = await readFile(workflowPaths[0], 'utf8')
    expect(workflow).toMatch(/permissions:\n\s+contents: read/)
  })

  test('cleanup audit stages only the generated report path', async () => {
    const workflow = await readFile(workflowPaths[1], 'utf8')
    expect(workflow).toContain('node scripts/generate-cleanup-audit.mjs')
    expect(workflow).toContain('group: cleanup-audit')
    expect(workflow).toContain('cancel-in-progress: false')
    expect(workflow).toContain('CLEANUP_AUDIT_TEST_STATUS: ${{ steps.tests.outcome }}')
    expect(workflow).toContain("if: steps.tests.outcome != 'success' || steps.build.outcome != 'success' || steps.lint.outcome != 'success'")
    expect(workflow).toContain("git diff --quiet -- docs/automation/cleanup-audit.md")
    expect(workflow).toContain("git diff --quiet -- . ':(exclude)docs/automation/cleanup-audit.md'")
    expect(workflow).toContain("git ls-files --others --exclude-standard | grep -v '^docs/automation/cleanup-audit.md$'")
    expect(workflow).toContain('git ls-files --others --exclude-standard -- docs/automation/cleanup-audit.md | grep -q .')
    expect(workflow).toContain('git add docs/automation/cleanup-audit.md')
    expect(workflow).toContain('if [ "$staged" != "docs/automation/cleanup-audit.md" ]; then')
  })
})
