import { describe, expect, test } from 'vitest'
import { constructionSiteSVG, quantizeLaborRatio } from './sprites'

describe('quantizeLaborRatio', () => {
  test('quantizes to tenths so the marker DOM only re-renders on real progress steps', () => {
    expect(quantizeLaborRatio(0)).toBe(0)
    expect(quantizeLaborRatio(0.81)).toBe(0.8)
    expect(quantizeLaborRatio(0.84)).toBe(0.8)
    expect(quantizeLaborRatio(0.85)).toBe(0.9)
    expect(quantizeLaborRatio(1)).toBe(1)
  })

  test('clamps out-of-range ratios', () => {
    expect(quantizeLaborRatio(-0.5)).toBe(0)
    expect(quantizeLaborRatio(3)).toBe(1)
  })
})

describe('constructionSiteSVG', () => {
  test('every phase is a single aria-hidden SVG anchored by the standard ground shadow', () => {
    for (const phase of ['materials', 'permit', 'labor'] as const) {
      const svg = constructionSiteSVG('home', phase, 0.5)
      expect(svg.startsWith('<svg')).toBe(true)
      expect(svg).toContain('aria-hidden="true"')
      expect(svg).toContain('<ellipse') // ground shadow — HoMM convention
      expect(svg).toContain('site-stakes') // the surveyed plot is visible all the way through
      expect(svg).toContain('site-piles') // deposited materials stay on site
    }
  })

  test('materials phase: just the surveyed plot and piles — no sign, no scaffold', () => {
    const svg = constructionSiteSVG('home', 'materials', 0)
    expect(svg).not.toContain('site-sign')
    expect(svg).not.toContain('site-scaffold')
    expect(svg).not.toContain('site-dust')
  })

  test('permit phase: the parchment permit sign appears beside the piles', () => {
    const svg = constructionSiteSVG('home', 'permit', 0)
    expect(svg).toContain('site-sign')
    expect(svg).not.toContain('site-scaffold')
  })

  test('labor phase: scaffold, crane pennant and dust motes around the rising silhouette', () => {
    const svg = constructionSiteSVG('home', 'labor', 0.5)
    expect(svg).toContain('site-scaffold')
    expect(svg).toContain('crane-pennant')
    expect(svg).toContain('site-dust')
    expect(svg).toContain('site-rise')
  })

  test('the silhouette rises with labor progress, in quantized steps', () => {
    const early = constructionSiteSVG('home', 'labor', 0.2)
    const late = constructionSiteSVG('home', 'labor', 0.9)
    expect(early).not.toBe(late)
    const riseHeight = (svg: string) => Number(/class="site-rise"[^>]*height="([0-9.]+)"/.exec(svg)?.[1])
    expect(riseHeight(late)).toBeGreaterThan(riseHeight(early))
    // Two ratios inside the same tenth render identically — no DOM churn
    expect(constructionSiteSVG('home', 'labor', 0.81)).toBe(constructionSiteSVG('home', 'labor', 0.84))
  })

  test('window openings appear once the walls pass half height — lights come on only when finished', () => {
    expect(constructionSiteSVG('home', 'labor', 0.3)).not.toContain('site-openings')
    const nearlyDone = constructionSiteSVG('home', 'labor', 0.8)
    expect(nearlyDone).toContain('site-openings')
    // openings are dark — the glow belongs to the finished archetype sprite
    expect(nearlyDone).not.toContain('var(--gold')
  })

  test('home and business sites carry their archetype roof accents', () => {
    const home = constructionSiteSVG('home', 'labor', 0.6)
    const business = constructionSiteSVG('business', 'labor', 0.6)
    expect(home).toContain('#5b3d8f') // ROOF — homes
    expect(home).not.toContain('#8f2d3d')
    expect(business).toContain('#8f2d3d') // ROOF_BIZ — businesses
    expect(business).not.toContain('#5b3d8f')
  })
})
