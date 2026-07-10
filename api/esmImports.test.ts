import { readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

/**
 * Regression guard for issue #1012. Vercel compiles api/ functions per-file
 * WITHOUT bundling: import specifiers survive into the emitted JS, where
 * Node's ESM loader resolves them literally. An extensionless relative
 * import (`from './catalog'`) works under Vite's bundler resolution but is
 * ERR_MODULE_NOT_FOUND at function runtime — api/intent was broken in
 * production this way while every local gate stayed green.
 *
 * Rule enforced here: every VALUE import reachable from an api/ entrypoint
 * must use an explicit ./x.js specifier, transitively through src/.
 */

const ROOT = resolve(__dirname, '..')

const IMPORT_RE = /^import\s+(type\s+)?[\s\S]*?from\s+['"]([^'"]+)['"]/gm

function relativeValueImports(filePath: string): string[] {
  const source = readFileSync(filePath, 'utf8')
  const specifiers: string[] = []
  for (const match of source.matchAll(IMPORT_RE)) {
    const isTypeOnly = Boolean(match[1])
    const spec = match[2]
    if (!isTypeOnly && spec.startsWith('.')) specifiers.push(spec)
  }
  return specifiers
}

function resolveTs(fromFile: string, spec: string): string {
  const base = resolve(dirname(fromFile), spec)
  return base.endsWith('.js') ? base.slice(0, -3) + '.ts' : base + '.ts'
}

describe('api/ ESM import graph', () => {
  const entrypoints = readdirSync(resolve(ROOT, 'api'))
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    .map((name) => resolve(ROOT, 'api', name))

  test('every relative value import reachable from api/ carries a .js extension', () => {
    const queue = [...entrypoints]
    const seen = new Set<string>()
    const offenders: string[] = []

    while (queue.length > 0) {
      const file = queue.pop()!
      if (seen.has(file)) continue
      seen.add(file)
      for (const spec of relativeValueImports(file)) {
        if (!spec.endsWith('.js')) offenders.push(`${file.replace(ROOT + '/', '')} → '${spec}'`)
        queue.push(resolveTs(file, spec))
      }
    }

    expect(seen.size).toBeGreaterThan(10) // the walker actually walked
    expect(offenders).toEqual([])
  })
})
