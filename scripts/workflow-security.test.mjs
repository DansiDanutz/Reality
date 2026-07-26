import { readFile } from 'node:fs/promises'
import { describe, expect, test } from 'vitest'

const workflowPaths = [
  new URL('../.github/workflows/ci.yml', import.meta.url),
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
})
