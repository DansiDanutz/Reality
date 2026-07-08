import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

const css = readFileSync(resolve(process.cwd(), 'src/styles/global.css'), 'utf8')

function zIndexFor(selector: string): number {
  const lines = css.split(/\r?\n/)
  const start = lines.findIndex((line) => line.trim() === `${selector} {`)
  if (start < 0) throw new Error(`Missing CSS block for ${selector}`)

  const block: string[] = []
  for (const line of lines.slice(start)) {
    block.push(line)
    if (line.trim() === '}') break
  }

  const zIndex = block.join('\n').match(/z-index:\s*(?<value>-?\d+)/)?.groups?.value
  if (!zIndex) throw new Error(`Missing z-index for ${selector}`)
  return Number(zIndex)
}

describe('global layer ordering', () => {
  test('keeps toasts visible above drawers while modal overlays remain highest', () => {
    const drawer = zIndexFor('.drawer')
    const installBanner = zIndexFor('.install-banner')
    const toasts = zIndexFor('.toasts')
    const celebration = zIndexFor('.celebration')
    const confirmOverlay = zIndexFor('.confirm-overlay')

    expect(toasts).toBeGreaterThan(drawer)
    expect(toasts).toBeGreaterThan(installBanner)
    expect(toasts).toBeLessThan(celebration)
    expect(toasts).toBeLessThan(confirmOverlay)
  })
})
